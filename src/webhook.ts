import OpenAI from 'openai'
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from './db'
import {
  type InsertMessage,
  messages,
  saasUsers,
  users,
} from './db/schema-postgres'
import { getNextMessages } from './getNextMessages'
import { twilioClientPool } from './services/TwilioClientPool'
import type { ChatMessage } from './types/types'
import { logError, twilioLogger, webhookLogger } from './utils/logger'
import { parseLLMMessages } from './utils/parseLLMMessages'

const IS_DEV_OTHER = process.env.NODE_ENV === 'development'

const API_KEY = process.env.LLM_API_KEY

import { getSaoPauloDate } from './mcp/mcpService'
import { sseService } from './services/SSEService'
import { getInitialPromptForPhoneNumber } from './utils/utils'

const LLM_BASE_URL = 'https://api.openai.com/v1'
export const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4.1'

export const openai = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: API_KEY,
})

const abortControllers: Record<string, AbortController | undefined> = {}

// Helper function to create time-aware context message
function createTimeAwareContextMessage(name: string, from: string) {
  const currentTime = getSaoPauloDate()

  return {
    role: 'system' as const,
    content: JSON.stringify({
      contextType: 'current_interaction',
      profileName: name,
      phoneNumber: from,
      currentDateTime: currentTime.currentDate,
      timeZone: currentTime.timezone,
      timestamp: currentTime.iso8601,
      message: `Conversa iniciada em ${currentTime.currentDate} (${currentTime.timezone}). Use a ferramenta getSaoPauloDate se precisar de informações de tempo atualizadas durante a conversa.`,
    }),
    phoneNumber: from,
  }
}

type TwilioFormData = {
  From: string
  To: string
  Body: string
  ProfileName: string
  MessageSid: string // The unique Twilio message SID
  NumMedia?: string // Twilio sends number of media items as a string
  // Dynamic media content type & url fields (MediaContentType0, MediaUrl0, ...)
  [key: string]: string | undefined
}

const fakes = [
  {
    from: 'whatsapp:+5511999999999',
    profileName: 'João',
  },
  {
    from: 'whatsapp:+5511988888888',
    profileName: 'Maria',
  },
  {
    from: 'whatsapp:+5511977777777',
    profileName: 'Carlos',
  },
  {
    from: 'whatsapp:+5511966666666',
    profileName: 'Ana',
  }, // 3
  {
    from: 'whatsapp:+5511955555555',
    profileName: 'Pedro',
  }, // 4
  {
    from: 'whatsapp:+5511944444444',
    profileName: 'Luiza',
  }, // 5
  {
    from: 'whatsapp:+5511933333333',
    profileName: 'Fernanda',
  }, // 6
  {
    from: 'whatsapp:+5511922222222',
    profileName: 'Roberto',
  }, // 7
]

const indexSelected = -1

