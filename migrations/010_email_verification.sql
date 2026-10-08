-- Add email verification fields to saas_users table
ALTER TABLE saas_users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN verification_token TEXT,
ADD COLUMN verification_token_expiry TIMESTAMP,
ADD COLUMN last_verification_email_sent TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX idx_verification_token ON saas_users(verification_token);
