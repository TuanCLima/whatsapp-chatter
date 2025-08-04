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
import { db } from "./db";
import { users, messages } from "./db/schema";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { Contact, Conversation, Message } from "./types/types";

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

app.get("/db/contacts", async (req, res) => {
  try {
    // Get all users from database
    const dbUsers = await db.select().from(users);
    
    // Convert users to contacts format
    const contacts: Contact[] = await Promise.all(
      dbUsers.map(async (user) => {
        // Get the latest message for this user to show as lastMessage
        const latestMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.phoneNumber, user.phoneNumber))
          .orderBy(desc(messages.timestamp))
          .limit(1);

        const contact: Contact = {
          id: user.phoneNumber,
          name: user.profileName || user.phoneNumber,
          avatar: "", // You might want to add avatar support to your schema
          lastMessage: latestMessage.length > 0 ? {
            text: latestMessage[0].content || "",
            timestamp: latestMessage[0].timestamp,
            status: "delivered" as const,
          } : undefined,
          online: false, // You might want to add online status to your schema
          typing: false,
        };

        return contact;
      })
    );

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching DB contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts from database" });
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

// Database-powered conversations route (alternative to WhatsApp API)
app.get("/db/conversations", async (req, res) => {
  try {
    // Get all users from database
    const dbUsers = await db.select().from(users);
    
    // Convert users to conversations format
    const conversations: Conversation[] = await Promise.all(
      dbUsers.map(async (user) => {
        // Get messages for this user
        const userMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.phoneNumber, user.phoneNumber))
          .orderBy(messages.timestamp);

        // Convert database messages to frontend format
        const conversationMessages: Message[] = userMessages.map((msg) => ({
          id: msg.id.toString(),
          text: msg.content || "",
          sender: msg.role === "user" ? user.phoneNumber : "assistant",
          timestamp: msg.timestamp,
          status: "delivered" as const,
        }));

        return {
          id: user.phoneNumber,
          contactId: user.phoneNumber,
          messages: conversationMessages,
        };
      })
    );

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching DB conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations from database" });
  }
});

// Get specific conversation from database
app.get("/db/conversations/:contactId", async (req, res) => {
  const { contactId } = req.params;
  try {
    // Get user from database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, contactId))
      .limit(1);

    if (user.length === 0) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Get messages for this user
    const userMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.phoneNumber, contactId), or(eq(messages.role, "user"), and(eq(messages.role, "assistant"), ne(messages.content, "")))))
      .orderBy(desc(messages.timestamp));

    // Convert database messages to frontend format
    const conversationMessages: Message[] = userMessages.map((msg) => ({
      id: msg.id.toString(),
      text: msg.content || "",
      sender: msg.role === "user" ? contactId : "assistant",
      timestamp: msg.timestamp,
      status: "delivered" as const,
    }));

    const conversation: Conversation = {
      id: contactId,
      contactId: contactId,
      messages: conversationMessages,
    };

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Error fetching DB conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation from database" });
  }
});

// Send a message
app.post("/send-message", async (req, res) => {
  const { phoneNumber, body } = req.body;

  
  if (!phoneNumber || !body) {
    res.status(400).json({ error: "Phone number and message body are required" });
    return;
  }

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER, 
      to: phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`,
      body: body,
    });


    await db.insert(messages).values({
      phoneNumber: phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`,
      role: "assistant",
      content: body,
      toolCallId: null,
      toolCalls: null,
    });

    res.json({
      sid: message.sid,
      status: message.status,
      dateCreated: message.dateCreated,
      body: message.body,
      to: message.to,
      from: message.from,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Authentication endpoints
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return 
  }

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: "Admin credentials not configured" });
    return 
  }

  // Simple hardcoded admin credentials for demo
  // In production, you would hash passwords and store in database
  const adminCredentials = {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD, // In production, this should be hashed
    user: {
      id: "1",
      email: process.env.ADMIN_EMAIL,
      role: "admin" as const,
      name: "Admin User",
    }
  };

  if (email === adminCredentials.email && password === adminCredentials.password) {
    // Generate a simple JWT token (in production, use proper JWT library)
    const token = Buffer.from(JSON.stringify({
      userId: adminCredentials.user.id,
      role: adminCredentials.user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })).toString('base64');

    res.json({
      user: adminCredentials.user,
      token: token
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.get("/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7);
  
  try {
    // Decode the simple token (in production, use proper JWT verification)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    if (payload.exp < Date.now()) {
      return res.status(401).json({ error: "Token expired" });
    }

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: "Insufficient privileges" });
    }

    // Return user data
    res.json({
      id: payload.userId,
      email: "admin@example.com",
      role: payload.role,
      name: "Admin User",
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at port: ${PORT}`);
});

export default app;
