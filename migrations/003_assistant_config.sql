-- Migration: Add assistant configuration tables
-- Description: Adds tables for storing custom prompts and tools for each SaaS user

CREATE TABLE assistant_prompts (
    id SERIAL PRIMARY KEY,
    saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE assistant_tools (
    id SERIAL PRIMARY KEY,
    saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    parameters TEXT NOT NULL, -- JSON string
    implementation TEXT NOT NULL, -- JavaScript code
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_assistant_prompts_saas_user_id ON assistant_prompts(saas_user_id);
CREATE INDEX idx_assistant_prompts_active ON assistant_prompts(saas_user_id, is_active);

CREATE INDEX idx_assistant_tools_saas_user_id ON assistant_tools(saas_user_id);
CREATE INDEX idx_assistant_tools_active ON assistant_tools(saas_user_id, is_active);
