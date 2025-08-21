-- Migration for SaaS multi-tenant features
-- Add SaaS users table for application users who configure Twilio
CREATE TABLE saas_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  
  -- Twilio credentials (auth_token will be encrypted)
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_whatsapp_number TEXT,
  
  -- Webhook configuration
  webhook_path TEXT UNIQUE,
  
  -- Subscription/billing info
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Link WhatsApp users to SaaS users
CREATE TABLE user_saas_user_mapping (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_saas_users_email ON saas_users(email);
CREATE INDEX idx_saas_users_webhook_path ON saas_users(webhook_path);
CREATE INDEX idx_user_mapping_phone ON user_saas_user_mapping(phone_number);
CREATE INDEX idx_user_mapping_saas_user ON user_saas_user_mapping(saas_user_id);
