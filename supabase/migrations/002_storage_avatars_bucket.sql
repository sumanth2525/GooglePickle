-- Profile photo uploads: create public bucket "avatars" and allow anon to upload/update.
-- Run this in Supabase SQL Editor if you use the in-app "Upload photo" with Supabase.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read (public bucket).
CREATE POLICY "Allow public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow anon to upload new profile photos (app uses anon key).
CREATE POLICY "Allow anon insert avatars"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'avatars');

-- Allow anon to update (upsert overwrites same path).
CREATE POLICY "Allow anon update avatars"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'avatars');
