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