// New SaaS webhook function that uses user-specific Twilio credentials
export async function whatsappSaasWebhook(
  req: Request<Record<string, never>, unknown, TwilioFormData>,
  res: Response,
) {
  const body = req.body
  const { From: _from, To, Body: message, ProfileName } = body

  // Log the incoming webhook call
  webhookLogger.info(
    {
      timestamp: new Date().toISOString(),
      from: _from,
      to: To,
      profileName: ProfileName,
      messageLength: message?.length || 0,
      messageSid: body.MessageSid,
      numMedia: body.NumMedia,
      isDev: IS_DEV_OTHER,
    },
    '🔔 Webhook received',
  )

  const from =
    IS_DEV_OTHER && fakes[indexSelected]?.from
      ? fakes[indexSelected]?.from
      : _from

  const name =
    IS_DEV_OTHER && fakes[indexSelected]?.profileName
      ? fakes[indexSelected]?.profileName
      : ProfileName

  try {
    // Get the SaaS user data
    webhookLogger.debug(
      { phoneNumber: To },
      'Looking up SaaS user by Twilio number',
    )

    const saasUser = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.twilioWhatsappNumber, To))
      .limit(1)

    if (!saasUser.length) {
      webhookLogger.error(
        { phoneNumber: To },
        'SaaS user not found for Twilio number',
      )
      throw new Error('SaaS user not found')
    }

    webhookLogger.debug(
      {
        saasUserId: saasUser[0].id,
        twilioNumber: To,
      },
      'SaaS user found',
    )

    // Get user-specific Twilio client and credentials using the SaaS user ID
    const { client: userClient, credentials } =
      await twilioClientPool.getClientBySaasUserId(saasUser[0].id)

    // --- Early exit for multimedia messages ---
    try {
      const numMediaRaw = body.NumMedia
      const numMedia = numMediaRaw ? parseInt(numMediaRaw, 10) : 0
      if (numMedia > 0) {
        webhookLogger.debug({ numMedia, from }, 'Checking multimedia content')

        // Check if there's any multimedia content
        let hasMultimedia = false
        for (let i = 0; i < numMedia; i++) {
          const contentType: string | undefined = body[`MediaContentType${i}`]
          if (contentType) {
            hasMultimedia = true
            webhookLogger.info(
              {
                from,
                contentType,
                mediaIndex: i,
              },
              'Multimedia message detected',
            )
            break
          }
        }
        if (hasMultimedia) {
          webhookLogger.info(
            { from },
            'Rejecting multimedia message - not supported',
          )

          // Inform user that multimedia messages are not supported and exit early
          await userClient.messages.create({
            from: credentials.whatsappNumber,
            to: _from,
            body: 'Nosso sistema não é capaz de ler essa mensagem por enquanto, favor utilizar texto.',
          })
          res.json({
            status: 'Rejected multimedia message',
            from,
            reason: 'multimedia_not_supported',
          })
          return
        }
      }
    } catch (e) {
      logError(webhookLogger, e, {
        context: 'multimedia_check',
        from,
      })
    }

    const messagesFeed: InsertMessage[] = await db
      .select()
      .from(messages)
      .where(eq(messages.phoneNumber, from))
      .orderBy(messages.timestamp)

    webhookLogger.debug(
      {
        from,
        messageCount: messagesFeed.length,
      },
      'Loaded message history',
    )

    const customPrompt = await getInitialPromptForPhoneNumber(To)

    const initialMessageCommon: InsertMessage = {
      phoneNumber: from,
      role: 'system',
      content: customPrompt,
    }

    messagesFeed.unshift({
      ...initialMessageCommon,
      toolCallId: null,
      toolCalls: null,
    })

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, from))
      .limit(1)

    if (existingUser.length === 0) {
      webhookLogger.info(
        {
          from,
          profileName: name,
        },
        'Creating new user',
      )

      await db.insert(users).values({
        phoneNumber: from,
        profileName: name,
        conversationDisabled: false,
      })
    } else if (existingUser[0].profileName !== name) {
      webhookLogger.debug(
        {
          from,
          oldName: existingUser[0].profileName,
          newName: name,
        },
        'Updating user profile name',
      )

      await db
        .update(users)
        .set({ profileName: name })
        .where(eq(users.phoneNumber, from))
    }

    // Check if conversation is disabled for this user
    const isConversationDisabled =
      existingUser.length > 0 && existingUser[0].conversationDisabled

    await db.insert(messages).values({
      phoneNumber: from,
      role: 'user',
      content: message,
      profileName: name,
      toolCallId: null,
      toolCalls: null,
    } as InsertMessage)

    webhookLogger.debug(
      {
        from,
        messageLength: message.length,
      },
      'User message saved to database',
    )

    // Emit SSE notification for new user message
    sseService.notifyNewMessage(from, {
      id: `${Date.now()}`, // Simple ID for now
      content: message,
      role: 'user',
      timestamp: new Date().toISOString(),
      profileName: name,
    })

    // If conversation is disabled, just acknowledge receipt without processing
    if (isConversationDisabled) {
      webhookLogger.info(
        { from },
        'Conversation disabled - skipping processing',
      )
      res.json({ status: 'Received (conversation disabled)', from, message })
      return
    }

    // Add current time context to the system message
    messagesFeed.push(createTimeAwareContextMessage(name, from))

    messagesFeed.push({
      role: 'user',
      content: message,
      phoneNumber: from,
      profileName: name,
      toolCallId: null,
      toolCalls: null,
    } as InsertMessage)

    if (abortControllers[from]) {
      webhookLogger.info({ from }, '🛑 Aborting previous request')
      abortControllers[from]?.abort()
      abortControllers[from] = undefined
    }

    const abortController = new AbortController()
    abortControllers[from] = abortController

    const chatMessages = messagesFeed.map((m) => {
      return {
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls
          ? (JSON.parse(
              m.toolCalls,
            ) as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[])
          : undefined,
        tool_call_id: m.toolCallId,
      } as ChatMessage
    })

    webhookLogger.debug(
      {
        from,
        messageCount: chatMessages.length,
        model: LLM_MODEL,
      },
      'Calling getNextMessages',
    )

    const newMessagesForFeed = await getNextMessages(
      chatMessages,
      To,
      from,
      abortController.signal,
    )

    if (!newMessagesForFeed || newMessagesForFeed.length === 0) {
      webhookLogger.error({ from }, '❌ No new messages generated')
      abortControllers[from] = undefined
      res.status(500).json({ error: 'No new messages' })
      return
    }

    webhookLogger.info(
      {
        from,
        newMessageCount: newMessagesForFeed.length,
      },
      'New messages generated successfully',
    )

    const newMessagesForDB = newMessagesForFeed.map((m, index) => {
      let toolCallId: string | null = null
      let toolCalls: string | null = null

      if (m.role === 'tool') {
        toolCallId = m.tool_call_id
      }

      if (m.role === 'assistant') {
        toolCalls = JSON.stringify(m.tool_calls)
      }

      const timestamp = new Date(Date.now() + index)

      return {
        phoneNumber: from,
        role: m.role,
        content: m.content,
        profileName: name,
        toolCallId,
        toolCalls,
        timestamp,
      }
    })

    await db.insert(messages).values(newMessagesForDB)

    webhookLogger.debug(
      {
        from,
        savedMessageCount: newMessagesForDB.length,
      },
      'Assistant messages saved to database',
    )

    // Emit SSE notifications for new assistant messages
    newMessagesForDB
      .filter((m) => m.role === 'assistant' && m.content)
      .forEach((m) => {
        sseService.notifyNewMessage(from, {
          id: `${m.timestamp?.getTime() || Date.now()}`,
          content: m.content!,
          role: 'assistant',
          timestamp: m.timestamp?.toISOString() || new Date().toISOString(),
          profileName: name,
        })
      })

    // Send messages using user's Twilio credentials
    const assistantMessages = newMessagesForFeed.filter(
      (m) => m.role === 'assistant',
    )

    webhookLogger.info(
      {
        from,
        assistantMessageCount: assistantMessages.length,
      },
      'Sending messages via Twilio',
    )

    assistantMessages.forEach(async (m) => {
      if (!m.content) {
        return
      }

      const toSendMessages = parseLLMMessages(m.content)
      try {
        for (const toSendMessage of toSendMessages) {
          if (toSendMessage.isContactLink) {
            twilioLogger.debug(
              {
                from: _from,
                messageType: 'contact',
              },
              'Sending contact card via Twilio',
            )

            await userClient.messages.create({
              from: credentials.whatsappNumber,
              to: _from,
              mediaUrl: [toSendMessage.text],
              body: 'Contato compartilhado',
            })
            await new Promise((resolve) => setTimeout(resolve, 700))
          } else {
            const body = toSendMessage.text.replace(/\*\*/g, '*')
            if (!body) {
              webhookLogger.warn(
                { from: _from },
                '⚠️ Empty message detected, skipping',
              )
              continue
            }

            twilioLogger.debug(
              {
                from: _from,
                messageLength: body.length,
              },
              'Sending text message via Twilio',
            )

            await userClient.messages.create({
              from: credentials.whatsappNumber,
              to: _from,
              body: body,
            })
          }
        }
      } catch (error) {
        logError(twilioLogger, error, {
          context: 'twilio_send',
          from: _from,
        })
        abortControllers[from] = undefined
        res.status(500).json({ error: 'Error sending message' })
        return
      }
    })

    abortControllers[from] = undefined
    webhookLogger.info(
      {
        from,
        status: 'success',
      },
      '✅ Webhook processing completed successfully',
    )
    res.json({ status: 'Received', from, message })
    return
  } catch (error) {
    abortControllers[from] = undefined

    if (
      error instanceof Error &&
      error.message.includes('SaaS user mapping not found')
    ) {
      logError(webhookLogger, error, {
        context: 'saas_user_mapping',
        phoneNumber: To,
      })
      res
        .status(404)
        .json({ error: 'Phone number not assigned to any SaaS user' })
    } else if (
      error instanceof Error &&
      error.message.includes('SaaS user not found')
    ) {
      logError(webhookLogger, error, {
        context: 'saas_user_lookup',
        phoneNumber: To,
      })
      res.status(404).json({ error: 'SaaS user configuration not found' })
    } else if (
      error instanceof Error &&
      error.message.includes('credentials')
    ) {
      logError(webhookLogger, error, {
        context: 'twilio_credentials',
        phoneNumber: To,
      })
      res.status(400).json({ error: 'Twilio credentials not configured' })
    } else {
      logError(webhookLogger, error, {
        context: 'webhook_processing',
        from,
        to: To,
      })
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
