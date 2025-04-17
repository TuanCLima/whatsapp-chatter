import axios from "axios";
import { PORT } from "..";
import { openai } from "../webhook";
import { ChatMessage, Maybe } from "../types/types";
import { FetchCalendarEventsProps } from "./mcpService";

const LLM_MODEL = process.env.LLM_MODEL;

export async function handleLLMDateRequest({
  messages,
  apiResponse,
  toolCallId,
  functionName,
  parameters,
  dataToContentCB,
}: {
  messages: ChatMessage[];
  apiResponse: string | null;
  toolCallId: string;
  functionName: string;
  parameters: Maybe<Record<string, unknown>> | FetchCalendarEventsProps;
  dataToContentCB: (_: any) => any;
}) {
  const mcpResponse = await axios.post(
    `http://localhost:${PORT}/api/mcp/execute`,
    {
      functionName,
      parameters,
    }
  );

  const dateInfo = mcpResponse.data;

  messages.push({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: toolCallId, // This ID will be referenced in the tool response
        type: "function",
        function: {
          name: functionName,
          arguments: JSON.stringify(parameters),
        },
      },
    ],
  });

  // Add the function response to messages
  messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    name: functionName,
    content: JSON.stringify(dataToContentCB(dateInfo)),
  });

  // Get a new completion with the function result
  const secondCompletion = await openai.chat.completions.create({
    model: LLM_MODEL!,
    messages: messages,
  });

  apiResponse = secondCompletion.choices[0].message.content ?? "";
  const toolsCalls = secondCompletion.choices[0].message.tool_calls ?? "";

  console.log("### 2", { apiResponse, toolsCalls });

  return apiResponse;
}
