-- Migration: Add contacts table for forwardContact tool
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  company TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add index for better performance
CREATE INDEX idx_contacts_saas_user_id ON contacts(saas_user_id);
CREATE INDEX idx_contacts_name ON contacts(name);
