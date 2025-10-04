-- Migration to add image support to assistant_tools table
-- Add new columns for image-based tools

ALTER TABLE IF NOT EXISTS assistant_tools 
ADD COLUMN IF NOT EXISTS tool_type TEXT DEFAULT 'implementation' NOT NULL CHECK (tool_type IN ('implementation', 'image')),
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_name TEXT;

-- Make implementation nullable since image tools don't need it
ALTER TABLE IF EXISTS assistant_tools 
ALTER COLUMN IF EXISTS implementation DROP NOT NULL;