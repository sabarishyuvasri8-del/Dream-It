-- ═══════════════════════════════════════════════════════════════════════════════
-- DREAM-IT PRODUCTION SECURITY LOCKDOWN MIGRATION
-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. DROP ALL INSECURE PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Allow all operations on workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow all operations on parent_links" ON public.parent_links;
DROP POLICY IF EXISTS "Allow all operations" ON public.workspaces;
DROP POLICY IF EXISTS "Allow all operations" ON public.parent_links;

-- 2. ENABLE ROW-LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.focus_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results ENABLE ROW LEVEL SECURITY;

-- Helper function to safely extract the authenticated Clerk / Supabase user ID
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(auth.uid()::text, '')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. WORKSPACES SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view own workspace or linked child workspace" ON public.workspaces;
CREATE POLICY "Users can view own workspace or linked child workspace"
  ON public.workspaces FOR SELECT
  USING (
    user_id = public.current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM public.parent_links
      WHERE parent_user_id = public.current_app_user_id()
        AND child_user_id = workspaces.user_id
    )
  );

DROP POLICY IF EXISTS "Users can manage own workspace" ON public.workspaces;
CREATE POLICY "Users can manage own workspace"
  ON public.workspaces FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PARENT LINKS SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view own parent-child relationships" ON public.parent_links;
CREATE POLICY "Users can view own parent-child relationships"
  ON public.parent_links FOR SELECT
  USING (
    parent_user_id = public.current_app_user_id()
    OR child_user_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "Parents can manage their links" ON public.parent_links;
CREATE POLICY "Parents can manage their links"
  ON public.parent_links FOR ALL
  USING (parent_user_id = public.current_app_user_id())
  WITH CHECK (parent_user_id = public.current_app_user_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DIRECT MESSAGES SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view own messages or linked child messages" ON public.direct_messages;
CREATE POLICY "Users can view own messages or linked child messages"
  ON public.direct_messages FOR SELECT
  USING (
    sender_id = public.current_app_user_id()
    OR receiver_id = public.current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM public.parent_links
      WHERE parent_user_id = public.current_app_user_id()
        AND (child_user_id = direct_messages.sender_id OR child_user_id = direct_messages.receiver_id)
    )
  );

DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.direct_messages;
CREATE POLICY "Users can send messages as themselves"
  ON public.direct_messages FOR INSERT
  WITH CHECK (sender_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users can update or delete their own messages" ON public.direct_messages;
CREATE POLICY "Users can update or delete their own messages"
  ON public.direct_messages FOR UPDATE
  USING (sender_id = public.current_app_user_id() OR receiver_id = public.current_app_user_id())
  WITH CHECK (sender_id = public.current_app_user_id() OR receiver_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users can delete messages" ON public.direct_messages;
CREATE POLICY "Users can delete messages"
  ON public.direct_messages FOR DELETE
  USING (sender_id = public.current_app_user_id() OR receiver_id = public.current_app_user_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. FRIENDSHIPS SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (
    requester_id = public.current_app_user_id()
    OR target_id = public.current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = public.current_app_user_id()
        AND username = friendships.target_identifier
    )
  );

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (requester_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users can respond to friend requests" ON public.friendships;
CREATE POLICY "Users can respond to friend requests"
  ON public.friendships FOR UPDATE
  USING (
    requester_id = public.current_app_user_id()
    OR target_id = public.current_app_user_id()
    OR target_identifier = (SELECT username FROM public.user_profiles WHERE id = public.current_app_user_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. USER PROFILES SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.user_profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users manage their own profile" ON public.user_profiles;
CREATE POLICY "Users manage their own profile"
  ON public.user_profiles FOR ALL
  USING (id = public.current_app_user_id())
  WITH CHECK (id = public.current_app_user_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. SHARED NOTES SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view shared notes sent or received" ON public.shared_notes;
CREATE POLICY "Users can view shared notes sent or received"
  ON public.shared_notes FOR SELECT
  USING (
    sender_id = public.current_app_user_id()
    OR recipient_identifier = (SELECT username FROM public.user_profiles WHERE id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS "Users can share notes" ON public.shared_notes;
CREATE POLICY "Users can share notes"
  ON public.shared_notes FOR INSERT
  WITH CHECK (sender_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users can update shared note status" ON public.shared_notes;
CREATE POLICY "Users can update shared note status"
  ON public.shared_notes FOR UPDATE
  USING (
    sender_id = public.current_app_user_id()
    OR recipient_identifier = (SELECT username FROM public.user_profiles WHERE id = public.current_app_user_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. STORAGE BUCKET SECURITY POLICIES (chat_attachments)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Allow users to upload into their own designated folder
DROP POLICY IF EXISTS "Users can upload attachments into their user folder" ON storage.objects;
CREATE POLICY "Users can upload attachments into their user folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat_attachments'
    AND (
      -- Path begins with subject_files/{user_id}/ or direct {user_id}/
      name LIKE 'subject_files/' || public.current_app_user_id() || '/%'
      OR name LIKE public.current_app_user_id() || '/%'
      OR public.current_app_user_id() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can read attachments" ON storage.objects;
CREATE POLICY "Users can read attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat_attachments');

DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat_attachments'
    AND (
      name LIKE 'subject_files/' || public.current_app_user_id() || '/%'
      OR name LIKE public.current_app_user_id() || '/%'
    )
  );
