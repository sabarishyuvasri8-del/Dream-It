-- ═══════════════════════════════════════════════════════════════════════════════
-- PERMANENTLY STOP 24-HOUR CHAT RESET / EXPIRY IN SUPABASE
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ogukrtsucsnxvrudvobv/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. UNSCHEDULE CRON JOBS (USES OFFICIAL BUILT-IN cron.unschedule FUNCTION)
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE command ILIKE '%direct_messages%' 
   OR command ILIKE '%24%' 
   OR jobname ILIKE '%message%'
   OR jobname ILIKE '%chat%'
   OR jobname ILIKE '%clean%';

-- 2. DROP ANY OBSOLETE TRIGGERS ON DIRECT_MESSAGES
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN (
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'direct_messages'
          AND (trigger_name ILIKE '%clean%' OR trigger_name ILIKE '%delete%' OR trigger_name ILIKE '%expire%')
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.direct_messages CASCADE', trig.trigger_name);
    END LOOP;
END $$;

-- 3. DROP ANY OBSOLETE CLEANUP FUNCTIONS
DROP FUNCTION IF EXISTS public.cleanup_old_direct_messages() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_messages() CASCADE;
DROP FUNCTION IF EXISTS public.delete_expired_messages() CASCADE;
DROP FUNCTION IF EXISTS public.delete_old_messages() CASCADE;

-- 4. VIEW REMAINING ACTIVE CRON JOBS
SELECT jobid, jobname, schedule, active, command 
FROM cron.job;
