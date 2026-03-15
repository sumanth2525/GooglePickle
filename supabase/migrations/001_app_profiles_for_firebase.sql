-- Migration: Add app profile table for Pickleball app (Firebase Auth).
-- Your existing schema uses profiles(id) FK to auth.users. This app uses Firebase Auth,
-- so it needs its own table (no auth.users). Run this in Supabase SQL Editor.
-- Leaves your existing tables (profiles, players, events, chat_rooms, etc.) unchanged.

-- Table for Pickleball app user profiles (keyed by email; id is app-generated uuid).
CREATE TABLE IF NOT EXISTS public.app_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  email text,
  name text NOT NULL DEFAULT '',
  first_name text,
  last_name text,
  age int,
  player_type text DEFAULT 'Intermediate',
  avatar text,
  location text DEFAULT 'Austin, TX',
  city text,
  state text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_profiles_email ON public.app_profiles (lower(email));

ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read app_profiles" ON public.app_profiles FOR SELECT USING (true);
CREATE POLICY "Allow anon insert app_profiles" ON public.app_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update app_profiles" ON public.app_profiles FOR UPDATE USING (true);

-- Optional: app-level friend_requests for this app (separate from your existing friend_requests).
CREATE TABLE IF NOT EXISTS public.app_friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id uuid NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_profile_id, to_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_app_friend_requests_to ON public.app_friend_requests(to_profile_id);
CREATE INDEX IF NOT EXISTS idx_app_friend_requests_from ON public.app_friend_requests(from_profile_id);
ALTER TABLE public.app_friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read app_friend_requests" ON public.app_friend_requests FOR SELECT USING (true);
CREATE POLICY "Allow anon insert app_friend_requests" ON public.app_friend_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update app_friend_requests" ON public.app_friend_requests FOR UPDATE USING (true);
