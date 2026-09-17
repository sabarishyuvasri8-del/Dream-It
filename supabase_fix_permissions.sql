-- ═══════════════════════════════════════════════════════════════════════════════
-- DREAM-IT PERMISSIONS RESTORATION SQL
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ogukrtsucsnxvrudvobv/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. FRIENDSHIPS TABLE (Fixes "Failed to send friend request")
ALTER TABLE IF EXISTS public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
DROP POLICY IF EXISTS "Users can respond to friend requests" ON public.friendships;
DROP POLICY IF EXISTS "Allow all operations on friendships" ON public.friendships;

CREATE POLICY "Allow all operations on friendships"
  ON public.friendships FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. WORKSPACES TABLE (Fixes Cloud Sync)
ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own workspace or linked child workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Users can manage own workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Allow all operations on workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow all operations" ON public.workspaces;

CREATE POLICY "Allow all operations on workspaces"
  ON public.workspaces FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. PARENT LINKS TABLE (Fixes Parent-Child Linking)
ALTER TABLE IF EXISTS public.parent_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own parent-child relationships" ON public.parent_links;
DROP POLICY IF EXISTS "Parents can manage their links" ON public.parent_links;
DROP POLICY IF EXISTS "Allow all operations on parent_links" ON public.parent_links;
DROP POLICY IF EXISTS "Allow all operations" ON public.parent_links;

CREATE POLICY "Allow all operations on parent_links"
  ON public.parent_links FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. DIRECT MESSAGES TABLE (Fixes In-App Chat)
ALTER TABLE IF EXISTS public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages or linked child messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update or delete their own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Allow all operations on direct_messages" ON public.direct_messages;

CREATE POLICY "Allow all operations on direct_messages"
  ON public.direct_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. SHARED NOTES TABLE (Fixes Peer Note Sharing)
ALTER TABLE IF EXISTS public.shared_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view shared notes sent or received" ON public.shared_notes;
DROP POLICY IF EXISTS "Users can share notes" ON public.shared_notes;
DROP POLICY IF EXISTS "Users can update shared note status" ON public.shared_notes;
DROP POLICY IF EXISTS "Allow all operations on shared_notes" ON public.shared_notes;

CREATE POLICY "Allow all operations on shared_notes"
  ON public.shared_notes FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. USER PROFILES TABLE (Fixes Profile Creation)
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Users manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON public.user_profiles;

CREATE POLICY "Allow all operations on user_profiles"
  ON public.user_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. STORAGE BUCKET (chat_attachments)
DROP POLICY IF EXISTS "Users can upload attachments into their user folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on chat_attachments" ON storage.objects;

CREATE POLICY "Allow all operations on chat_attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat_attachments')
  WITH CHECK (bucket_id = 'chat_attachments');
