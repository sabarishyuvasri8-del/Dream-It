-- Parent Links Table for Dream-It Parental Control
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS parent_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id TEXT NOT NULL,           -- Clerk user ID of the parent
  parent_username TEXT NOT NULL,          -- Parent's username for display
  child_user_id TEXT NOT NULL,            -- Clerk user ID of the child
  child_username TEXT NOT NULL,           -- Child's username for display
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by parent
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_links(parent_user_id);

-- Index for checking if a child already has a parent linked
CREATE INDEX IF NOT EXISTS idx_parent_links_child ON parent_links(child_user_id);

-- Ensure one parent can only link to a specific child once
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_child_unique ON parent_links(parent_user_id, child_user_id);

-- Disable RLS for simplicity (matching your existing tables)
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching your existing permissive RLS pattern)
CREATE POLICY "Allow all operations on parent_links"
  ON parent_links FOR ALL
  USING (true)
  WITH CHECK (true);
