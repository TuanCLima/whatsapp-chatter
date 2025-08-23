import 'dotenv/config'
import * as vm from 'node:vm'
import type { ChatCompletionTool } from 'openai/resources/chat'
import { db } from '../db'
import type { AssistantTool } from '../db/schema-postgres'
import { assistantConfigService } from './AssistantConfigService'

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
    console.log(
      'convertToOpenAITool params',
      typeof dbTool.parameters,
      '*',
      dbTool.parameters,
    )
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
    // Get custom tools for this phone number (this will need the SaaS user mapping)
    const customTools =
      await assistantConfigService.getToolsForPhoneNumber(phoneNumber)

    // Convert custom tools to OpenAI format
    const convertedCustomTools = customTools
      .map((tool) => convertToOpenAITool(tool))
      .filter((tool): tool is ChatCompletionTool => tool !== null)

    // Combine built-in tools with custom tools
    return [...builtInTools, ...convertedCustomTools]
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
    // Get custom tools for this user
    const customTools = await assistantConfigService.getToolsForUserId(userId)

    // Convert custom tools to OpenAI format
    const convertedCustomTools = customTools
      .map((tool) => convertToOpenAITool(tool))
      .filter((tool): tool is ChatCompletionTool => tool !== null)

    // Combine built-in tools with custom tools
    return [...builtInTools, ...convertedCustomTools]
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
    let customTools: AssistantTool[] = []

    if (userId) {
      customTools = await assistantConfigService.getToolsForUserId(userId)
    } else if (phoneNumber) {
      customTools =
        await assistantConfigService.getToolsForPhoneNumber(phoneNumber)
    }

    const tool = customTools.find((t) => t.name === toolName)
    return tool ? tool.implementation : null
  } catch (error) {
    console.error('Error getting custom tool implementation:', error)
    return null
  }
}
