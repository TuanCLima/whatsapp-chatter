import 'dotenv/config'
import * as vm from 'node:vm'
import type { ChatCompletionTool } from 'openai/resources/chat'
import type { AssistantTool } from '../db/schema-postgres'
import { DEPLOYMENT_URL } from '../utils/contants'
import { noWhatsPhoneNumber } from '../utils/utils'
import { assistantConfigService } from './AssistantConfigService'
import { predefinedToolsService } from './PredefinedToolsService'
import { twilioClientPool } from './TwilioClientPool'

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
 * Execute an image-based tool by sending the image to WhatsApp
 */
export async function executeImageTool(
  tool: AssistantTool,
  callersPhoneNumber: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    if (!tool.imageUrl) {
      throw new Error('Image tool has no image URL')
    }

    const cleanCallersPhoneNumber = noWhatsPhoneNumber(callersPhoneNumber)

    const twilioClient = await twilioClientPool.getClient(userId)

    // Convert relative URL to full URL
    const baseUrl =
      process.env.BASE_URL ||
      process.env.DEPLOYMENT_URL ||
      DEPLOYMENT_URL ||
      `http://localhost:${process.env.PORT || 3000}`
    const fullImageUrl = tool.imageUrl.startsWith('https')
      ? tool.imageUrl
      : `${baseUrl}/api/assistant${tool.imageUrl}`

    // Get the user's Twilio WhatsApp number
    const whatsappNumber = noWhatsPhoneNumber(
      await twilioClientPool.getPhoneNumberInfo(userId),
    )

    // Send the image using Twilio
    const message = await twilioClient.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${cleanCallersPhoneNumber}`,
      body: '',
      mediaUrl: [fullImageUrl],
    })

    return {
      success: true,
      message: `Image sent successfully. Message SID: ${message.sid}`,
    }
  } catch (error) {
    console.error(`Error executing image tool ${tool.name}:`, error)
    throw new Error(
      `Image tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
export async function executeCustomToolImplementation(
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
 * Check if a tool name is a custom tool and get its details
 */
export async function getCustomToolDetails(
  toolName: string,
  userId?: string,
  phoneNumber?: string,
): Promise<AssistantTool | null> {
  try {
    if (userId) {
      const toolsData = await assistantConfigService.getToolsForUserId(userId)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool || null
    } else if (phoneNumber) {
      const toolsData =
        await assistantConfigService.getToolsForPhoneNumber(phoneNumber)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool || null
    }

    return null
  } catch (error) {
    console.error('Error getting custom tool details:', error)
    return null
  }
}

/**
 * Execute a custom tool (either implementation-based or image-based)
 */
export async function executeCustomTool(
  toolName: string,
  parameters: Record<string, unknown>,
  phoneNumber: string,
  callersPhoneNumber: string,
  userId: string,
): Promise<unknown> {
  // Get the tool details
  const tool = await getCustomToolDetails(toolName, userId, phoneNumber)

  if (!tool) {
    throw new Error(`Custom tool ${toolName} not found`)
  }

  if (tool.toolType === 'image') {
    // Execute image tool
    return executeImageTool(tool, callersPhoneNumber, userId)
  } else {
    // Execute implementation tool
    if (!tool.implementation) {
      throw new Error(`Implementation tool ${toolName} has no implementation`)
    }
    return executeCustomToolImplementation(
      toolName,
      parameters,
      tool.implementation,
    )
  }
}

/**
 * Execute a custom tool's JavaScript code safely
 * Note: This is a simplified sandbox. For production, consider using isolated-vm or similar
 */
export async function getCustomToolImplementation(
  toolName: string,
  userId?: string,
  phoneNumber?: string,
): Promise<{ isCustomTool: boolean; implementation?: string | null } | null> {
  try {
    if (userId) {
      const toolsData = await assistantConfigService.getToolsForUserId(userId)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool
        ? { isCustomTool: true, implementation: tool.implementation }
        : null
    } else if (phoneNumber) {
      const toolsData =
        await assistantConfigService.getToolsForPhoneNumber(phoneNumber)
      const tool = toolsData.customTools.find((t) => t.name === toolName)
      return tool
        ? { isCustomTool: true, implementation: tool.implementation }
        : null
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
  'getCurrentWorkingHours',
  'forwardContact',
  'contactReferee',
]

/**
 * Check if a tool name is a predefined tool and execute it
 */
export async function executePredefinedTool(
  toolName: string,
  parameters: Record<string, unknown>,
  _phoneNumber: string,
  callersPhoneNumber: string,
  userId: string,
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
      callersPhoneNumber,
      userId,
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
