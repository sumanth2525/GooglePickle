-- Migration for existing Supabase DB: add columns and objects the app expects.
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run (uses IF NOT EXISTS / DO blocks).

-- 1) Profiles: add columns for profile page (first name, last name, age, player type)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS player_type text DEFAULT 'Intermediate';

-- 2) Friend requests table (for profile “Friend requests” and send/accept/decline)
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_profile_id, to_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests(to_profile_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests(from_profile_id);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Allow anon insert friend_requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Allow anon update friend_requests" ON public.friend_requests;
CREATE POLICY "Allow anon read friend_requests" ON public.friend_requests FOR SELECT USING (true);
CREATE POLICY "Allow anon insert friend_requests" ON public.friend_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update friend_requests" ON public.friend_requests FOR UPDATE USING (true);

-- 3) Event attendees: prevent same user joining twice (optional)
-- Only add if constraint does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_attendees_event_id_profile_id_key'
      AND conrelid = 'public.event_attendees'::regclass
  ) THEN
    ALTER TABLE public.event_attendees
    ADD CONSTRAINT event_attendees_event_id_profile_id_key UNIQUE (event_id, profile_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'event_attendees: has duplicate (event_id, profile_id). Remove duplicates then re-run.';
END $$;
