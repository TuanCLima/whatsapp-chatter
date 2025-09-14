import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import {
  assistantPrompts,
  assistantTools,
  userSaasUserMapping,
} from '../db/schema-postgres'
import { FALLBACK_PROMPT } from '../utils/contants'
import { predefinedToolsService } from './PredefinedToolsService'

export class AssistantConfigService {
  /**
   * Helper method to get SaaS user ID from phone number
   */
  private async getSaasUserIdByPhoneNumber(
    phoneNumber: string,
  ): Promise<string | null> {
    try {
      const userMapping = await db
        .select({
          saasUserId: userSaasUserMapping.saasUserId,
        })
        .from(userSaasUserMapping)
        .where(eq(userSaasUserMapping.phoneNumber, phoneNumber))
        .limit(1)

      return userMapping.length > 0 ? userMapping[0].saasUserId : null
    } catch (error) {
      console.error('Error fetching SaaS user ID by phone number:', error)
      return null
    }
  }

  /**
   * Get the active prompt for a SaaS user by their phone number
   * Falls back to environment variable or default prompt if no custom prompt exists
   */
  async getPromptForPhoneNumber(phoneNumber: string): Promise<string> {
    try {
      const saasUserId = await this.getSaasUserIdByPhoneNumber(phoneNumber)

      if (!saasUserId) {
        // No SaaS user found for this phone number, fall back to default
        return process.env.MYPROMPT ?? FALLBACK_PROMPT
      }

      // Get the active prompt for this SaaS user
      const result = await db
        .select({
          prompt: assistantPrompts.prompt,
        })
        .from(assistantPrompts)
        .where(
          and(
            eq(assistantPrompts.saasUserId, saasUserId),
            eq(assistantPrompts.isActive, true),
          ),
        )
        .limit(1)

      if (result.length > 0) {
        return result[0].prompt
      }

      // Fall back to environment variable or default
      return process.env.MYPROMPT ?? FALLBACK_PROMPT
    } catch (error) {
      console.error('Error fetching custom prompt:', error)
      // Fall back to environment variable or default on error
      return process.env.MYPROMPT ?? FALLBACK_PROMPT
    }
  }

  /**
   * Get the active prompt for a SaaS user by their user ID
   */
  async getPromptForUserId(userId: string): Promise<string> {
    try {
      const result = await db
        .select({
          prompt: assistantPrompts.prompt,
        })
        .from(assistantPrompts)
        .where(
          and(
            eq(assistantPrompts.saasUserId, userId),
            eq(assistantPrompts.isActive, true),
          ),
        )
        .limit(1)

      if (result.length > 0) {
        return result[0].prompt
      }

      // Fall back to environment variable or default
      return process.env.MYPROMPT ?? FALLBACK_PROMPT
    } catch (error) {
      console.error('Error fetching custom prompt:', error)
      // Fall back to environment variable or default on error
      return process.env.MYPROMPT ?? FALLBACK_PROMPT
    }
  }

  /**
   * Get all active tools for a SaaS user by their user ID
   * Includes both custom tools and enabled predefined tools
   */
  async getToolsForUserId(userId: string) {
    try {
      // Get custom tools
      const customTools = await db
        .select()
        .from(assistantTools)
        .where(
          and(
            eq(assistantTools.saasUserId, userId),
            eq(assistantTools.isActive, true),
          ),
        )

      const formattedCustomTools = customTools.map((tool) => ({
        ...tool,
        parameters: JSON.parse(tool.parameters),
      }))

      // Get predefined tools (like calendar management and contact management)
      const calendarTools =
        await predefinedToolsService.getCalendarToolsForLLM(userId)

      const contactTools =
        await predefinedToolsService.getContactToolsForLLM(userId)

      const predefinedTools = [...calendarTools, ...contactTools]

      return {
        customTools: formattedCustomTools,
        predefinedTools,
        allTools: [...formattedCustomTools, ...predefinedTools],
      }
    } catch (error) {
      console.error('Error fetching tools:', error)
      return {
        customTools: [],
        predefinedTools: [],
        allTools: [],
      }
    }
  }

  /**
   * Get all active tools for a phone number (via SaaS user mapping)
   * Includes both custom tools and enabled predefined tools
   */
  async getToolsForPhoneNumber(phoneNumber: string) {
    try {
      const saasUserId = await this.getSaasUserIdByPhoneNumber(phoneNumber)

      if (!saasUserId) {
        return {
          customTools: [],
          predefinedTools: [],
          allTools: [],
        }
      }

      // Get custom tools
      const customTools = await db
        .select()
        .from(assistantTools)
        .where(
          and(
            eq(assistantTools.saasUserId, saasUserId),
            eq(assistantTools.isActive, true),
          ),
        )

      const formattedCustomTools = customTools.map((tool) => ({
        ...tool,
        parameters: JSON.parse(tool.parameters),
      }))

      // Get predefined tools (like calendar management and contact management)
      const calendarTools =
        await predefinedToolsService.getCalendarToolsForLLM(saasUserId)

      const contactTools =
        await predefinedToolsService.getContactToolsForLLM(saasUserId)

      const predefinedTools = [...calendarTools, ...contactTools]

      return {
        customTools: formattedCustomTools,
        predefinedTools,
        allTools: [...formattedCustomTools, ...predefinedTools],
      }
    } catch (error) {
      console.error('Error fetching tools for phone number:', error)
      return {
        customTools: [],
        predefinedTools: [],
        allTools: [],
      }
    }
  }
}

export const assistantConfigService = new AssistantConfigService()
