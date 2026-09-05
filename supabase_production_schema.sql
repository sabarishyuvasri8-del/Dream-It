-- ═══════════════════════════════════════════════════════════════════════════════
-- DREAM-IT PRODUCTION DATABASE SCHEMA
-- Normalized Relational PostgreSQL Tables with Row-Level Security (RLS)
-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Maps to Clerk User ID
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
  id BIGINT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#c8d9e9',
  accent TEXT NOT NULL DEFAULT '#315f48',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. NOTES JOURNAL TABLE
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id BIGINT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FLASHCARDS TABLE
CREATE TABLE IF NOT EXISTS public.flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id BIGINT,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  review_count INT NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id BIGINT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  course TEXT,
  time TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT DEFAULT '#315f48',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GRADES TABLE
CREATE TABLE IF NOT EXISTS public.grades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id BIGINT,
  assignment_name TEXT NOT NULL,
  score NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FOCUS LOGS TABLE
CREATE TABLE IF NOT EXISTS public.focus_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 8. EXAM SIMULATOR RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.exam_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_level TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  total_marks INT NOT NULL,
  obtained_marks NUMERIC NOT NULL,
  percentage NUMERIC NOT NULL,
  grade_band TEXT NOT NULL,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_grades_user_id ON public.grades(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_logs_user_id ON public.focus_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exam_results_user_id ON public.exam_results(user_id);

-- 10. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- 11. RLS POLICIES (Users can only access their own records)
-- Profiles
CREATE POLICY "Public profiles are readable by authenticated users" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR ALL USING (auth.uid()::text = id OR id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (auth.uid()::text = id OR id = current_setting('request.jwt.claim.sub', true));

-- Subjects
CREATE POLICY "Users manage own subjects" ON public.subjects FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Notes
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Flashcards
CREATE POLICY "Users manage own flashcards" ON public.flashcards FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Tasks
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Grades
CREATE POLICY "Users manage own grades" ON public.grades FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Focus Logs
CREATE POLICY "Users manage own focus logs" ON public.focus_logs FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- Exam Results
CREATE POLICY "Users manage own exam results" ON public.exam_results FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)) WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true));

-- 12. REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes, public.tasks, public.flashcards, public.subjects;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
