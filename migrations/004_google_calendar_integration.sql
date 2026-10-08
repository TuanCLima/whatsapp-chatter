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
    config_data TEXT DEFAULT '{"weeklySchedule":{"monday":{"enabled":true,"blocks":[{"id":"mon-morning","start":540,"end":720},{"id":"mon-afternoon","start":780,"end":1020}]},"tuesday":{"enabled":true,"blocks":[{"id":"tue-morning","start":540,"end":720},{"id":"tue-afternoon","start":780,"end":1020}]},"wednesday":{"enabled":true,"blocks":[{"id":"wed-morning","start":540,"end":720},{"id":"wed-afternoon","start":780,"end":1020}]},"thursday":{"enabled":true,"blocks":[{"id":"thu-morning","start":540,"end":720},{"id":"thu-afternoon","start":780,"end":1020}]},"friday":{"enabled":true,"blocks":[{"id":"fri-morning","start":540,"end":720},{"id":"fri-afternoon","start":780,"end":1020}]},"saturday":{"enabled":true,"blocks":[{"id":"sat-morning","start":540,"end":720},{"id":"sat-afternoon","start":780,"end":1020}]},"sunday":{"enabled":false,"blocks":[]}}}', -- JSON string for tool-specific configuration
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_predefined_tools_config_saas_user_id ON predefined_tools_config(saas_user_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tools_config_type ON predefined_tools_config(saas_user_id, tool_type);

-- Ensure unique constraint: one config per user per tool type
CREATE UNIQUE INDEX IF NOT EXISTS idx_predefined_tools_unique ON predefined_tools_config(saas_user_id, tool_type);
