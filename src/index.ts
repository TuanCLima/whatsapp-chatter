import express from "express";
import { whatsappHonoWebhook } from "./webhook";
import path from "path";
import mcpRouter from "./server/mcpServer";
import Twilio from "twilio";
import "dotenv/config";
import {
  getUniqueWhatsAppContacts,
  getWhatsAppConversationByContactId,
  getWhatsAppConversations,
} from "./utils/twilioMessages";
import cors from "cors";

export const PORT = process.env.PORT ?? 3000;
const app = express();
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST"], // Allow only GET and POST methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

export const twilioClient = Twilio(accountSid, authToken);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.resolve(__dirname, "../dist/public")));

app.use("/api/mcp", mcpRouter);
app.post("/webhook", whatsappHonoWebhook);

// Serve React UI for all other routes
app.get("/", (_, res) => {
  res.sendFile(path.resolve(__dirname, "../dist/public/index.html"));
});

app.get("/contacts", async (req, res) => {
  try {
    const contacts = await getUniqueWhatsAppContacts();
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

app.get("/conversations", async (req, res) => {
  try {
    const conversations = await getWhatsAppConversations();
    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.get("/conversations/:contactId", async (req, res) => {
  const { contactId } = req.params;
  try {
    const conversation = await getWhatsAppConversationByContactId(contactId);
    res.status(200).json(conversation ?? null);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Send a message
app.post("/send-message", async (req, res) => {
  const { conversationSid, body } = req.body;
  try {
    const message = await twilioClient.conversations.v1
      .conversations(conversationSid)
      .messages.create({ body });
    res.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at port: ${PORT}`);
});

export default app;
