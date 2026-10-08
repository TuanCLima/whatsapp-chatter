import OpenAI from 'openai'
import 'dotenv/config'
import { and, eq, gt } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from './db'
import {
  type InsertMessage,
  type Message,
  messages,
  saasUsers,
  users,
} from './db/schema-postgres'
import { getNextMessages } from './getNextMessages'
import { twilioClientPool } from './services/TwilioClientPool'
import { logError, twilioLogger, webhookLogger } from './utils/logger'

const IS_DEV_OTHER = process.env.NODE_ENV === 'development'

const API_KEY = process.env.LLM_API_KEY

import { getSaoPauloDate } from './mcp/mcpService'
import { sseService } from './services/SSEService'
import {
  checkAndRejectMultimedia,
  convertToLLMMessages,
  ensureUserExists,
  handleRefereeQuestions,
  saveAssistantMessages,
  sendTwilioMessages,
} from './services/WebhookHelpers'
import { QUESTION_SENT_TO_REFEREE } from './utils/contants'
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
  OriginalRepliedMessageSid?: string // The MessageSid of the quoted/replied message
  OriginalRepliedMessageSender?: string // The sender of the original replied message
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

async function getQuotedDbMessage({
  quotedMessageSid,
}: {
  quotedMessageSid: string | undefined
}): Promise<Message | null> {
  if (!quotedMessageSid) {
    return null
  }

  webhookLogger.debug(
    {
      quotedMessageSid,
    },
    'Quoted message detected, checking for contactReferee',
  )

  try {
    const quotedDbMessage = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(
            messages.content,
            JSON.stringify({
              success: true,
              message: QUESTION_SENT_TO_REFEREE,
              data: quotedMessageSid,
            }),
          ),
        ),
      )
      .limit(1)

    if (quotedDbMessage.length === 0) {
      return null
    }

    webhookLogger.debug(
      {
        quotedMessageId: quotedDbMessage[0].id,
        role: quotedDbMessage[0].role,
        phoneNumber: quotedDbMessage[0].phoneNumber,
        toolCallId: quotedDbMessage[0].toolCallId,
      },
      'Found quoted message in database',
    )

    return quotedDbMessage[0]
  } catch (error) {
    logError(webhookLogger, error, {
      context: 'quoted_message_check',
      quotedMessageSid,
    })
    return null
  }
}

/**
 * Check if a message is a reply to a contactReferee tool message
 * and extract the tool call information for creating a response
 */
async function checkForRefereeToolResponse(
  answerMessage: string,
  quotedDbMessage?: Message | null,
): Promise<Message | null> {
  if (!quotedDbMessage) {
    return null
  }

  try {
    return (
      await db
        .update(messages)
        .set({
          content: JSON.stringify({
            success: true,
            refereeAnswer: answerMessage,
          }),
        })
        .where(eq(messages.id, quotedDbMessage.id))
        .returning()
    )[0]
  } catch (error) {
    logError(webhookLogger, error, {
      context: 'referee_tool_response',
    })
    return null
  }
}

// New SaaS webhook function that uses user-specific Twilio credentials
export async function whatsappSaasWebhook(
  req: Request<Record<string, never>, unknown, TwilioFormData>,
  res: Response,
) {
  const body = req.body
  const { To, Body: message, OriginalRepliedMessageSid } = body
  let { From: _from, ProfileName } = body

  const quotedMessage = await getQuotedDbMessage({
    quotedMessageSid: OriginalRepliedMessageSid,
  })

  if (quotedMessage) {
    _from = quotedMessage.phoneNumber

    const quotedUser = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, quotedMessage.phoneNumber))
      .limit(1)
    if (quotedUser.length > 0) {
      ProfileName = quotedUser[0].profileName
    }

    webhookLogger.info(
      {
        quotedMessageId: quotedMessage.id,
        quotedMessagePhoneNumber: quotedMessage.phoneNumber,
        quotedMessageProfileName: ProfileName,
      },
      '🔔 QuotedUser Data',
    )
  }

  // Log the incoming webhook call
  webhookLogger.info(
    {
      timestamp: new Date().toISOString(),
      from: _from,
      to: To,
      profileName: ProfileName,
      messageLength: message?.length || 0,
      messageSid: body.MessageSid,
      originalRepliedMessageSid: OriginalRepliedMessageSid,
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

    // Check if this message is from a referee and send pending questions
    const isRefereeHandled = await handleRefereeQuestions(
      saasUser[0].id,
      from,
      name,
      message,
      body.MessageSid,
      res,
    )

    if (isRefereeHandled) {
      return
    }

    // Get user-specific Twilio client and credentials using the SaaS user ID
    const { client: userClient, credentials } =
      await twilioClientPool.getClientBySaasUserId(saasUser[0].id)

    // --- Early exit for multimedia messages ---
    const isMultimediaRejected = await checkAndRejectMultimedia(
      body as Record<string, string | undefined>,
      from,
      _from,
      userClient,
      credentials.whatsappNumber,
      res,
    )

    if (isMultimediaRejected) {
      return
    }

    const messagesFeed: InsertMessage[] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.phoneNumber, from),
          gt(messages.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      ) // Last 24 hours
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

    // Ensure user exists and get conversation status
    const { conversationDisabled } = await ensureUserExists(from, name)

    // Check if this message is a reply to a contactReferee message
    const refereeToolAnswerMessage = OriginalRepliedMessageSid
      ? await checkForRefereeToolResponse(message, quotedMessage)
      : null

    // At messageFeed, replace the array's item with refereeToolAnswerMessage where id = refereeToolAnswerMessage.id
    if (refereeToolAnswerMessage) {
      const index = messagesFeed.findIndex(
        (m) => m.id === refereeToolAnswerMessage.id,
      )

      if (index !== -1) {
        messagesFeed.splice(index, 1)
      }
      messagesFeed.push(refereeToolAnswerMessage)
    }

    if (!quotedMessage) {
      await db.insert(messages).values({
        phoneNumber: from,
        role: 'user',
        content: message,
        profileName: name,
        toolCallId: null,
        toolCalls: null,
        messageSid: body.MessageSid, // Store Twilio MessageSid
      } as InsertMessage)
    }

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
    if (conversationDisabled) {
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

    const chatMessages = convertToLLMMessages(messagesFeed)

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
      ProfileName,
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

    await saveAssistantMessages(newMessagesForFeed, from, name)

    // Send messages using user's Twilio credentials
    const assistantMessages = newMessagesForFeed.filter(
      (m) => m.role === 'assistant',
    )

    try {
      await sendTwilioMessages(
        assistantMessages,
        userClient,
        credentials.whatsappNumber,
        _from,
      )
    } catch (error) {
      logError(twilioLogger, error, {
        context: 'twilio_send',
        from: _from,
      })
      abortControllers[from] = undefined
      res.status(500).json({ error: 'Error sending message' })
      return
    }

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
