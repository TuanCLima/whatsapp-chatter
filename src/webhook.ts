import OpenAI from "openai";
import Twilio from "twilio";
import "dotenv/config";
import { Request, Response } from "express";
import { parseLLMMessages } from "./utils/parseLLMMessages";
import { getSaoPauloDate } from "./mcp/mcpService";

import { ChatMessage } from "./types/types";
import { getNextMessages } from "./getNextMessages";
import { IS_DEV } from "./utils/contants";

const API_KEY = process.env.LLM_API_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

import { faker } from "@faker-js/faker";

// const LLM_BASE_URL = "https://api.deepseek.com";
// export const LLM_MODEL = "deepseek-chat";
const LLM_BASE_URL = "https://api.openai.com/v1";
export const LLM_MODEL = "gpt-4.1";

export const openai = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: API_KEY,
});

const history: Record<string, ChatMessage[]> = {};

const client = Twilio(accountSid, authToken);

type TwilioFormData = {
  From: string;
  Body: string;
  ProfileName: string;
};

export async function whatsappHonoWebhook(
  req: Request<{}, {}, TwilioFormData>,
  res: Response
) {
  const body = req.body;
  const { From: from, Body: message, ProfileName } = body;

  const name = IS_DEV ? faker.internet.username() : ProfileName;
  const profileNameTag = `<ProfileName>${name}</ProfileName>`;
  const messagesFeed = history[from] || [
    {
      role: "system",
      content: process.env.MYPROMPT,
    },
  ];

  const phoneNumber = `<Telefone>${from}</Telefone>`;

  messagesFeed.push({
    role: "user",
    content: `${message}\n<Timestamp>${
      getSaoPauloDate().currentDate
    }</Timestamp>${
      messagesFeed.length === 1 ? `${profileNameTag}${phoneNumber}` : ""
    }`,
  });

  try {
    const newMessagesForFeed = await getNextMessages(messagesFeed);

    if (!newMessagesForFeed || newMessagesForFeed.length === 0) {
      res.status(500).json({ error: "No new messages" });
      return;
    }

    messagesFeed.push(...newMessagesForFeed);

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
                to: from, // Recipient's WhatsApp number
                mediaUrl: [toSendMessage.text],
              });
              await new Promise((resolve) => setTimeout(resolve, 700)); // Wait for 1 second before sending the next message
            } else {
              await client.messages.create({
                from: fromNumber,
                to: from,
                body: toSendMessage.text.replace(/\*\*/g, "*"),
              });
            }
          }
        } catch (error) {
          await client.messages.create({
            from: fromNumber,
            to: from,
            body: "Houve um erro ao enviar a mensagem. Tente novamente mais tarde, por favor.",
          });
          console.error("Error sending message:", error);
          res.json({ status: "Received", from, message });
          return;
        }
      });

    history[from] = messagesFeed;

    console.log("Messages history:\n", history[from]);

    res.json({ status: "Received", from, message });
    return;
  } catch (error) {
    res.status(500).json({ Error: "Catch" });
    console.error("Error:", error);
  }
}
