import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import {
  assistantPrompts,
  assistantTools,
  saasUsers,
} from '../db/schema-postgres'
import { FALLBACK_PROMPT } from '../utils/contants'

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
   */
  async getToolsForUserId(userId: string) {
    try {
      const tools = await db
        .select()
        .from(assistantTools)
        .where(
          and(
            eq(assistantTools.saasUserId, userId),
            eq(assistantTools.isActive, true),
          ),
        )

      return tools.map((tool) => ({
        ...tool,
        parameters: JSON.parse(tool.parameters),
      }))
    } catch (error) {
      console.error('Error fetching custom tools:', error)
      return []
    }
  }

  /**
   * Get all active tools for a phone number (via SaaS user mapping)
   */
  async getToolsForPhoneNumber(phoneNumber: string) {
    try {
      // TODO: Implement proper phone number to SaaS user mapping
      // For now, get tools from the first SaaS user (temporary solution)
      const firstSaasUser = await db.select().from(saasUsers).limit(1)

      if (firstSaasUser.length === 0) {
        return []
      }

      const tools = await db
        .select()
        .from(assistantTools)
        .where(
          and(
            eq(assistantTools.saasUserId, firstSaasUser[0].id),
            eq(assistantTools.isActive, true),
          ),
        )

      return tools.map((tool) => ({
        ...tool,
        parameters: JSON.parse(tool.parameters),
      }))
    } catch (error) {
      console.error('Error fetching custom tools for phone number:', error)
      return []
    }
  }
}

export const assistantConfigService = new AssistantConfigService()
