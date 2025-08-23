import { inspect } from 'node:util'
import { toolCall } from './mcp/toolCall'
import {
  cancelEventTool,
  cancellationRulesConfigTool,
  checkAndCancelEventIfEligibleTool,
  checkEventAvailabilityTool,
  checkEventCancellationEligibilityTool,
  createEventTool,
  dateTool,
  fetchEventsTool,
  getProfessionalLinkContactToAttachInAnswerTool,
  getSalonInfoTool,
  servicesTool,
  suggestEventTimesTool,
} from './mcp/toolConfig/toolConfig'
import {
  executeCustomTool,
  getCustomToolImplementation,
  getToolsForPhoneNumber,
} from './services/CustomToolExecutor'
import type { ChatMessage } from './types/types'
import { LLM_MODEL, openai } from './webhook'

export async function getNextMessages(
  messagesFeed: ChatMessage[],
  phoneNumber?: string,
  signal?: AbortSignal,
) {
  const newMessagesForFeed: ChatMessage[] = []

  // Get built-in tools
  const builtInTools = [
    dateTool,
    getSalonInfoTool,
    servicesTool,
    cancellationRulesConfigTool,
    fetchEventsTool,
    checkEventAvailabilityTool,
    checkEventCancellationEligibilityTool,
    checkAndCancelEventIfEligibleTool,
    createEventTool,
    getProfessionalLinkContactToAttachInAnswerTool,
    cancelEventTool,
    suggestEventTimesTool,
  ]

  // Get all tools including custom ones
  const allTools = phoneNumber
    ? await getToolsForPhoneNumber(phoneNumber, builtInTools)
    : builtInTools

  const completion = await openai.chat.completions.create(
    {
      model: LLM_MODEL,
      messages: messagesFeed,
      tools: allTools,
      tool_choice: 'auto',
    },
    {
      signal,
    },
  )

  const { tool_calls, content } = completion.choices[0].message

  // console.log(
  //   'LLM completion:',
  //   inspect(
  //     { tool_calls, tContent: content?.slice(0, 50) },
  //     { depth: null, maxStringLength: null, colors: true },
  //   ),
  // )

  if (content && tool_calls && tool_calls.length > 0) {
    console.error(
      'LLM completion is returning content and tool calls at the same time. This is not expected.',
    )
    return []
  }

  if (tool_calls && tool_calls.length > 0) {
    for (const tool_call of tool_calls) {
      const { function: functionCall } = tool_call
      const { arguments: _arguments } = functionCall
      const functionName = functionCall.name

      newMessagesForFeed.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: tool_call.id,
            type: 'function',
            function: {
              name: functionName,
              arguments: _arguments,
            },
          },
        ],
      })

      let toolResponse: unknown

      // Check if this is a custom tool
      const customImplementation = phoneNumber
        ? await getCustomToolImplementation(
            functionName,
            undefined,
            phoneNumber,
          )
        : null

      if (customImplementation) {
        // Execute custom tool
        try {
          toolResponse = await executeCustomTool(
            functionName,
            JSON.parse(_arguments),
            customImplementation,
          )
        } catch (error) {
          console.error(`Error executing custom tool ${functionName}:`, error)
          toolResponse = {
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }
        }
      } else {
        // Execute built-in tool via MCP server
        toolResponse = await toolCall({
          functionName,
          parameters: JSON.parse(_arguments),
        })
      }

      // console.log(
      //   '### tool_calls loop',
      //   inspect({ toolResponse }, { depth: 2 }),
      // )

      newMessagesForFeed.push({
        role: 'tool',
        tool_call_id: tool_call.id,
        name: functionName,
        content: JSON.stringify(toolResponse),
      })
    }
  }

  if (tool_calls && tool_calls.length > 0) {
    try {
      const newMessages = await getNextMessages(
        [...messagesFeed, ...newMessagesForFeed],
        phoneNumber,
        signal,
      )
      newMessagesForFeed.push(...newMessages)

      return newMessagesForFeed
    } catch (error) {
      console.error('Error calling MCP server:', error)
    }
  }

  if (content) {
    newMessagesForFeed.push({
      role: 'assistant',
      content,
    })
  }

  return newMessagesForFeed
}
