-- Permanent fix: one row per email in app_profiles.
-- 1) Deduplicate: keep one profile per lower(email), point FKs to it, delete rest.
-- 2) Add UNIQUE on lower(email) so duplicates cannot be created again.
-- Run once in Supabase SQL Editor.

-- Step 1: Update app_friend_requests so duplicate profile ids point to the keeper (oldest by created_at)
UPDATE public.app_friend_requests AS fr
SET from_profile_id = k.keeper_id
FROM (
  SELECT ap.id, (SELECT ap2.id FROM public.app_profiles ap2
                WHERE lower(ap2.email) = lower(ap.email) AND ap2.email IS NOT NULL
                ORDER BY ap2.created_at ASC NULLS LAST LIMIT 1) AS keeper_id
  FROM public.app_profiles ap
  WHERE ap.email IS NOT NULL
) AS k
WHERE fr.from_profile_id = k.id AND k.id <> k.keeper_id;

UPDATE public.app_friend_requests AS fr
SET to_profile_id = k.keeper_id
FROM (
  SELECT ap.id, (SELECT ap2.id FROM public.app_profiles ap2
                WHERE lower(ap2.email) = lower(ap.email) AND ap2.email IS NOT NULL
                ORDER BY ap2.created_at ASC NULLS LAST LIMIT 1) AS keeper_id
  FROM public.app_profiles ap
  WHERE ap.email IS NOT NULL
) AS k
WHERE fr.to_profile_id = k.id AND k.id <> k.keeper_id;

-- Step 2: Remove duplicate friend_request rows (same from/to after merge)
DELETE FROM public.app_friend_requests a
USING public.app_friend_requests b
WHERE a.id > b.id AND a.from_profile_id = b.from_profile_id AND a.to_profile_id = b.to_profile_id;

-- Step 3: Delete duplicate app_profiles (keep one per lower(email), the oldest)
DELETE FROM public.app_profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY created_at ASC NULLS LAST) AS rn
    FROM public.app_profiles
    WHERE email IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Step 4: Unique constraint so one row per email (case-insensitive) from now on
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_profiles_email_lower_unique
  ON public.app_profiles (lower(email))
  WHERE email IS NOT NULL;
