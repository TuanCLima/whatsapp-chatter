-- Migration: Add Google Calendar integration support
-- Description: Adds fields for Google Calendar authentication and calendar tool configuration

-- Add Google Calendar authentication fields to saas_users table
ALTER TABLE saas_users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE saas_users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE saas_users ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP;
ALTER TABLE saas_users ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT false NOT NULL;

-- Add table for predefined tools configuration
CREATE TABLE IF NOT EXISTS predefined_tools_config (
    id SERIAL PRIMARY KEY,
    saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    tool_type TEXT NOT NULL, -- 'calendar_management', 'email_automation', etc.
    enabled BOOLEAN DEFAULT false NOT NULL,
    config_data TEXT, -- JSON string for tool-specific configuration
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_predefined_tools_config_saas_user_id ON predefined_tools_config(saas_user_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tools_config_type ON predefined_tools_config(saas_user_id, tool_type);

-- Ensure unique constraint: one config per user per tool type
CREATE UNIQUE INDEX IF NOT EXISTS idx_predefined_tools_unique ON predefined_tools_config(saas_user_id, tool_type);
