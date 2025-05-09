import { toolCall } from "./mcp/toolCall";
import {
  cancelEventTool,
  cancellationRulesConfigTool,
  createEventTool,
  dateTool,
  fetchEventsTool,
  getProfessionalLinkContactToAttachInAnswerTool,
  getSalonInfoTool,
  servicesTool,
} from "./mcp/toolConfig/toolConfig";
import { ChatMessage } from "./types/types";
import { LLM_MODEL, openai } from "./webhook";

export async function getNextMessages(messagesFeed: ChatMessage[]) {
  const newMessagesForFeed: ChatMessage[] = [];
  const completion = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: messagesFeed,
    tools: [
      dateTool,
      getSalonInfoTool,
      servicesTool,
      cancellationRulesConfigTool,
      fetchEventsTool,
      createEventTool,
      getProfessionalLinkContactToAttachInAnswerTool,
      cancelEventTool,
    ],
    tool_choice: "auto",
  });

  const { tool_calls, content } = completion.choices[0].message;

  if (content && tool_calls && tool_calls.length > 0) {
    console.error(
      "LLM completion is returning content and tool calls at the same time. This is not expected."
    );
  }

  if (tool_calls && tool_calls.length > 0) {
    for (const tool_call of tool_calls) {
      const { function: functionCall } = tool_call;
      const { arguments: _arguments } = functionCall;
      const functionName = functionCall.name;

      newMessagesForFeed.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: tool_call.id,
            type: "function",
            function: {
              name: functionName,
              arguments: _arguments,
            },
          },
        ],
      });

      const toolResponse = await toolCall({
        functionName,
        parameters: JSON.parse(_arguments),
      });

      newMessagesForFeed.push({
        role: "tool",
        tool_call_id: tool_call.id,
        name: functionName,
        content: JSON.stringify(toolResponse),
      });

      try {
        const newMessages = await getNextMessages([
          ...messagesFeed,
          ...newMessagesForFeed,
        ]);
        newMessagesForFeed.push(...newMessages);
      } catch (error) {
        console.error("Error calling MCP server:", error);
      }
    }
  }

  if (content) {
    newMessagesForFeed.push({
      role: "assistant",
      content,
    });
  }

  return newMessagesForFeed;
}
