import { eq } from 'drizzle-orm'
import { inspect } from 'util'
import { db } from './db'
import { userSaasUserMapping } from './db/schema-postgres'
import { toolCall } from './mcp/toolCall'
import { dateTool } from './mcp/toolConfig/toolConfig'
import {
  executeCustomTool,
  executePredefinedTool,
  getCustomToolImplementation,
  getToolsForPhoneNumber,
  isPredefinedTool,
} from './services/CustomToolExecutor'
import type { ChatMessage } from './types/types'
import { LLM_MODEL, openai } from './webhook'

/**
 * Get SaaS user ID from phone number using the user mapping table
 */
async function getSaasUserIdFromPhoneNumber(
  phoneNumber: string,
): Promise<string | null> {
  try {
    const result = await db
      .select({
        saasUserId: userSaasUserMapping.saasUserId,
      })
      .from(userSaasUserMapping)
      .where(eq(userSaasUserMapping.phoneNumber, phoneNumber))
      .limit(1)

    return result.length > 0 ? result[0].saasUserId : null
  } catch (error) {
    console.error('Error getting SaaS user ID from phone number:', error)
    return null
  }
}

// Get built-in tools
const builtInTools = [dateTool]

export async function getNextMessages(
  messagesFeed: ChatMessage[],
  phoneNumber: string,
  signal?: AbortSignal,
) {
  const newMessagesForFeed: ChatMessage[] = []

  // Get all tools including custom ones
  const allTools = phoneNumber
    ? await getToolsForPhoneNumber(phoneNumber, builtInTools)
    : []

  // console.log('### allTools', inspect(allTools, { depth: 4 }))

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

  if (content) {
    newMessagesForFeed.push({
      role: 'assistant',
      content,
    })
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
      } else if (isPredefinedTool(functionName)) {
        // Execute predefined tool (like calendar functions)
        try {
          // Get the SaaS user ID from phone number
          const userId = phoneNumber
            ? await getSaasUserIdFromPhoneNumber(phoneNumber)
            : null

          if (!userId) {
            throw new Error('User not found or not linked to SaaS account')
          }

          toolResponse = await executePredefinedTool(
            functionName,
            JSON.parse(_arguments),
            phoneNumber,
            userId,
          )
        } catch (error) {
          console.error(
            `Error executing predefined tool ${functionName}:`,
            error,
          )
          toolResponse = {
            error: `Predefined tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  return newMessagesForFeed
}
