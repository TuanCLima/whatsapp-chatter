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

export type InsertUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect
