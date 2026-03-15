# Supabase migrations — Pickleball Community

## New project (create database and tables)

**One script:** run **`apply_new_project.sql`** in Supabase Dashboard → SQL Editor.  
This creates all tables (Option A + Option B), RLS, Storage bucket `avatars`, and seed data.

## Run migrations individually

If you prefer to run files in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `schema.sql` | Base schema: profiles, friend_requests, events, event_details, courts, chats, chat_messages, event_attendees + RLS + seed |
| 2 | `migrations/001_app_profiles_for_firebase.sql` | Option B: app_profiles, app_friend_requests (when using Firebase Auth only) |
| 3 | `migrations/002_storage_avatars_bucket.sql` | Storage bucket `avatars` (public read; anon insert/update) |
| 4 | `migrations/003_seed_test_profile.sql` | Seed one test row in app_profiles |
| 5 | `migrations/001_existing_db_sync.sql` | **Existing DBs only:** add columns / friend_requests if you already had tables |
| 6 | `migrations/005_dedupe_app_profiles_unique_email.sql` | **Run once if you see PGRST116:** dedupe app_profiles by email and add UNIQUE (lower(email)) |

## Config (config.local.js)

- **Option A (Supabase Auth):**  
  `SUPABASE_PROFILES_TABLE: "profiles"`, `SUPABASE_FRIEND_REQUESTS_TABLE: "friend_requests"`
- **Option B (Firebase Auth):**  
  `SUPABASE_PROFILES_TABLE: "app_profiles"`, `SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests"`
