import OpenAI from "openai";

type Maybe<T> = T | undefined | null;

export type { Maybe };

export type ChatMessage =
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name: string;
    }
  | {
      role: "user" | "system";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    };
