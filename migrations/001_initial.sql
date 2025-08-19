-- PostgreSQL migration
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tool', 'user', 'system', 'assistant')),
  content TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  tool_call_id TEXT,
  string TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  conversation_disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_phone_timestamp 
ON messages(phone_number, timestamp);
