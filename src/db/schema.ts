import { sql } from 'drizzle-orm'
import { text, sqliteTable, integer } from 'drizzle-orm/sqlite-core'

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phoneNumber: text('phone_number').notNull(),
  role: text('role', {
    enum: ['tool', 'user', 'system', 'assistant'],
  }).notNull(),
  content: text('content'),
  timestamp: text('timestamp').default(sql`current_timestamp`).notNull(),
  toolCallId: text('tool_call_id'),
  toolCalls: text('string'),
})

export type InsertMessage = typeof messages.$inferInsert
export type Message = typeof messages.$inferSelect

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phoneNumber: text('phone_number').notNull(),
  profileName: text('profile_name').notNull(),
  conversationDisabled: integer('conversation_disabled', { mode: 'boolean' })
    .default(false)
    .notNull(),
  createdAt: text('created_at').default(sql`current_timestamp`).notNull(),
  updatedAt: text('updated_at'),
})

export type InsertUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect
