import express from 'express'
import path from 'path'
import Twilio from 'twilio'
import mcpRouter from './server/mcpServer'
import { whatsappHonoWebhook } from './webhook'
import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { and, desc, eq, ne, or } from 'drizzle-orm'
// import { createProxyMiddleware } from 'http-proxy-middleware'
import { db } from './db'
import { messages, users } from './db/schema'
import type { Contact, Conversation, Message } from './types/types'
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
    origin: (origin, callback) => callback(null, true),
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

/**
 * DRIZZLE STUDIO PROXY SETUP
 *
 * This sets up a protected proxy route to access Drizzle Studio at:
 * https://your-server.com/admin/drizzle
 *
 * Requirements:
 * 1. User must be authenticated with admin token (via Bearer token in Authorization header)
 * 2. Drizzle Studio must be running locally at https://local.drizzle.studio
 *
 * Usage:
 * - Login via /auth/login to get admin token
 * - Access /admin/drizzle with Authorization: Bearer <token> header
 * - Or access through your admin UI that includes the token
 */

// Authentication middleware for protected routes
const authenticateAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void => {
  // Accept token from Authorization header, HttpOnly cookie, or query param for flexibility
  const authHeader = req.headers.authorization
  const cookieToken = req.cookies?.admin_token as string | undefined
  const queryToken = (req.query?.t || req.query?.token) as string | undefined
  const presentedToken =
    (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined) ||
    cookieToken ||
    queryToken

  if (!presentedToken) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const token = presentedToken

  try {
    // Decode the simple token (in production, use proper JWT verification)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())

    if (payload.exp < Date.now()) {
      res.status(401).json({ error: 'Token expired' })
      return
    }

    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Insufficient privileges' })
      return
    }

    console.log('Authenticating admin payload', payload)

    // Add user info to request for use in next middleware
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
}

app.get('/admin/db/users', authenticateAdmin, async (_req, res) => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
    res.json(allUsers)
  } catch (error) {
    console.error('Error fetching users (admin):', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/admin/db/messages', authenticateAdmin, async (req, res) => {
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
    console.error('Error fetching messages (admin):', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Clear ALL messages (dangerous) - admin only
app.delete(
  '/admin/db/clear-all-messages',
  authenticateAdmin,
  async (_req, res) => {
    try {
      // Delete all rows from messages table
      await db.delete(messages)
      res.json({ success: true })
    } catch (error) {
      console.error('Error clearing messages (admin):', error)
      res.status(500).json({ error: 'Failed to clear messages' })
    }
  },
)

app.delete(
  '/admin/db/clear-all-users-and-messages',
  authenticateAdmin,
  async (_req, res) => {
    try {
      // Delete all rows from users table
      await db.delete(users)
      await db.delete(messages)
      res.json({ success: true })
    } catch (error) {
      console.error('Error clearing users or messages (admin):', error)
      res.status(500).json({ error: 'Failed to clear users and messages' })
    }
  },
)

// Clear messages for a specific phone number (?phoneNumber=... required)
app.delete(
  '/admin/db/messages-per-user',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { phoneNumber } = req.query as { phoneNumber?: string }

      console.log('/admin/db/messages-per-user', { phoneNumber })

      if (!phoneNumber) {
        res.status(400).json({ error: 'phoneNumber query param required' })
        return
      }
      await db.delete(messages).where(eq(messages.phoneNumber, phoneNumber))
      res.json({ success: true })
    } catch (error) {
      console.error('Error clearing phone messages (admin):', error)
      res.status(500).json({ error: 'Failed to clear user messages' })
    }
  },
)

app.post('/webhook', whatsappHonoWebhook)

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
                  timestamp: latestMessage[0].timestamp,
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
          timestamp: msg.timestamp,
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
      timestamp: msg.timestamp,
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
        updatedAt: new Date().toISOString(),
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

// Authentication endpoints
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Admin credentials not configured' })
    return
  }

  // Simple hardcoded admin credentials for demo
  // In production, you would hash passwords and store in database
  const adminCredentials = {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD, // In production, this should be hashed
    user: {
      id: '1',
      email: process.env.ADMIN_EMAIL,
      role: 'admin' as const,
      name: 'Admin User',
    },
  }

  if (
    email === adminCredentials.email &&
    password === adminCredentials.password
  ) {
    // Generate a simple JWT token (in production, use proper JWT library)
    const token = Buffer.from(
      JSON.stringify({
        userId: adminCredentials.user.id,
        role: adminCredentials.user.role,
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      }),
    ).toString('base64')

    // Set HttpOnly cookie so normal browser navigation to protected routes works
    const isProd = process.env.NODE_ENV === 'production'
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isProd, // secure cookies in prod
      sameSite: isProd ? 'lax' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      user: adminCredentials.user,
      token: token,
    })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// Optional: logout clears the cookie
app.post('/auth/logout', (_req, res) => {
  res.clearCookie('admin_token', { path: '/' })
  res.json({ success: true })
})

app.get('/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const token = authHeader.substring(7)

  try {
    // Decode the simple token (in production, use proper JWT verification)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())

    if (payload.exp < Date.now()) {
      res.status(401).json({ error: 'Token expired' })
      return
    }

    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Insufficient privileges' })
      return
    }

    // Return user data
    res.json({
      id: payload.userId,
      email: 'admin@example.com',
      role: payload.role,
      name: 'Admin User',
    })
  } catch (_error) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// Protected Drizzle Studio proxy route

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
