import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema-postgres.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/chat_webhook',
  },
} satisfies Config
