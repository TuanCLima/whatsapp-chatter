import { eq } from 'drizzle-orm'
import type { Response } from 'express'
import type OpenAI from 'openai'
import type Twilio from 'twilio'
import { db } from '../db'
import {
  type InsertMessage,
  type Message,
  messages,
  users,
} from '../db/schema-postgres'
import type { ChatMessage } from '../types/types'
import { QUESTION_SENT_TO_REFEREE } from '../utils/contants'
import { logError, twilioLogger, webhookLogger } from '../utils/logger'
import { parseLLMMessages } from '../utils/parseLLMMessages'
import {
  getInitialPromptForPhoneNumber,
  noWhatsPhoneNumber,
} from '../utils/utils'
import { predefinedToolsService } from './PredefinedToolsService'
import { sseService } from './SSEService'

interface LLMMessage {
  role: string
  content: string | null
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  tool_call_id?: string
  doNotAddToHistory?: boolean
}

/**
 * Handle referee-specific logic: check if message is from referee and send pending questions
 */
export async function handleRefereeQuestions(
  saasUserId: string,
  from: string,
  name: string,
  message: string,
  messageSid: string,
  res: Response,
): Promise<boolean> {
  try {
    const refereeConfig = await predefinedToolsService.getToolConfig(
      saasUserId,
      'referee_contact',
    )

    if (!refereeConfig?.configData) {
      return false
    }

    const config = refereeConfig.configData as { refereePhoneNumber: string }
    const normalizedFrom = noWhatsPhoneNumber(from)
    const normalizedReferee = noWhatsPhoneNumber(config.refereePhoneNumber)

    if (normalizedFrom !== normalizedReferee) {
      return false
    }

    webhookLogger.info(
      { refereePhone: normalizedFrom },
      'Message from referee detected, sending pending questions',
    )

    const result = await predefinedToolsService.sendPendingQuestions(
      normalizedReferee,
      saasUserId,
    )

    if (!result.success || result.sentCount === 0) {
      return false
    }

    webhookLogger.info(
      { sentCount: result.sentCount },
      'Pending questions sent to referee',
    )

    // Update database with sent question SIDs
    for (const q of result.questions) {
      if (q.toolCallId) {
        const quotedDbMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.toolCallId, q.toolCallId))
          .limit(1)

        if (quotedDbMessage.length > 0) {
          await db
            .update(messages)
            .set({
              content: JSON.stringify({
                success: true,
                message: QUESTION_SENT_TO_REFEREE,
                data: q.sid,
              }),
            })
            .where(eq(messages.id, quotedDbMessage[0].id))
        }
      }
    }

    // Save user message to database
    await db.insert(messages).values({
      phoneNumber: from,
      role: 'user',
      content: message,
      profileName: name,
      toolCallId: null,
      toolCalls: null,
      messageSid,
    } as InsertMessage)

    res.json({ status: 'Pending questions sent to referee' })
    return true
  } catch (error) {
    webhookLogger.error(
      { error },
      'Error checking/sending pending questions to referee',
    )
    return false
  }
}

/**
 * Check for multimedia content and reject if present
 */
export async function checkAndRejectMultimedia(
  body: Record<string, string | undefined>,
  from: string,
  _from: string,
  userClient: Twilio.Twilio,
  whatsappNumber: string,
  res: Response,
): Promise<boolean> {
  try {
    const numMediaRaw = body.NumMedia
    const numMedia = numMediaRaw ? parseInt(numMediaRaw, 10) : 0

    if (numMedia === 0) {
      return false
    }

    webhookLogger.debug({ numMedia, from }, 'Checking multimedia content')

    let hasMultimedia = false
    for (let i = 0; i < numMedia; i++) {
      const contentType = body[`MediaContentType${i}`]
      if (contentType) {
        hasMultimedia = true
        webhookLogger.info(
          { from, contentType, mediaIndex: i },
          'Multimedia message detected',
        )
        break
      }
    }

    if (!hasMultimedia) {
      return false
    }

    webhookLogger.info({ from }, 'Rejecting multimedia message - not supported')

    await userClient.messages.create({
      from: whatsappNumber,
      to: _from,
      body: 'Nosso sistema não é capaz de ler essa mensagem por enquanto, favor utilizar texto.',
    })

    res.json({
      status: 'Rejected multimedia message',
      from,
      reason: 'multimedia_not_supported',
    })

    return true
  } catch (e) {
    logError(webhookLogger, e, {
      context: 'multimedia_check',
      from,
    })
    return false
  }
}

