-- =============================================================================
-- Pickleball Community — Apply full schema (new project)
-- Run this entire file in Supabase Dashboard → SQL Editor (one shot).
-- Creates: Option A (profiles, friend_requests) + Option B (app_profiles,
-- app_friend_requests), events, event_details, courts, chats, chat_messages,
-- event_attendees, Storage bucket avatars, and seed data.
-- =============================================================================

-- ---------- 1. Base schema (Option A: profiles + friend_requests) ----------
-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- Friend requests
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

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  level text DEFAULT 'Intermediate',
  level_primary boolean DEFAULT true,
  date text NOT NULL,
  venue text NOT NULL,
  lat numeric,
  lng numeric,
  distance text,
  format text DEFAULT 'Doubles',
  joined text DEFAULT '0/4 joined',
  joined_highlight boolean DEFAULT false,
  image text,
  weather text,
  weather_icon text,
  weather_active boolean DEFAULT false,
  host_avatars jsonb DEFAULT '[]',
  extra_count int DEFAULT 0,
  cta text DEFAULT 'Join Game',
  cta_primary boolean DEFAULT true,
  opacity numeric DEFAULT 1,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Event details
CREATE TABLE IF NOT EXISTS public.event_details (
  id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  level text,
  image text,
  host_name text,
  host_sub text,
  host_avatar text,
  location_name text,
  map_image text,
  date text,
  time text,
  player_count text,
  player_avatars jsonb DEFAULT '[]',
  description text,
  chat_preview jsonb,
  chat_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Courts
CREATE TABLE IF NOT EXISTS public.courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  courts int DEFAULT 1,
  surface text,
  lights boolean DEFAULT true,
  distance text,
  lat numeric,
  lng numeric,
  image text,
  amenities text,
  created_at timestamptz DEFAULT now()
);

-- Chats (list metadata)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  avatar text,
  last_message text,
  time text,
  unread int DEFAULT 0,
  active boolean DEFAULT false,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat messages (Supabase; live chat uses Firestore)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  author text,
  author_avatar text,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  text text NOT NULL,
  time text,
  image text,
  created_at timestamptz DEFAULT now()
);

-- Event attendees
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text,
  avatar text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(event_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_time ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON public.event_attendees(event_id);

-- RLS (Option A tables)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow anon insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow anon read friend_requests" ON public.friend_requests FOR SELECT USING (true);
CREATE POLICY "Allow anon insert friend_requests" ON public.friend_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update friend_requests" ON public.friend_requests FOR UPDATE USING (true);

CREATE POLICY "Allow anon read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow anon insert events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update events" ON public.events FOR UPDATE USING (true);

CREATE POLICY "Allow anon read event_details" ON public.event_details FOR SELECT USING (true);
CREATE POLICY "Allow anon insert event_details" ON public.event_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update event_details" ON public.event_details FOR UPDATE USING (true);

CREATE POLICY "Allow anon read courts" ON public.courts FOR SELECT USING (true);
CREATE POLICY "Allow anon insert courts" ON public.courts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "Allow anon insert chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update chats" ON public.chats FOR UPDATE USING (true);

CREATE POLICY "Allow anon read chat_messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow anon insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read event_attendees" ON public.event_attendees FOR SELECT USING (true);
CREATE POLICY "Allow anon insert event_attendees" ON public.event_attendees FOR INSERT WITH CHECK (true);

-- Optional: backfill columns on existing profiles (no-op if already present)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS player_type text DEFAULT 'Intermediate';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

-- Seed test profiles (Option A)
INSERT INTO public.profiles (id, phone, email, name, avatar, location) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, '+15125551111', 'alex@example.com', 'Alex Rivers', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjcXVDOMD2-VXu2A2iBCoXB5LDaO26iuIAQ-lPQ5JuAZSBXfbCjHboooLZwoj0V76aKbemIc9U3vUI-8p0KZrhhgKYgC9g550o0deo2hlpJz7-1kAOzBlV6QU7ingYnVYzyOWYXFnDDTaIjSUrHn1GSRhsAOqSX_7XMgmKRHLwAp32PGrLiLwx3P_4tC__x1Ufwjvuscmo2YjbG06L7JrxgLbeuUgOsQka1uEzKs4hkv7uRBjtu7DwnnSm__4Jk00ZqqQJ3-rm38U', 'Austin, TX'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, '+15125552222', 'sarah@example.com', 'Sarah Chen', 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-1ili5Ekj5HFDqmDS_C07NI0uF7KcTFNIVgmxDHwIiFV5uM5AsZA6z9f9L72qyU9wncb4lyEuqu-v6O4wGYJzRhmWllb99EY7enMgl15rn0U9pKe9QVPoXX4ySh3LpZth6MwN08D_TKUC-Cw7YUELNssxhgu07iRWnznDlqFOz2V6-mZE7h6R9oJUpFvjCTIz-lAbrv7lkh56WU9rsRZ3svsRgJbqfKilSWheHky-IWtu9gPNaSRGegyfwo2wYiOMhq5cjg1eN4I', 'Round Rock, TX'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, '+15125553333', 'jordan@example.com', 'Jordan Miller', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXXLtT_Y0KGbhdus9gvoU03KtjYGtJI1sBxWwN0jp4MxRk7k4majHYGbSTZzalvGsUgZ9sT7uET5iUJywJh3bMTbzorvK8VkBZxEKyDrTG-lZbKOKJURqw1H18dZibnfqpNw_g0GFJqZ2YH1alPfNjY_JTochd6Tgehor6sVFbQ5qYWH5MeOncU8kYEBwiThD-kgG-8W-9W7T_J-cV-qPiwUnMXwQ9VaaTSJfwSho11el-JOeEhFL6bQUdLyEXhCZBX1eesu67JgA', 'Austin, TX')
ON CONFLICT (id) DO NOTHING;

-- ---------- 2. Option B: app_profiles + app_friend_requests (Firebase Auth) ----------
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

-- ---------- 3. Storage: avatars bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Allow anon insert avatars"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow anon update avatars"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'avatars');

-- ---------- 4. Seed app_profiles test user (Option B) ----------
INSERT INTO public.app_profiles (
  email, name, first_name, last_name, age, city, state, location, player_type, bio
)
SELECT
  'test@pickleball.example.com',
  'Test Player',
  'Test',
  'Player',
  28,
  'Austin',
  'TX',
  'Austin, TX',
  'Intermediate',
  'Test profile for Pickleball app.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_profiles WHERE email = 'test@pickleball.example.com');

-- Done. Set SUPABASE_PROFILES_TABLE / SUPABASE_FRIEND_REQUESTS_TABLE in config.local.js:
--   Option A: "profiles", "friend_requests"
--   Option B: "app_profiles", "app_friend_requests"
