import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { twilioClient } from "..";
import { Contact, Conversation, Maybe, Message } from "../types/types";

const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER_LOGS;

export async function getUniqueWhatsAppContacts(): Promise<Contact[]> {
  const messages = await twilioClient.messages.list({
    limit: 100, // adjust based on how many messages you want to process
  });

  const contactsMap = new Map<string, Contact>();

  messages.forEach((msg) => {
    // Only include incoming WhatsApp messages
    if (msg.direction === "inbound" && msg.from.startsWith("whatsapp:")) {
      const id = msg.from;
      if (!contactsMap.has(id)) {
        contactsMap.set(id, {
          id,
          name: id, // Placeholder for name, as Twilio API does not provide contact names
          avatar: "", // Placeholder for avatar
        });
      }
    }
  });

  return Array.from(contactsMap.values());
}

export function getContactId(to: string, from: string): string {
  if (to === WHATSAPP_NUMBER) {
    return from;
  }

  return to;
}

export async function getWhatsAppConversations(): Promise<Conversation[]> {
  const messages = await twilioClient.messages.list({
    limit: 20, // Adjust based on how many messages you want to process
  });

  const conversationsMap = new Map<string, Conversation>();

  messages.forEach(async (msg) => {
    if (msg.from.startsWith("whatsapp:") || msg.to.startsWith("whatsapp:")) {
      const contactId = getContactId(msg.to, msg.from);
      const conversation = conversationsMap.get(contactId) || {
        id: contactId,
        contactId,
        messages: [],
      };

      let text = msg.body;

      if (msg.body === "") {
        // fetch media data from api
        text = await getVCFFileName(msg);
      }

      const message: Message = {
        id: msg.sid,
        text: `[Link para contato da ${text}]`,
        sender: contactId,
        timestamp: msg.dateSent?.toISOString() || "",
        status: msg.status as "sent" | "delivered" | "read",
      };

      conversation.messages.push(message);
      conversationsMap.set(contactId, conversation);
    }
  });

  return Array.from(conversationsMap.values());
}

async function getVCFFileName(msg: MessageInstance): Promise<string> {
  const mediaList = await twilioClient.messages(msg.sid).media.list();
  if (mediaList.length > 0) {
    const media = mediaList[0]; // Assuming the first media file is the one we need
    const mediaUrl = `https://api.twilio.com${media.uri.replace(".json", "")}`;

    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString("base64");
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (response.ok) {
      const vcfFile = await response.text();

      return getFileNameFromVCF(vcfFile);
    } else {
      console.error(`Failed to fetch media: ${response.statusText}`);
      return "";
    }
  }

  return "";
}

export async function getWhatsAppConversationByContactId(
  contactId: string
): Promise<Maybe<Conversation>> {
  const messages = await twilioClient.messages.list({
    limit: 200, // Adjust based on how many messages you want to process
  });

  const conversationsMap = new Map<string, Conversation>();

  for (const msg of messages) {
    if (msg.from.startsWith("whatsapp:") || msg.to.startsWith("whatsapp:")) {
      const contactId = getContactId(msg.to, msg.from);
      const conversation = conversationsMap.get(contactId) || {
        id: contactId,
        contactId,
        messages: [],
      };

      let text;
      if (msg.body === "") {
        text = `[Link para contato da ${await getVCFFileName(msg)}]`;
      } else {
        text = msg.body;
      }

      if (msg.status === "failed") {
        text = "";
      }

      const message: Message = {
        id: msg.sid,
        text,
        sender: msg.from,
        timestamp: msg.dateSent?.toISOString() || "",
        status: msg.status as "sent" | "delivered" | "read",
      };

      conversation.messages.push(message);
      conversationsMap.set(contactId, conversation);
    }
  }

  return conversationsMap.get(contactId);
}

function getFileNameFromVCF(vcfFile: string) {
  const lines = vcfFile.split("\n");
  for (const line of lines) {
    if (line.startsWith("FN:")) {
      return line.substring(3).trim(); // Remove "FN:" and trim whitespace
    }
  }
  return ""; // Return empty string if no name found
}
