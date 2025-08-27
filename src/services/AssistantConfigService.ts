import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import {
  assistantPrompts,
  assistantTools,
  saasUsers,
} from '../db/schema-postgres'
import { FALLBACK_PROMPT } from '../utils/contants'
import { predefinedToolsService } from './PredefinedToolsService'

export class AssistantConfigService {
  /**
   * Get the active prompt for a SaaS user by their phone number
   * Falls back to environment variable or default prompt if no custom prompt exists
   */
  async getPromptForPhoneNumber(phoneNumber: string): Promise<string> {
    try {
      // First, find the SaaS user associated with this phone number
      // We need to look this up via the user_saas_user_mapping table
      const result = await db
        .select({
          prompt: assistantPrompts.prompt,
        })
        .from(assistantPrompts)
        .innerJoin(saasUsers, eq(assistantPrompts.saasUserId, saasUsers.id))
        .where(
          and(
            eq(assistantPrompts.isActive, true),
            // TODO: We need to join with user_saas_user_mapping to connect phone numbers to SaaS users
            // For now, we'll use the first active prompt we find
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

      // Get predefined tools (like calendar management)
      const predefinedTools =
        await predefinedToolsService.getCalendarToolsForLLM(userId)

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
  async getToolsForPhoneNumber(_phoneNumber: string) {
    try {
      // TODO: Implement proper phone number to SaaS user mapping
      // For now, get tools from the first SaaS user (temporary solution)
      const firstSaasUser = await db.select().from(saasUsers).limit(1)

      if (firstSaasUser.length === 0) {
        return {
          customTools: [],
          predefinedTools: [],
          allTools: [],
        }
      }

      const userId = firstSaasUser[0].id

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

      // Get predefined tools (like calendar management)
      const predefinedTools =
        await predefinedToolsService.getCalendarToolsForLLM(userId)

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
