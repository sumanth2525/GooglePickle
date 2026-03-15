-- Fix app_profiles RLS so anon can SELECT and INSERT (and UPDATE).
-- Run in Supabase Dashboard → SQL Editor. Then hard refresh the app (Ctrl+F5).

ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read app_profiles" ON public.app_profiles;
DROP POLICY IF EXISTS "Allow anon insert app_profiles" ON public.app_profiles;
DROP POLICY IF EXISTS "Allow anon update app_profiles" ON public.app_profiles;

CREATE POLICY "Allow anon read app_profiles" ON public.app_profiles
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert app_profiles" ON public.app_profiles
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update app_profiles" ON public.app_profiles
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
