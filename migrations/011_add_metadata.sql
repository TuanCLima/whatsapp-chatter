-- Add metadata to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS metadata TEXT;