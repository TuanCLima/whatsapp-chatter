-- Create table to store pending questions for referee contact
-- Used when there's no open channel with the referee yet

CREATE TABLE IF NOT EXISTS pending_referee_questions (
  id SERIAL PRIMARY KEY,
  saas_user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  user_profile_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_referee_questions_saas_user_id ON pending_referee_questions(saas_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_referee_questions_to_number ON pending_referee_questions(to_number);
CREATE INDEX IF NOT EXISTS idx_pending_referee_questions_sent_at ON pending_referee_questions(sent_at);
