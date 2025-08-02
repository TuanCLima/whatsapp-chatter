import OpenAI from "openai";
import Twilio from "twilio";
import "dotenv/config";
import { Request, Response } from "express";
import { parseLLMMessages } from "./utils/parseLLMMessages";

import { ChatMessage } from "./types/types";
import { getNextMessages } from "./getNextMessages";
import { IS_DEV } from "./utils/contants";

import { db, initializeDatabase } from "./db";
import { InsertMessage, messages, users } from "./db/schema";
import { eq } from "drizzle-orm";

const API_KEY = process.env.LLM_API_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

import { getSaoPauloDate } from "./mcp/mcpService";
import { getInitialPrompt } from "./utils/utils";

// const LLM_BASE_URL = "https://api.deepseek.com";
// export const LLM_MODEL = "deepseek-chat";
const LLM_BASE_URL = "https://api.openai.com/v1";
export const LLM_MODEL = "gpt-4.1";

export const openai = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: API_KEY,
});

// Initialize the database when the application starts
initializeDatabase().catch(console.error);

const abortControllers: Record<string, AbortController | undefined> = {};

const client = Twilio(accountSid, authToken);

// Helper function to create time-aware context message
function createTimeAwareContextMessage(name: string, from: string) {
  const currentTime = getSaoPauloDate();
  
  return {
    role: "system" as const,
    content: JSON.stringify({
      contextType: "current_interaction",
      profileName: name,
      phoneNumber: from,
      currentDateTime: currentTime.currentDate,
      timeZone: currentTime.timezone,
      timestamp: currentTime.iso8601,
      message: `Conversa iniciada em ${currentTime.currentDate} (${currentTime.timezone}). Use a ferramenta getSaoPauloDate se precisar de informações de tempo atualizadas durante a conversa.`
    }),
    phoneNumber: from,
  };
}

type TwilioFormData = {
  From: string;
  Body: string;
  ProfileName: string;
};

const fakes = [
  {
    from: "whatsapp:+5511999999999",
    profileName: "João",
  },
  {
    from: "whatsapp:+5511988888888",
    profileName: "Maria",
  },
  {
    from: "whatsapp:+5511977777777",
    profileName: "Carlos",
  },
  {
    from: "whatsapp:+5511966666666",
    profileName: "Ana",
  },
  {
    from: "whatsapp:+5511955555555",
    profileName: "Pedro",
  },
  {
    from: "whatsapp:+5511944444444",
    profileName: "Luiza",
  },
  {
    from: "whatsapp:+5511933333333",
    profileName: "Fernanda",
  },
  { from: "whatsapp:+5511922222222",
    profileName: "Roberto",
  },
]

const indexSelected = 7

export async function whatsappHonoWebhook(
  req: Request<{}, {}, TwilioFormData>,
  res: Response
) {
  const body = req.body;
  const { From: _from, Body: message, ProfileName } = body;
  const from = (IS_DEV && fakes[indexSelected]?.from) ? fakes[indexSelected]?.from : _from;

  let name = (IS_DEV && fakes[indexSelected]?.profileName) ? fakes[indexSelected]?.profileName : ProfileName;

  let messagesFeed: InsertMessage[] = await db
    .select()
    .from(messages)
    .where(eq(messages.phoneNumber, from))
    .orderBy(messages.timestamp);

  const initialMessageCommon: InsertMessage = {
      phoneNumber: from,
      role: "system",
      content: getInitialPrompt(),
    };
  
  messagesFeed.unshift({
        ...initialMessageCommon,
        toolCallId: null,
        toolCalls: null,
  })

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, from))
    .limit(1);

  if (existingUser.length === 0) {
    await db.insert(users).values({
      phoneNumber: from,
      profileName: name,
    });
  } else if (existingUser[0].profileName !== name) {
    await db.update(users).set({ profileName: name }).where(eq(users.phoneNumber, from));
  }

  await db.insert(messages).values({
    phoneNumber: from,
    role: "user",
    content: message,
    profileName: name,
    toolCallId: null,
    toolCalls: null,
  } as InsertMessage);

  // Add current time context to the system message. Not added to the database, but to the messages feed
  messagesFeed.push(createTimeAwareContextMessage(name, from));

  messagesFeed.push({
    role: "user",
    content: message,
    phoneNumber: from,
    profileName: name,
    toolCallId: null,
    toolCalls: null,
  } as InsertMessage);

  if (abortControllers[from]) {
    console.log("Aborting previous request for", from);
    abortControllers[from].abort();
    abortControllers[from] = undefined;
  }

  const abortController = new AbortController();
  abortControllers[from] = abortController;

  const chatMessages = messagesFeed.map((m) => {
    return {
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls
        ? (JSON.parse(
            m.toolCalls
          ) as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[])
        : undefined,
      tool_call_id: m.toolCallId,
    } as ChatMessage;
  });

  try {
    const newMessagesForFeed = await getNextMessages(
      chatMessages,
      abortController.signal
    );

    if (!newMessagesForFeed || newMessagesForFeed.length === 0) {
      abortControllers[from] = undefined;
      res.status(500).json({ error: "No new messages" });
      return;
    }

    const newMessagesForDB = newMessagesForFeed.map((m, idx) => {
      let toolCallId;
      let toolCalls;

      if (m.role === "tool") {
        toolCallId = m.tool_call_id;
      }

      if (m.role === "assistant") {
        toolCalls = JSON.stringify(m.tool_calls);
      }
      // Create a new message object for the feed
      return {
        phoneNumber: from,
        role: m.role,
        content: m.content,
        profileName: name,
        toolCallId,
        toolCalls,
      };
    });

    messagesFeed.push(...newMessagesForDB);

    await db.insert(messages).values(newMessagesForDB);

    newMessagesForFeed
      .filter((m) => m.role === "assistant")
      .forEach(async (m) => {
        if (!m.content) {
          return;
        }

        const toSendMessages = parseLLMMessages(m.content);
        try {
          for (const toSendMessage of toSendMessages) {
            if (toSendMessage.isContactLink) {
              await client.messages.create({
                from: fromNumber, // Your Twilio WhatsApp number
                to: _from, // Recipient's WhatsApp number
                mediaUrl: [toSendMessage.text],
                body: "Contato compartilhado" // Adding body text for media messages
              });
              await new Promise((resolve) => setTimeout(resolve, 700)); // Wait for 1 second before sending the next message
            } else {
              await client.messages.create({
                from: fromNumber,
                to: _from,
                body: toSendMessage.text.replace(/\*\*/g, "*"),
              });
            }
          }
        } catch (error) {
          console.error("Error sending message:", error);
          abortControllers[from] = undefined;
          res.status(500).json({ error: "Error sending message" });
          return;
        }
      });

    console.log("Messages history:\n", messagesFeed);
    abortControllers[from] = undefined;
    res.json({ status: "Received", from, message });
    return;
  } catch (error) {
    abortControllers[from] = undefined;
    res.status(500).json({ Error: "Catch" });
    console.error("Error:", error);
  }
}
