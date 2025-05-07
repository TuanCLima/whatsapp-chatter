type Maybe<T> = T | undefined | null;

export type { Maybe };

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: {
    text: string;
    timestamp: string;
    status: "sent" | "delivered" | "read";
    unread?: number;
  };
  online?: boolean;
  typing?: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  isMedia?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "document" | "audio";
}

export interface Conversation {
  id: string;
  contactId: string;
  messages: Message[];
}
