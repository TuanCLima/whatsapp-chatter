"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappHonoWebhook = whatsappHonoWebhook;
const openai_1 = __importDefault(require("openai"));
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_KEY = process.env.LLM_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const openai = new openai_1.default({
    baseURL: DEEPSEEK_API_URL,
    apiKey: API_KEY,
});
const history = {};
const client = (0, twilio_1.default)(accountSid, authToken);
function getMessages(text) {
    const matches = [
        ...text.matchAll(/<MediaUrl>(https?:\/\/[^<]+)<\/MediaUrl>/g),
    ];
    const parts = text
        .split(/<MediaUrl>https?:\/\/[^<]+<\/MediaUrl>/g)
        .filter((s) => !!s.replace(/[\s\uFEFF\u200B]+/, ""));
    const mediaUrls = matches.map((match) => match[1]);
    const messages = [];
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
async function whatsappHonoWebhook(c) {
    console.log("###", "whatsappHonoWebhook");
    const body = await c.req.parseBody();
    const { From: from, Body: message } = body;
    const messages = history[from] || [
        {
            role: "system",
            content: process.env.PROMPT,
        },
    ];
    messages.push({ role: "user", content: message });
    try {
        console.log("###", { messages });
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat", // Specify the model
            messages: messages,
        });
        let apiResponse = completion.choices[0].message.content;
        if (!apiResponse) {
            return c.json({ error: "No response from DeepSeek" }, 400);
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
            }
            else {
                await client.messages.create({
                    from: fromNumber, // Your Twilio WhatsApp number
                    to: from, // Recipient's WhatsApp number
                    body: toSendMessage.text,
                });
            }
        }
        return c.json({ status: "Received", from, message });
    }
    catch (error) {
        console.error("Error calling DeepSeek API:", error);
        return c.json({ error: "Failed to process message" }, 500);
    }
}
/* export async function whatsappWebhook(fastify: FastifyInstance) {
  fastify.post(
    "/webhook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;

      // Extract message details
      const from = body.From; // WhatsApp sender
      const message = body.Body; // Message content

      const messages = history[from] || [
        {
          role: "system",
          content: PROMPT,
        },
      ];

      messages.push({ role: "user", content: message });

      try {
        console.log("###", { messages });
        const completion = await openai.chat.completions.create({
          model: "deepseek-chat", // Specify the model
          messages: messages,
        });

        let apiResponse = completion.choices[0].message.content;

        if (!apiResponse) {
          return reply.status(400).send({ error: "No response from DeepSeek" });
        }

        const toSendMessages = getMessages(apiResponse);
        console.log(
          "DeepSeek Response:",
          completion.choices[0].message.content,
          { toSendMessages }
        );

        history[from] = [
          ...messages,
          { role: "assistant", content: apiResponse },
        ];

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
        return reply.send({ status: "Received", from, message });
      } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        return reply.status(500).send({ error: "Failed to process message" });
      }
    }
  );
} */
