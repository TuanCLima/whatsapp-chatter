import OpenAI from "openai";
import Twilio from "twilio";
import "dotenv/config";
import { Request, Response } from "express";

const API_KEY = process.env.LLM_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const openai = new OpenAI({
  baseURL: DEEPSEEK_API_URL,
  apiKey: API_KEY,
});

const history: Record<
  string,
  { role: "system" | "user" | "assistant"; content: string }[]
> = {};

const client = Twilio(accountSid, authToken);

type Message = { text: string; isContactLink: boolean };

function getMessages(text: string): Message[] {
  const matches = [
    ...text.matchAll(/<MediaUrl>(https?:\/\/[^<]+)<\/MediaUrl>/g),
  ];

  const parts = text
    .split(/<MediaUrl>https?:\/\/[^<]+<\/MediaUrl>/g)
    .filter((s) => !!s.replace(/[\s\uFEFF\u200B]+/, ""));

  const mediaUrls = matches.map((match) => match[1]);

  const messages: Message[] = [];

  console.log({ parts });

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].trim()) {
      messages.push({
        text: parts[i].trim(),
        isContactLink: false,
      });

      if (mediaUrls[i]) {
        messages.push({
          text: mediaUrls[i].trim(),
          isContactLink: true,
        });
      }
    }
  }

  if (parts.length === 0) {
    for (const mediaUrl of mediaUrls) {
      if (mediaUrl.trim()) {
        messages.push({
          text: mediaUrl.trim(),
          isContactLink: true,
        });
      }
    }
  }

  return messages;
}

type TwilioFormData = {
  From: string;
  Body: string;
};

export async function whatsappHonoWebhook(
  req: Request<{}, {}, TwilioFormData>,
  res: Response
) {
  const body = req.body;
  const { From: from, Body: message } = body;

  const messages = history[from] || [
    {
      role: "system",
      content: process.env.MYPROMPT,
    },
  ];

  messages.push({ role: "user", content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: messages,
    });

    let apiResponse = completion.choices[0].message.content;

    if (!apiResponse) {
      res.status(400).json({ error: "No response from DeepSeek" });
      return;
    }

    const toSendMessages = getMessages(apiResponse);
    console.log("DeepSeek Response:", completion.choices[0].message.content, {
      toSendMessages,
    });

    history[from] = [...messages, { role: "assistant", content: apiResponse }];

    for (const toSendMessage of toSendMessages) {
      if (toSendMessage.isContactLink) {
        await client.messages.create({
          from: fromNumber, // Your Twilio WhatsApp number
          to: from, // Recipient's WhatsApp number
          mediaUrl: [toSendMessage.text],
        });
      } else {
        await client.messages.create({
          from: fromNumber, // Your Twilio WhatsApp number
          to: from, // Recipient's WhatsApp number
          body: toSendMessage.text,
        });
      }
    }

    res.json({ status: "Received", from, message });
    return;
  } catch (error) {
    res.status(500).json({ Error: "Catch" });
    console.error("Error:", error);
  }
}