/**
 * Ensure user exists in database and update profile name if needed
 */
export async function ensureUserExists(
  from: string,
  name: string,
): Promise<{ conversationDisabled: boolean }> {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, from))
    .limit(1)

  if (existingUser.length === 0) {
    webhookLogger.info({ from, profileName: name }, 'Creating new user')

    await db.insert(users).values({
      phoneNumber: from,
      profileName: name,
      conversationDisabled: false,
    })

    sseService.notifyContactUpdate(from, name)

    return { conversationDisabled: false }
  }

  if (existingUser[0].profileName !== name) {
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

    sseService.notifyContactUpdate(from, name)
  }

  return { conversationDisabled: existingUser[0].conversationDisabled || false }
}

/**
 * Build the complete message feed for LLM processing
 */
export async function buildMessageFeed(
  from: string,
  to: string,
  refereeToolAnswerMessage: Message | null,
): Promise<InsertMessage[]> {
  const messagesFeed: InsertMessage[] = await db
    .select()
    .from(messages)
    .where(eq(messages.phoneNumber, from))
    .orderBy(messages.timestamp)

  webhookLogger.debug(
    { from, messageCount: messagesFeed.length },
    'Loaded message history',
  )

  const customPrompt = await getInitialPromptForPhoneNumber(to)

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

  // Replace referee answer message if present
  if (refereeToolAnswerMessage) {
    const index = messagesFeed.findIndex(
      (m) => m.id === refereeToolAnswerMessage.id,
    )

    if (index !== -1) {
      messagesFeed.splice(index, 1)
    }
    messagesFeed.push(refereeToolAnswerMessage)
  }

  return messagesFeed
}

/**
 * Convert LLM messages to chat messages format
 */
export function convertToLLMMessages(
  messagesFeed: InsertMessage[],
): ChatMessage[] {
  return messagesFeed.map((m) => {
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
}

/**
 * Transform LLM response messages to database format and save
 */
export async function saveAssistantMessages(
  newMessagesForFeed: LLMMessage[],
  from: string,
  name: string,
): Promise<InsertMessage[]> {
  const newMessagesForDB = newMessagesForFeed
    .filter((m) => !m.doNotAddToHistory)
    .map((m, index) => {
      let toolCallId: string | null = null
      let toolCalls: string | null = null

      if (m.role === 'tool') {
        toolCallId = m.tool_call_id ?? null
      }

      if (m.role === 'assistant') {
        toolCalls = JSON.stringify(m.tool_calls)
      }

      const timestamp = new Date(Date.now() + index)

      return {
        phoneNumber: from,
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
        profileName: name,
        toolCallId,
        toolCalls,
        timestamp,
      } as InsertMessage
    })

  await db.insert(messages).values(newMessagesForDB)

  webhookLogger.debug(
    { from, savedMessageCount: newMessagesForDB.length },
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

  return newMessagesForDB
}

/**
 * Send assistant messages via Twilio
 */
export async function sendTwilioMessages(
  assistantMessages: LLMMessage[],
  userClient: Twilio.Twilio,
  whatsappNumber: string,
  to: string,
): Promise<void> {
  webhookLogger.info(
    { from: to, assistantMessageCount: assistantMessages.length },
    'Sending messages via Twilio',
  )

  for (const m of assistantMessages) {
    if (!m.content) {
      continue
    }

    const toSendMessages = parseLLMMessages(m.content)

    for (const toSendMessage of toSendMessages) {
      if (toSendMessage.isContactLink) {
        twilioLogger.debug(
          { from: to, messageType: 'contact' },
          'Sending contact card via Twilio',
        )

        await userClient.messages.create({
          from: whatsappNumber,
          to,
          mediaUrl: [toSendMessage.text],
          body: 'Contato compartilhado',
        })
        await new Promise((resolve) => setTimeout(resolve, 700))
      } else {
        const body = toSendMessage.text.replace(/\*\*/g, '*')
        if (!body) {
          webhookLogger.warn({ from: to }, '⚠️ Empty message detected, skipping')
          continue
        }

        twilioLogger.debug(
          { from: to, messageLength: body.length },
          'Sending text message via Twilio',
        )

        await userClient.messages.create({
          from: whatsappNumber,
          to,
          body,
        })
      }
    }
  }
}
