import OpenAI from 'openai'
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from './db'
import {
  type InsertMessage,
  messages,
  saasUsers,
  userSaasUserMapping,
  users,
} from './db/schema-postgres'
import { getNextMessages } from './getNextMessages'
import { twilioClientPool } from './services/TwilioClientPool'
import type { ChatMessage } from './types/types'
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
  Body: string
  ProfileName: string
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
  req: Request<{ webhookPath: string }, unknown, TwilioFormData>,
  res: Response,
) {
  const body = req.body
  const { From: _from, Body: message, ProfileName } = body
  const webhookPath = `/webhook/${req.params.webhookPath}`

  const from =
    IS_DEV_OTHER && fakes[indexSelected]?.from
      ? fakes[indexSelected]?.from
      : _from

  const name =
    IS_DEV_OTHER && fakes[indexSelected]?.profileName
      ? fakes[indexSelected]?.profileName
      : ProfileName

  try {
    // Get user-specific Twilio client and credentials
    const { client: userClient, credentials } =
      await twilioClientPool.getClientByWebhookPath(webhookPath)

    // Get the SaaS user ID for this webhook path
    const saasUser = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.webhookPath, webhookPath))
      .limit(1)

    if (!saasUser.length) {
      throw new Error('SaaS user not found for webhook path')
    }

    const saasUserId = saasUser[0].id

    // --- Early exit for audio messages ---
    try {
      const numMediaRaw = body.NumMedia
      const numMedia = numMediaRaw ? parseInt(numMediaRaw, 10) : 0
      if (numMedia > 0) {
        let hasAudio = false
        for (let i = 0; i < numMedia; i++) {
          const contentType: string | undefined = body[`MediaContentType${i}`]
          if (contentType?.toLowerCase().startsWith('audio')) {
            hasAudio = true
            break
          }
        }
        if (hasAudio) {
          // Inform user that audio messages are not allowed and exit early
          await userClient.messages.create({
            from: credentials.whatsappNumber,
            to: _from,
            body: 'Mensagens de áudio não são permitidas por enquanto. Favor tentar enviar uma mensagem de texto.',
          })
          res.json({
            status: 'Rejected audio message',
            from,
            reason: 'audio_not_allowed',
          })
          return
        }
      }
    } catch (e) {
      console.error('Error while checking media types', e)
    }

    const messagesFeed: InsertMessage[] = await db
      .select()
      .from(messages)
      .where(eq(messages.phoneNumber, from))
      .orderBy(messages.timestamp)

    const customPrompt = await getInitialPromptForPhoneNumber(from)

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
      await db.insert(users).values({
        phoneNumber: from,
        profileName: name,
        conversationDisabled: false,
      })

      // Create the mapping between this WhatsApp user and the SaaS user
      await db.insert(userSaasUserMapping).values({
        phoneNumber: from,
        saasUserId: saasUserId,
      })
    } else if (existingUser[0].profileName !== name) {
      await db
        .update(users)
        .set({ profileName: name })
        .where(eq(users.phoneNumber, from))

      // Check if mapping already exists for this phone number
      const existingMapping = await db
        .select()
        .from(userSaasUserMapping)
        .where(eq(userSaasUserMapping.phoneNumber, from))
        .limit(1)

      // Create mapping if it doesn't exist
      if (existingMapping.length === 0) {
        await db.insert(userSaasUserMapping).values({
          phoneNumber: from,
          saasUserId: saasUserId,
        })
      }
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
      console.log('Aborting previous request for', from)
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

    const newMessagesForFeed = await getNextMessages(
      chatMessages,
      from,
      abortController.signal,
    )

    if (!newMessagesForFeed || newMessagesForFeed.length === 0) {
      abortControllers[from] = undefined
      res.status(500).json({ error: 'No new messages' })
      return
    }

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
    newMessagesForFeed
      .filter((m) => m.role === 'assistant')
      .forEach(async (m) => {
        if (!m.content) {
          return
        }

        const toSendMessages = parseLLMMessages(m.content)
        try {
          for (const toSendMessage of toSendMessages) {
            if (toSendMessage.isContactLink) {
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
                console.log('Empty message detected')
                continue
              }
              await userClient.messages.create({
                from: credentials.whatsappNumber,
                to: _from,
                body,
              })
            }
          }
        } catch (error) {
          console.error('Error sending message:', error)
          abortControllers[from] = undefined
          res.status(500).json({ error: 'Error sending message' })
          return
        }
      })

    abortControllers[from] = undefined
    res.json({ status: 'Received', from, message })
    return
  } catch (error) {
    console.error('SaaS webhook error:', error)
    abortControllers[from] = undefined

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: 'Webhook path not found' })
    } else if (
      error instanceof Error &&
      error.message.includes('credentials')
    ) {
      res.status(400).json({ error: 'Twilio credentials not configured' })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
