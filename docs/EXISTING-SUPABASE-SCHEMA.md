# Using the app with your existing Supabase schema

Your Supabase project already has tables like **profiles** (id → auth.users), **players**, **events**, **chat_rooms**, **messages**, **friend_requests** (user_id → auth.users), etc. This app uses **Firebase Auth**, not Supabase Auth, so it cannot use rows in **auth.users** or tables that reference them for profile data.

## What the app uses now

- **Auth:** Firebase only (no change).
- **Profile storage:** The app uses configurable table names:
  - **Default:** `profiles` and `friend_requests` — so it works with the project’s `supabase/schema.sql` (creates `profiles` with email, name, first_name, last_name, age, player_type, etc.).
  - **If you have an existing schema** where `profiles` is tied to **auth.users** (different columns), run the migration below to create **app_profiles** and **app_friend_requests**, then set in `config.local.js` (or env): `SUPABASE_PROFILES_TABLE: "app_profiles"` and `SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests"`.
- **Events / courts / chats:** The app still expects the tables from `supabase/schema.sql` if you use those features. For Profile and Players only, see below.

## What to run in Supabase (SQL Editor)

**If your DB already has `profiles` (id → auth.users)** and you don’t want to change it, run:

**File:** `supabase/migrations/001_app_profiles_for_firebase.sql`

It creates:

| Table             | Purpose |
|-------------------|--------|
| **app_profiles**  | One row per Firebase user (by email). Columns: id, email, name, first_name, last_name, age, player_type, avatar, location, city, state, bio, etc. |
| **app_friend_requests** | Friend requests between **app_profiles** (from_profile_id, to_profile_id). |

Then set in config: `SUPABASE_PROFILES_TABLE: "app_profiles"` and `SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests"`.

Your existing **profiles**, **players**, **events**, **chat_rooms**, **messages**, **friend_requests**, etc. are **unchanged**.

## Your existing schema (reference)

- **profiles** – id (auth.users), display_name, avatar_url, skill, location, lat, lng, bio, …
- **players** – user_id → auth.users, name, skill, location, …
- **events** – created_by → auth.users, title, type, date, location, …
- **friend_requests** – from_user_id, to_user_id → auth.users
- **chat_rooms**, **messages**, **event_registrations**, **notifications**, **friendships** – all reference auth.users

The Pickleball app does **not** write to these tables. It only reads/writes **app_profiles** and **app_friend_requests** for Profile and Players (find people).

## Profile photo upload (optional)

To use **Upload photo** in Edit profile, run **`supabase/migrations/002_storage_avatars_bucket.sql`** in the SQL Editor. It creates a public **avatars** storage bucket and policies so the app can upload resized profile images (small size for speed and less memory).

## If you want to use your existing events/chat later

You could later map this app’s “events” to your **events** table (and chat to **chat_rooms** / **messages**) by changing column names and FKs in the app or adding views. For now, running the migration above is enough for Profile and Players.
