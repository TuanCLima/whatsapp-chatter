import path from 'node:path'
import express from 'express'
import Twilio from 'twilio'
import assistantConfigRouter from './routes/assistantConfig'
import contactsRouter from './routes/contacts'
import predefinedToolsRouter from './routes/predefinedTools'
import sseRouter from './routes/sse'
import mcpRouter from './server/mcpServer'
import { whatsappSaasWebhook } from './webhook'
import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { and, desc, eq, ne, or } from 'drizzle-orm'
import { db } from './db'
import {
  messages,
  saasUsers,
  userSaasUserMapping,
  users,
} from './db/schema-postgres'
import { authenticateUser } from './middleware/authenticateUser'
import { authService } from './services/AuthService'
import { twilioClientPool } from './services/TwilioClientPool'
import type { Contact, Conversation, Message } from './types/types'
import { FRONTEND_LOCALHOST, PRODUCTION_DOMAIN } from './utils/contants'
import {
  getUniqueWhatsAppContacts,
  getWhatsAppConversationByContactId,
  getWhatsAppConversations,
} from './utils/twilioMessages'

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        role: string
        exp: number
      }
    }
  }
}

export const PORT = process.env.PORT ?? 3000
const app = express()
// CORS: reflect request origin and allow credentials so cookies can be set/sent in dev and prod
app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export const twilioClient = Twilio(accountSid, authToken)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/mcp', mcpRouter)
app.use('/api/assistant', assistantConfigRouter)
app.use('/api/predefined-tools', predefinedToolsRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/sse', sseRouter)

const oauthCallback = (req: express.Request, res: express.Response) => {
  const code = req.query.code as string
  const error = req.query.error as string

  // Get the frontend origin based on environment
  const frontendOrigin =
    process.env.NODE_ENV === 'production'
      ? PRODUCTION_DOMAIN
      : FRONTEND_LOCALHOST

  // Create an HTML page that sends the message to the parent window
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Callback</title>
    </head>
    <body>
      <script>
        try {
          if (window.opener) {
            const data = ${JSON.stringify({ code, error })};
            const frontendOrigin = '${frontendOrigin}';
            console.log('Sending OAuth data to parent:', data, 'Target origin:', frontendOrigin);
            if (data.code) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                code: data.code
              }, frontendOrigin);
            } else if (data.error) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_ERROR',
                error: data.error
              }, frontendOrigin);
            }
          }
        } catch (e) {
          console.error('Error sending message to parent:', e);
        }
        setTimeout(() => window.close(), 1000);
      </script>
      <p>Authentication ${code ? 'successful' : 'failed'}. This window will close automatically.</p>
    </body>
    </html>
  `

  res.send(html)
}

// OAuth callback route for Google Calendar authentication
app.get('/oauth2callback', oauthCallback)

// Authentication middleware for protected routes

app.get('/api/db/users', authenticateUser, async (_req, res) => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
    res.json(allUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/api/db/messages', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber, limit = '500' } = req.query as {
      phoneNumber?: string
      limit?: string
    }

    const l = Math.min(Number.parseInt(limit, 10) || 500, 2000)
    const rows = phoneNumber
      ? await db
          .select()
          .from(messages)
          .where(eq(messages.phoneNumber, phoneNumber))
          .orderBy(desc(messages.timestamp))
          .limit(l)
      : await db
          .select()
          .from(messages)
          .orderBy(desc(messages.timestamp))
          .limit(l)

    res.json(rows)
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Clear ALL messages (dangerous) - user only
app.delete(
  '/api/db/clear-all-messages',
  authenticateUser,
  async (_req, res) => {
    try {
      // Delete all rows from messages table
      await db.delete(messages)
      res.json({ success: true })
    } catch (error) {
      console.error('Error clearing messages:', error)
      res.status(500).json({ error: 'Failed to clear messages' })
    }
  },
)

app.delete(
  '/api/db/clear-all-users-and-messages',
  authenticateUser,
  async (_req, res) => {
    try {
      // Delete all rows from users table
      await db.delete(users)
      await db.delete(messages)
      res.json({ success: true })
    } catch (error) {
      console.error('Error clearing users or messages:', error)
      res.status(500).json({ error: 'Failed to clear users and messages' })
    }
  },
)

// Clear messages for a specific phone number (?phoneNumber=... required)
app.delete('/api/db/messages-per-user', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber } = req.query as { phoneNumber?: string }

    console.log('/api/db/messages-per-user', { phoneNumber })

    if (!phoneNumber) {
      res.status(400).json({ error: 'phoneNumber query param required' })
      return
    }
    await db.delete(messages).where(eq(messages.phoneNumber, phoneNumber))
    res.json({ success: true })
  } catch (error) {
    console.error('Error clearing phone messages:', error)
    res.status(500).json({ error: 'Failed to clear user messages' })
  }
})

// Check and create missing user-SaaS user mappings
app.get(
  '/api/db/check-missing-mappings',
  authenticateUser,
  async (_req, res) => {
    try {
      // Get all WhatsApp users
      const allUsers = await db.select().from(users)

      // Get all existing mappings
      const allMappings = await db.select().from(userSaasUserMapping)
      const mappedPhoneNumbers = new Set(allMappings.map((m) => m.phoneNumber))

      // Find users without mappings
      const unmappedUsers = allUsers.filter(
        (user) => !mappedPhoneNumbers.has(user.phoneNumber),
      )

      res.json({
        totalUsers: allUsers.length,
        mappedUsers: allMappings.length,
        unmappedUsers: unmappedUsers.length,
        unmappedPhoneNumbers: unmappedUsers.map((u) => u.phoneNumber),
      })
    } catch (error) {
      console.error('Error checking missing mappings:', error)
      res.status(500).json({ error: 'Failed to check missing mappings' })
    }
  },
)

// Create missing mappings for all unmapped users to the first SaaS user (for migration purposes)
app.post(
  '/api/db/create-missing-mappings',
  authenticateUser,
  async (req, res) => {
    try {
      const { saasUserId } = req.body as { saasUserId?: string }

      if (!saasUserId) {
        res
          .status(400)
          .json({ error: 'saasUserId is required in request body' })
        return
      }

      // Verify SaaS user exists
      const saasUser = await db
        .select()
        .from(saasUsers)
        .where(eq(saasUsers.id, saasUserId))
        .limit(1)

      if (saasUser.length === 0) {
        res.status(404).json({ error: 'SaaS user not found' })
        return
      }

      // Get all WhatsApp users
      const allUsers = await db.select().from(users)

      // Get all existing mappings
      const allMappings = await db.select().from(userSaasUserMapping)
      const mappedPhoneNumbers = new Set(allMappings.map((m) => m.phoneNumber))

      // Find users without mappings
      const unmappedUsers = allUsers.filter(
        (user) => !mappedPhoneNumbers.has(user.phoneNumber),
      )

      if (unmappedUsers.length === 0) {
        res.json({ message: 'No unmapped users found', created: 0 })
        return
      }

      // Create mappings for unmapped users
      const newMappings = unmappedUsers.map((user) => ({
        phoneNumber: user.phoneNumber,
        saasUserId: saasUserId,
      }))

      await db.insert(userSaasUserMapping).values(newMappings)

      res.json({
        message: 'Missing mappings created successfully',
        created: newMappings.length,
        mappedTo: saasUserId,
      })
    } catch (error) {
      console.error('Error creating missing mappings:', error)
      res.status(500).json({ error: 'Failed to create missing mappings' })
    }
  },
)

// SaaS webhook route with static path
app.post('/webhook', whatsappSaasWebhook)

// User authentication routes
app.post('/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body

    if (!email || !name || !password) {
      res.status(400).json({ error: 'Email, name, and password are required' })
      return
    }

    const user = await authService.createUser({ email, name, password })

    // Remove sensitive fields
    const { passwordHash: _, twilioAuthToken: __, ...safeUser } = user

    res.status(201).json({ user: safeUser })
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof Error && error.message === 'User already exists') {
      res.status(409).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Failed to create user' })
    }
  }
})

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const result = await authService.login(email, password)

    // Set HTTP-only cookie for user access
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.json(result)
  } catch (error) {
    console.error('Login error:', error)

    if (error instanceof Error && error.message === 'Invalid credentials') {
      res.status(401).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Login failed' })
    }
  }
})

app.get('/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.auth_token

    if (!token) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const user = await authService.verifyToken(token)

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // Remove sensitive fields
    const { passwordHash: _, twilioAuthToken: __, ...safeUser } = user

    res.json(safeUser)
  } catch (error) {
    console.error('Token verification error:', error)
    res.status(401).json({ error: 'Token verification failed' })
  }
})

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('auth_token')
  res.json({ message: 'Logged out successfully' })
})

app.get('/api/twilio/credentials', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const user = await authService.getUserById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      configured: !!(
        user.twilioAccountSid &&
        user.twilioAuthToken &&
        user.twilioWhatsappNumber
      ),
      accountSid: user.twilioAccountSid,
      whatsappNumber: user.twilioWhatsappNumber,
      webhookPath: '/webhook', // Static webhook path for all SaaS users
    })
  } catch (error) {
    console.error('Error fetching Twilio credentials:', error)
    res.status(500).json({ error: 'Failed to fetch credentials' })
  }
})

app.post('/api/twilio/credentials', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { accountSid, authToken, whatsappNumber } = req.body

    if (!accountSid || !authToken || !whatsappNumber) {
      res.status(400).json({
        error: 'Account SID, Auth Token, and WhatsApp number are required',
      })
      return
    }

    // Validate Twilio credentials
    const isValid = await twilioClientPool.validateCredentials(
      accountSid,
      authToken,
    )
    if (!isValid) {
      res.status(400).json({ error: 'Invalid Twilio credentials' })
      return
    }

    await twilioClientPool.saveUserCredentials(
      userId,
      accountSid,
      authToken,
      whatsappNumber,
    )

    res.json({ message: 'Twilio credentials saved successfully' })
  } catch (error) {
    console.error('Error saving Twilio credentials:', error)
    res.status(500).json({ error: 'Failed to save credentials' })
  }
})

// Serve React UI for all other routes

app.get('/contacts', async (_req, res) => {
  try {
    const contacts = await getUniqueWhatsAppContacts()
    res.status(200).json(contacts)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

app.get('/db/contacts', async (_req, res) => {
  try {
    // Get all users from database
    const dbUsers = await db.select().from(users)

    // Convert users to contacts format
    const contacts: Contact[] = await Promise.all(
      dbUsers.map(async (user) => {
        // Get the latest message for this user to show as lastMessage
        const latestMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.phoneNumber, user.phoneNumber))
          .orderBy(desc(messages.timestamp))
          .limit(1)

        const contact: Contact = {
          id: user.phoneNumber,
          name: user.profileName || user.phoneNumber,
          avatar: '', // You might want to add avatar support to your schema
          phoneNumber: user.phoneNumber,
          conversationDisabled: user.conversationDisabled,
          lastMessage:
            latestMessage.length > 0
              ? {
                  text: latestMessage[0].content || '',
                  timestamp: latestMessage[0].timestamp.toISOString(),
                  status: 'delivered' as const,
                }
              : undefined,
          online: false, // You might want to add online status to your schema
          typing: false,
        }

        return contact
      }),
    )

    res.status(200).json(contacts)
  } catch (error) {
    console.error('Error fetching DB contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts from database' })
  }
})

app.get('/conversations', async (_req, res) => {
  try {
    const conversations = await getWhatsAppConversations()
    res.status(200).json(conversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

app.get('/conversations/:contactId', async (req, res) => {
  const { contactId } = req.params
  try {
    const conversation = await getWhatsAppConversationByContactId(contactId)
    res.status(200).json(conversation ?? null)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// Database-powered conversations route (alternative to WhatsApp API)
app.get('/db/conversations', async (_req, res) => {
  try {
    // Get all users from database
    const dbUsers = await db.select().from(users)

    // Convert users to conversations format
    const conversations: Conversation[] = await Promise.all(
      dbUsers.map(async (user) => {
        // Get messages for this user
        const userMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.phoneNumber, user.phoneNumber))
          .orderBy(messages.timestamp)

        // Convert database messages to frontend format
        const conversationMessages: Message[] = userMessages.map((msg) => ({
          id: msg.id.toString(),
          text: msg.content || '',
          sender: msg.role === 'user' ? user.phoneNumber : 'assistant',
          timestamp: msg.timestamp.toISOString(),
          status: 'delivered' as const,
        }))

        return {
          id: user.phoneNumber,
          contactId: user.phoneNumber,
          messages: conversationMessages,
        }
      }),
    )

    res.status(200).json(conversations)
  } catch (error) {
    console.error('Error fetching DB conversations:', error)
    res
      .status(500)
      .json({ error: 'Failed to fetch conversations from database' })
  }
})

// Get specific conversation from database
app.get('/db/conversations/:contactId', async (req, res) => {
  const { contactId } = req.params
  try {
    // Get user from database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, contactId))
      .limit(1)

    if (user.length === 0) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    // Get messages for this user
    const userMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.phoneNumber, contactId),
          or(
            eq(messages.role, 'user'),
            and(eq(messages.role, 'assistant'), ne(messages.content, '')),
          ),
        ),
      )
      .orderBy(messages.timestamp)

    // Convert database messages to frontend format
    const conversationMessages: Message[] = userMessages.map((msg) => ({
      id: msg.id.toString(),
      text: msg.content || '',
      sender: msg.role === 'user' ? contactId : 'assistant',
      timestamp: msg.timestamp.toISOString(),
      status: 'delivered' as const,
    }))

    const conversation: Conversation = {
      id: contactId,
      contactId: contactId,
      messages: conversationMessages,
    }

    res.status(200).json(conversation)
  } catch (error) {
    console.error('Error fetching DB conversation:', error)
    res
      .status(500)
      .json({ error: 'Failed to fetch conversation from database' })
  }
})

// Send a message
app.post('/send-message', async (req, res) => {
  const { phoneNumber, body } = req.body

  if (!phoneNumber || !body) {
    res
      .status(400)
      .json({ error: 'Phone number and message body are required' })
    return
  }

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: phoneNumber.startsWith('whatsapp:')
        ? phoneNumber
        : `whatsapp:${phoneNumber}`,
      body: body,
    })

    await db.insert(messages).values({
      phoneNumber: phoneNumber.startsWith('whatsapp:')
        ? phoneNumber
        : `whatsapp:${phoneNumber}`,
      role: 'assistant',
      content: body,
      toolCallId: null,
      toolCalls: null,
    })

    res.json({
      sid: message.sid,
      status: message.status,
      dateCreated: message.dateCreated,
      body: message.body,
      to: message.to,
      from: message.from,
    })
  } catch (error) {
    console.error('Error sending message:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// Toggle conversation status for a user
app.put('/users/:phoneNumber/conversation', async (req, res) => {
  const { phoneNumber } = req.params
  const { disabled } = req.body

  if (typeof disabled !== 'boolean') {
    res
      .status(400)
      .json({ error: 'disabled field is required and must be a boolean' })
    return
  }

  try {
    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber))
      .limit(1)

    if (existingUser.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Update conversation status
    await db
      .update(users)
      .set({
        conversationDisabled: disabled,
        updatedAt: new Date(),
      })
      .where(eq(users.phoneNumber, phoneNumber))

    res.json({
      success: true,
      phoneNumber,
      conversationDisabled: disabled,
    })
  } catch (error) {
    console.error('Error updating conversation status:', error)
    res.status(500).json({ error: 'Failed to update conversation status' })
  }
})

// Optional: logout clears the cookie
app.post('/auth/logout', (_req, res) => {
  res.clearCookie('auth_token', { path: '/' })
  res.json({ success: true })
})

// Google token health check endpoint
app.get('/api/token-health', async (_req, res) => {
  try {
    const { validateToken } = require('./googleCalendar/googleAuth')
    const isValid = await validateToken()

    res.json({
      valid: isValid,
      timestamp: new Date().toISOString(),
      message: isValid
        ? 'Google Calendar token is healthy'
        : 'Google Calendar token needs refresh',
    })
  } catch (_error) {
    res.status(500).json({
      error: 'Failed to check token health',
      valid: false,
      timestamp: new Date().toISOString(),
    })
  }
})

// Serve static files from the React app build directory
app.use(express.static(path.resolve(__dirname, '../client/dist')))
app.use(express.static(path.resolve(__dirname, '../dist/public')))

// Catch all handler: send back React's index.html file for any non-API routes
app.use((req, res, next) => {
  // Don't serve index.html for API routes or static asset requests
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/webhook') ||
    req.path.startsWith('/admin') ||
    path.extname(req.path) // If the request is for a file (has an extension), skip
  ) {
    next()
    return
  }
  res.sendFile(path.resolve(__dirname, '../client/dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`🚀 Server running at port: ${PORT}`)
})

export default app
