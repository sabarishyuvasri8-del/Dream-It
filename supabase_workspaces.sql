-- Workspaces Table for Dream-It Full Cloud Sync
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)

CREATE TABLE IF NOT EXISTS workspaces (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user workspace lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Allow all operations for seamless sync
CREATE POLICY "Allow all operations on workspaces"
  ON workspaces FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime broadcasting on workspaces table
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
