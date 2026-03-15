-- Seed one test profile for app_profiles (run in Supabase SQL Editor).
-- Use this to verify the table and UI. To see it in the app, log in with test@pickleball.example.com
-- (you’d need that user in Firebase) or just run SELECT to confirm the row exists.

INSERT INTO public.app_profiles (
  email,
  name,
  first_name,
  last_name,
  age,
  city,
  state,
  location,
  player_type,
  bio
) VALUES (
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
);
