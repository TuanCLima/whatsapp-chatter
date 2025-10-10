import { inspect } from 'node:util'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { saasUsers } from './db/schema-postgres'
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
import { logError, messageLogger, toolLogger } from './utils/logger'
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
        saasUserId: saasUsers.id,
      })
      .from(saasUsers)
      .where(eq(saasUsers.twilioWhatsappNumber, phoneNumber))
      .limit(1)

    return result.length > 0 ? result[0].saasUserId : null
  } catch (error) {
    logError(messageLogger, error, {
      context: 'get_saas_user_id',
      phoneNumber,
    })
    return null
  }
}

// Get built-in tools
const builtInTools = [dateTool]

export async function getNextMessages(
  messagesFeed: ChatMessage[],
  phoneNumber: string,
  callersPhoneNumber: string,
  signal?: AbortSignal,
  depth = 0,
) {
  messageLogger.debug(
    {
      phoneNumber,
      callersPhoneNumber,
      messageCount: messagesFeed.length,
      depth,
    },
    'getNextMessages called',
  )

  const newMessagesForFeed: ChatMessage[] = []

  // Get all tools including custom ones
  const allTools = phoneNumber
    ? await getToolsForPhoneNumber(phoneNumber, builtInTools)
    : []

  if (depth > 5) {
    messageLogger.warn(
      {
        depth,
        phoneNumber,
        callersPhoneNumber,
      },
      'Max recursion depth reached in getNextMessages',
    )
    return newMessagesForFeed
  }

  messageLogger.debug(
    {
      toolCount: allTools.length,
      tools: allTools.map((t) => t.function?.name).filter(Boolean),
    },
    'Tools loaded for phone number',
  )

  messageLogger.debug(
    {
      model: LLM_MODEL,
      messageCount: messagesFeed.length,
    },
    'Calling OpenAI chat completions API',
  )

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

  messageLogger.debug(
    {
      hasContent: !!content,
      toolCallCount: tool_calls?.length || 0,
      finishReason: completion.choices[0].finish_reason,
    },
    'OpenAI response received',
  )

  if (content) {
    messageLogger.debug(
      {
        contentLength: content.length,
      },
      'Assistant generated text response',
    )

    newMessagesForFeed.push({
      role: 'assistant',
      content,
    })
  }

  if (tool_calls && tool_calls.length > 0) {
    toolLogger.info(
      {
        toolCallCount: tool_calls.length,
        tools: tool_calls.map((tc) => tc.function.name),
      },
      'Processing tool calls',
    )

    for (const tool_call of tool_calls) {
      const { function: functionCall } = tool_call
      const { arguments: _arguments } = functionCall
      const functionName = functionCall.name

      toolLogger.debug(
        {
          toolName: functionName,
          toolCallId: tool_call.id,
          argumentsLength: _arguments.length,
        },
        'Executing tool call',
      )

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

      const userId = phoneNumber
        ? await getSaasUserIdFromPhoneNumber(phoneNumber)
        : null

      if (!userId) {
        toolLogger.error(
          {
            phoneNumber,
            toolName: functionName,
          },
          'User not found or not linked to SaaS account',
        )
        throw new Error('User not found or not linked to SaaS account')
      }

      toolLogger.debug(
        {
          userId,
          toolName: functionName,
        },
        'User ID resolved for tool execution',
      )

      if (customImplementation) {
        // Execute custom tool
        toolLogger.info(
          {
            toolName: functionName,
            toolType: 'custom',
          },
          'Executing custom tool',
        )

        try {
          toolResponse = await executeCustomTool(
            functionName,
            JSON.parse(_arguments),
            phoneNumber,
            callersPhoneNumber,
            userId,
          )

          toolLogger.debug(
            {
              toolName: functionName,
              hasResponse: !!toolResponse,
            },
            'Custom tool executed successfully',
          )
        } catch (error) {
          logError(toolLogger, error, {
            context: 'custom_tool_execution',
            toolName: functionName,
          })
          toolResponse = {
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }
        }
      } else if (isPredefinedTool(functionName)) {
        // Execute predefined tool (like calendar functions)
        toolLogger.info(
          {
            toolName: functionName,
            toolType: 'predefined',
          },
          'Executing predefined tool',
        )

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
            callersPhoneNumber,
            userId,
          )

          toolLogger.debug(
            {
              toolName: functionName,
              hasResponse: !!toolResponse,
            },
            'Predefined tool executed successfully',
          )
        } catch (error) {
          logError(toolLogger, error, {
            context: 'predefined_tool_execution',
            toolName: functionName,
          })
          toolResponse = {
            error: `Predefined tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }
        }
      } else {
        // Execute built-in tool via MCP server
        toolLogger.info(
          {
            toolName: functionName,
            toolType: 'builtin',
          },
          'Executing built-in tool via MCP',
        )

        toolResponse = await toolCall({
          functionName,
          parameters: JSON.parse(_arguments),
        })

        toolLogger.debug(
          {
            toolName: functionName,
            hasResponse: !!toolResponse,
          },
          'Built-in tool executed successfully',
        )
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

      if (functionName === 'contactReferee') {
        return newMessagesForFeed
      }
    }
  }

  if (tool_calls && tool_calls.length > 0) {
    messageLogger.debug(
      {
        toolCallCount: tool_calls.length,
        depth,
      },
      'Tool calls completed, recursing to get next messages',
    )

    try {
      const newMessages = await getNextMessages(
        [...messagesFeed, ...newMessagesForFeed],
        phoneNumber,
        callersPhoneNumber,
        signal,
        depth + 1,
      )
      newMessagesForFeed.push(...newMessages)

      messageLogger.debug(
        {
          totalNewMessages: newMessagesForFeed.length,
          depth,
        },
        'Recursion completed successfully',
      )

      return newMessagesForFeed
    } catch (error) {
      logError(messageLogger, error, {
        context: 'mcp_server_call',
        depth,
        phoneNumber,
      })
    }
  }

  messageLogger.debug(
    {
      newMessageCount: newMessagesForFeed.length,
      depth,
    },
    'getNextMessages returning messages',
  )

  return newMessagesForFeed
}
