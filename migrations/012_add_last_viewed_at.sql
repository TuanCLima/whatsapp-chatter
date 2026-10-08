-- Add lastViewedAt to users table to track when operator last viewed each conversation
-- This enables unread message tracking based on operator viewing rather than assistant responses

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;

