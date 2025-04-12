import axios from "axios";
import { PORT } from "..";
import { openai } from "../webhook";
import { ChatMessage } from "../types/types";

export async function handleLLMDateRequest(
  messages: ChatMessage[],
  apiResponse: string | null,
  toolCallId: string
) {
  const mcpResponse = await axios.post(
    `http://localhost:${PORT}/api/mcp/execute`,
    {
      functionName: "getSaoPauloDate",
      parameters: {},
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
          name: "getSaoPauloDate",
          arguments: JSON.stringify({}),
        },
      },
    ],
  });

  // Add the function response to messages
  messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    name: "getSaoPauloDate",
    content: JSON.stringify(dateInfo),
  });

  // Get a new completion with the function result
  const secondCompletion = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: messages,
  });

  apiResponse = secondCompletion.choices[0].message.content ?? "";
  return apiResponse;
}
