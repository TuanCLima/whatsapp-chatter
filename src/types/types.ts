import OpenAI from "openai";
import { FetchCalendarEventsProps } from "../mcp/mcpService";

type Maybe<T> = T | undefined | null;

export type { Maybe };

export type ChatMessage =
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name: string;
      debugLevel?: number;
    }
  | {
      role: "user" | "system";
      content: string;
      debugLevel?: number;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
      debugLevel?: number;
    };

export type CallLLMProps = {
  messagesFeed: ChatMessage[];
  toolCallId?: string;
  functionName?: string;
  parameters?: Maybe<Record<string, unknown>> | FetchCalendarEventsProps;
  dataToContentCB?: (_: any) => any;
};

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
