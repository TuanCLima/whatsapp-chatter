import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: "file:./sqlite.db",
});
export const db = drizzle(client, { schema });

// Initialize database with proper schema using Drizzle
export async function initializeDatabase() {
  // Create tables based on schema if they don't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('tool', 'user', 'system', 'assistant')),
      content TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tool_call_id TEXT,
      string TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      profile_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
  `);
}
