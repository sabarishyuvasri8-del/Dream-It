-- ═══════════════════════════════════════════════════════════════════════════════
-- DREAM-IT PUSH NOTIFICATIONS SUBSCRIPTIONS TABLE
-- Enables Web Push alerts on locked phones (Android), Windows Action Center, and macOS
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ogukrtsucsnxvrudvobv/sql
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type TEXT DEFAULT 'unknown',
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow reading and writing push subscriptions for real-time alert dispatching
DROP POLICY IF EXISTS "Allow all operations on push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all operations on push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for instant lookup when someone sends a message to user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
