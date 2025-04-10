import OpenAI from "openai";
import Twilio from "twilio";
import axios from "axios";
import "dotenv/config";
import { Request, Response } from "express";
import { parseLLMMessages } from "./utils/parseLLMMessages";
import { getSaoPauloDate } from "./mcp/mcpService";

const API_KEY = process.env.LLM_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const openai = new OpenAI({
  baseURL: DEEPSEEK_API_URL,
  apiKey: API_KEY,
});

type ChatMessage =
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name: string;
    }
  | {
      role: "user" | "assistant" | "system";
      content: string;
    };

const history: Record<string, ChatMessage[]> = {};

const client = Twilio(accountSid, authToken);

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

  messages.push({
    role: "user",
    content: `${message}\n<Timestamp>${
      getSaoPauloDate().currentDate
    }</Timestamp>`,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: messages,
      tools: [
        {
          type: "function",
          function: {
            name: "getSaoPauloDate",
            description: "Get the current date and time in São Paulo, Brazil",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    let apiResponse = completion.choices[0].message.content;
    const toolCalls = completion.choices[0].message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const { function: functionCall } = toolCall;
        const { name } = functionCall;
        if (name === "getSaoPauloDate") {
          // Call our MCP server
          const mcpResponse = await axios.post(
            "http://localhost:3000/api/mcp/execute",
            {
              functionName: "getSaoPauloDate",
              parameters: {},
            }
          );

          const dateInfo = mcpResponse.data;

          // Add the function response to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: "getSaoPauloDate",
            content: JSON.stringify(dateInfo),
          });

          // Get a new completion with the function result
          const secondCompletion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: messages,
          });

          apiResponse = secondCompletion.choices[0].message.content ?? "";
        }
      }
    }

    if (!apiResponse) {
      res.status(400).json({ error: "No response from DeepSeek" });
      return;
    }

    const toSendMessages = parseLLMMessages(apiResponse);
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
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for 1 second before sending the next message
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
