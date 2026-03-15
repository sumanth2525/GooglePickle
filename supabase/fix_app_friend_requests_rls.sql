-- Fix app_friend_requests RLS so anon can SELECT, INSERT, and UPDATE.
-- Run in Supabase Dashboard → SQL Editor. Then hard refresh the app (Ctrl+F5).

ALTER TABLE public.app_friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read app_friend_requests" ON public.app_friend_requests;
DROP POLICY IF EXISTS "Allow anon insert app_friend_requests" ON public.app_friend_requests;
DROP POLICY IF EXISTS "Allow anon update app_friend_requests" ON public.app_friend_requests;

CREATE POLICY "Allow anon read app_friend_requests" ON public.app_friend_requests
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert app_friend_requests" ON public.app_friend_requests
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update app_friend_requests" ON public.app_friend_requests
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
