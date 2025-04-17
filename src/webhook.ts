import OpenAI from "openai";
import Twilio from "twilio";
import "dotenv/config";
import { Request, Response } from "express";
import { parseLLMMessages } from "./utils/parseLLMMessages";
import { FetchCalendarEventsProps, getSaoPauloDate } from "./mcp/mcpService";
import {
  createEventTool,
  dateTool,
  fetchEventsTool,
  getSalonInfo,
  servicesTool,
} from "./mcp/toolConfig/toolConfig";
import { handleLLMDateRequest } from "./mcp/chatHandlers";
import { ChatMessage } from "./types/types";

const API_KEY = process.env.LLM_API_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const LLM_BASE_URL = "https://api.deepseek.com";
export const LLM_MODEL = "deepseek-chat";

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

  console.log("###", { body: JSON.stringify(body) });

  const profileNameTag = `<ProfileName>${ProfileName}</ProfileName>`;
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
    }</Timestamp>${messages.length === 1 ? profileNameTag : ""}`,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      tools: [
        dateTool,
        getSalonInfo,
        servicesTool,
        fetchEventsTool,
        createEventTool,
      ],
      tool_choice: "auto",
    });

    let apiResponse = completion.choices[0].message.content;
    const toolCalls = completion.choices[0].message.tool_calls;

    console.log("### message", JSON.stringify(completion.choices[0].message));

    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const { function: functionCall } = toolCall;
        const { name, arguments: _arguments } = functionCall;
        if (
          name === "getSaoPauloDate" ||
          name === "getAllServicesTable" ||
          name === "getSalonInfo"
        ) {
          try {
            apiResponse = await handleLLMDateRequest({
              messages,
              apiResponse,
              toolCallId: toolCall.id,
              functionName: name,
              parameters: {},
              dataToContentCB: (data) => data,
            });
          } catch (error) {
            console.error("Error calling MCP server:", error);
            res.status(500).json({ error: "Error calling MCP server" });
            return;
          }
        }

        if (name === "fetchCalendarEvents") {
          const parameters = JSON.parse(_arguments) as FetchCalendarEventsProps;
          try {
            apiResponse = await handleLLMDateRequest({
              messages,
              apiResponse,
              toolCallId: toolCall.id,
              functionName: name,
              parameters,
              dataToContentCB: (data: any[]) => {
                const events = data.map((event) => {
                  const {
                    id,
                    status,
                    created,
                    summary,
                    // description,
                    creator,
                    organizer,
                    start,
                    end,
                    sequence,
                    attendees,
                    eventType,
                  } = event;

                  return {
                    id,
                    status,
                    created,
                    summary,
                    // description,
                    creator,
                    organizer,
                    start,
                    end,
                    sequence,
                    attendees,
                    eventType,
                  };
                });

                return events;
              },
            });
          } catch (error) {
            console.error("Error calling MCP server:", error);
            res.status(500).json({ error: "Error calling MCP server" });
            return;
          }
        }

        if (name === "createCalendarEvent") {
          const parameters = JSON.parse(_arguments) as FetchCalendarEventsProps;
          try {
            apiResponse = await handleLLMDateRequest({
              messages,
              apiResponse,
              toolCallId: toolCall.id,
              functionName: name,
              parameters,
              dataToContentCB: (data: any[]) => data,
            });
          } catch (error) {
            console.error("Error calling MCP server:", error);
            res.status(500).json({ error: "Error calling MCP server" });
            return;
          }
        }
      }
    }

    if (!apiResponse) {
      res.status(400).json({ error: "No response from DeepSeek" });
      return;
    }

    const toSendMessages = parseLLMMessages(apiResponse);
    console.log(
      "History:",
      history[from]?.filter((m) => m.role !== "system")
    );

    history[from] = [...messages, { role: "assistant", content: apiResponse }];

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
          from: fromNumber, // Your Twilio WhatsApp number
          to: from, // Recipient's WhatsApp number
          body: toSendMessage.text.replace(/\*\*/g, "*"),
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
