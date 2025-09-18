import 'dotenv/config'
import * as vm from 'node:vm'
import type { ChatCompletionTool } from 'openai/resources/chat'
import type { AssistantTool } from '../db/schema-postgres'
import { assistantConfigService } from './AssistantConfigService'
import { predefinedToolsService } from './PredefinedToolsService'

export interface CustomToolDefinition {
  id: string
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
  implementation: string
}

/**
 * Convert database tool to OpenAI tool format
 */
export function convertToOpenAITool(
  dbTool: AssistantTool,
): ChatCompletionTool | null {
  let parameters: unknown
  try {
    parameters =
      typeof dbTool.parameters === 'string'
        ? JSON.parse(dbTool.parameters)
        : dbTool.parameters
  } catch (error) {
    console.error(`Error parsing parameters for tool ${dbTool.name}:`, error)
    return null
  }

  // Convert our parameter format to OpenAI's expected format
  const openAIParameters = {
    type: 'object' as const,
    properties: {} as Record<string, unknown>,
    required: [] as string[],
  }

  if (Array.isArray(parameters)) {
    for (const param of parameters) {
      openAIParameters.properties[param.name] = {
        type: param.type || 'string',
        description: param.description || '',
      }

      if (param.required) {
        openAIParameters.required.push(param.name)
      }
    }
  }

  return {
    type: 'function',
    function: {
      name: dbTool.name,
      description: dbTool.description,
      parameters: openAIParameters,
    },
  }
}

/**
 * Execute a custom tool's JavaScript code safely
 * Note: This is a simplified sandbox. For production, consider using isolated-vm or similar
 */
export async function executeCustomTool(
  toolName: string,
  parameters: unknown,
  implementation: string,
): Promise<unknown> {
  try {
    // Create a basic sandbox context
    const sandbox = {
      parameters,
      result: undefined as unknown,
      console: {
        log: console.log,
        error: console.error,
        warn: console.warn,
      },
      JSON,
      Date,
      Math,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
    }

    // Wrap the user's implementation to capture the result
    const wrappedCode = `
      try {
        const toolFunction = function(params) {
          ${implementation}
        };
        result = toolFunction(parameters);
      } catch (error) {
        result = { error: error.message };
      }
    `

    // Execute in VM context with timeout
    vm.createContext(sandbox)
    vm.runInContext(wrappedCode, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    })

    // Check if there was an error
    if (
      sandbox.result &&
      typeof sandbox.result === 'object' &&
      'error' in sandbox.result
    ) {
      throw new Error(sandbox.result.error as string)
    }

    return sandbox.result
  } catch (error) {
    console.error(`Error executing custom tool ${toolName}:`, error)
    throw new Error(
      `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Get all tools (built-in + custom) for a specific phone number
 */
export async function getToolsForPhoneNumber(
  phoneNumber: string,
  builtInTools: ChatCompletionTool[],
): Promise<ChatCompletionTool[]> {
  try {
    // Get tools for this phone number (this will need the SaaS user mapping)
    const toolsData =
      await assistantConfigService.getToolsForPhoneNumber(phoneNumber)

    // Convert custom tools to OpenAI format
    const convertedCustomTools = toolsData.customTools
      .map((tool) => convertToOpenAITool(tool))
      .filter((tool): tool is ChatCompletionTool => tool !== null)

    // Convert predefined tools to ChatCompletionTool format (they're already in the right format)
    const predefinedTools = toolsData.predefinedTools as ChatCompletionTool[]

    // Combine built-in tools with custom tools and predefined tools
    return [...builtInTools, ...convertedCustomTools, ...predefinedTools]
  } catch (error) {
    console.error('Error getting tools for phone number:', error)
    // Return only built-in tools if there's an error
    return builtInTools
  }
}

/**
 * Get all tools (built-in + custom) for a specific user ID
 */
export async function getToolsForUserId(
  userId: string,
  builtInTools: ChatCompletionTool[],
): Promise<ChatCompletionTool[]> {
  try {
    // Get tools for this user
    const toolsData = await assistantConfigService.getToolsForUserId(userId)

    // Convert custom tools to OpenAI format
    const convertedCustomTools = toolsData.customTools
      .map((tool) => convertToOpenAITool(tool))
      .filter((tool): tool is ChatCompletionTool => tool !== null)

    // Convert predefined tools to ChatCompletionTool format (they're already in the right format)
    const predefinedTools = toolsData.predefinedTools as ChatCompletionTool[]

    // Combine built-in tools with custom tools and predefined tools
    return [...builtInTools, ...convertedCustomTools, ...predefinedTools]
  } catch (error) {
    console.error('Error getting tools for user ID:', error)
    // Return only built-in tools if there's an error
    return builtInTools
  }
}

/**
 * Check if a tool name is a custom tool and get its implementation
 */
export async function getCustomToolImplementation(
  toolName: string,
  userId?: string,
  phoneNumber?: string,
): Promise<string | null> {
  try {
    if (userId) {
      const toolsData = await assistantConfigService.getToolsForUserId(userId)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool ? tool.implementation : null
    } else if (phoneNumber) {
      const toolsData =
        await assistantConfigService.getToolsForPhoneNumber(phoneNumber)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool ? tool.implementation : null
    }

    return null
  } catch (error) {
    console.error('Error getting custom tool implementation:', error)
    return null
  }
}

const predefinedToolNames = [
  'fetchCalendarEvents',
  'createCalendarEvent',
  'checkEventAvailability',
  'suggestEventTimes',
  'cancelCalendarEvent',
  'checkAndCancelEventIfEligible',
  'checkEventCancellationEligibility',
  'forwardContact',
]

/**
 * Check if a tool name is a predefined tool and execute it
 */
export async function executePredefinedTool(
  toolName: string,
  parameters: Record<string, unknown>,
  _phoneNumber: string,
  userId?: string,
): Promise<unknown | null> {
  try {
    if (!predefinedToolNames.includes(toolName)) {
      return null // Not a predefined tool
    }

    // For now, we only have calendar tools, so we need a user ID
    if (!userId) {
      // Try to get user ID from phone number (this will need proper mapping implementation)
      // For now, we can't execute predefined tools without a user ID
      throw new Error('User ID required for predefined tool execution')
    }

    // Execute the predefined tool
    return await predefinedToolsService.executeCalendarFunction(
      userId,
      toolName,
      parameters,
      _phoneNumber,
    )
  } catch (error) {
    console.error('Error executing predefined tool:', error)
    throw error
  }
}

/**
 * Check if a tool name is a predefined tool
 */
export function isPredefinedTool(toolName: string): boolean {
  return predefinedToolNames.includes(toolName)
}
