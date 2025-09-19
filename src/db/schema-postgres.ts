import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  role: text('role', {
    enum: ['tool', 'user', 'system', 'assistant'],
  }).notNull(),
  content: text('content'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  toolCallId: text('tool_call_id'),
  toolCalls: text('string'),
})

export type InsertMessage = typeof messages.$inferInsert
export type Message = typeof messages.$inferSelect

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  profileName: text('profile_name').notNull(),
  conversationDisabled: boolean('conversation_disabled')
    .default(false)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
})

// New table for SaaS users (app users who configure Twilio)
export const saasUsers = pgTable('saas_users', {
  id: text('id').primaryKey(), // UUID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] })
    .default('user')
    .notNull(),

  // Twilio credentials (encrypted)
  twilioAccountSid: text('twilio_account_sid'),
  twilioAuthToken: text('twilio_auth_token'), // This will be encrypted
  twilioWhatsappNumber: text('twilio_whatsapp_number'),

  // Webhook configuration
  webhookPath: text('webhook_path').unique(), // e.g., "/webhook/user123"

  // Google Calendar integration
  googleRefreshToken: text('google_refresh_token'),
  googleAccessToken: text('google_access_token'),
  googleTokenExpiry: timestamp('google_token_expiry'),
  googleCalendarEnabled: boolean('google_calendar_enabled')
    .default(false)
    .notNull(),

  // Subscription/billing info
  subscriptionStatus: text('subscription_status', {
    enum: ['trial', 'active', 'cancelled', 'expired'],
  })
    .default('trial')
    .notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Link WhatsApp users to SaaS users
export const userSaasUserMapping = pgTable('user_saas_user_mapping', {
  id: serial('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  saasUserId: text('saas_user_id')
    .notNull()
    .references(() => saasUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type InsertUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect

export type InsertSaasUser = typeof saasUsers.$inferInsert
export type SaasUser = typeof saasUsers.$inferSelect

export type InsertUserSaasUserMapping = typeof userSaasUserMapping.$inferInsert
export type UserSaasUserMapping = typeof userSaasUserMapping.$inferSelect

// Assistant configuration tables
export const assistantPrompts = pgTable('assistant_prompts', {
  id: serial('id').primaryKey(),
  saasUserId: text('saas_user_id')
    .notNull()
    .references(() => saasUsers.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const assistantTools = pgTable('assistant_tools', {
  id: serial('id').primaryKey(),
  saasUserId: text('saas_user_id')
    .notNull()
    .references(() => saasUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parameters: text('parameters').notNull(), // JSON string
  implementation: text('implementation'), // JavaScript code (nullable for image tools)
  toolType: text('tool_type', { enum: ['implementation', 'image'] })
    .default('implementation')
    .notNull(),
  imageUrl: text('image_url'), // URL/path to uploaded image
  imageName: text('image_name'), // Original filename
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type InsertAssistantPrompt = typeof assistantPrompts.$inferInsert
export type AssistantPrompt = typeof assistantPrompts.$inferSelect

export type InsertAssistantTool = typeof assistantTools.$inferInsert
export type AssistantTool = typeof assistantTools.$inferSelect

// Predefined tools configuration table
export const predefinedToolsConfig = pgTable('predefined_tools_config', {
  id: serial('id').primaryKey(),
  saasUserId: text('saas_user_id')
    .notNull()
    .references(() => saasUsers.id, { onDelete: 'cascade' }),
  toolType: text('tool_type').notNull(), // 'calendar_management', 'email_automation', etc.
  enabled: boolean('enabled').default(false).notNull(),
  configData: text('config_data'), // JSON string for tool-specific configuration
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type InsertPredefinedToolsConfig =
  typeof predefinedToolsConfig.$inferInsert
export type PredefinedToolsConfig = typeof predefinedToolsConfig.$inferSelect

// Contacts table for the forwardContact tool
export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  saasUserId: text('saas_user_id')
    .notNull()
    .references(() => saasUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phoneNumber: text('phone_number').notNull(),
  email: text('email'),
  company: text('company'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type InsertContact = typeof contacts.$inferInsert
export type Contact = typeof contacts.$inferSelect
