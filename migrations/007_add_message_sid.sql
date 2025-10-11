-- Add MessageSid field to messages table for Twilio message tracking
-- This field is optional for backwards compatibility

ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_sid TEXT;
