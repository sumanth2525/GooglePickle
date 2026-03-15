# Pickleball Community — Latest Project Schema

This document is the single source of truth for the current data model: **Supabase (Postgres + Storage)** and **Firebase Firestore (chat)**.

---

## 1. Supabase (PostgreSQL)

Config: `SUPABASE_URL` + `SUPABASE_ANON_KEY`. Table names: set `SUPABASE_PROFILES_TABLE` and `SUPABASE_FRIEND_REQUESTS_TABLE` in `config.local.js` (see below).

### Option A: `profiles` (tied to Supabase Auth)

Use when `profiles.id` references `auth.users`. Base schema: `supabase/schema.sql`.

| Table | Purpose |
|-------|--------|
| `profiles` | User profiles (id → auth.users) |
| `friend_requests` | Friend requests between profiles |
| `events` | Home feed / event list |
| `event_details` | Single event page data |
| `courts` | Courts list |
| `chats` | Chat list metadata (title, last message) |
| `chat_messages` | Chat message rows (Supabase-side; **live chat uses Firestore**) |
| `event_attendees` | Who joined which event |

### Option B: `app_profiles` (Firebase Auth)

Use when auth is **Firebase** only (no `auth.users`). Migration: `supabase/migrations/001_app_profiles_for_firebase.sql`.

| Table | Purpose |
|-------|--------|
| `app_profiles` | User profiles (id = app-generated UUID, keyed by email) |
| `app_friend_requests` | Friend requests between app_profiles |
| *(same events, event_details, courts, chats, chat_messages, event_attendees as above)* | |

**Config:** In `config.local.js` set:

- `SUPABASE_PROFILES_TABLE: "app_profiles"`
- `SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests"`

---

### Table: `profiles` / `app_profiles`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK; app_profiles uses gen_random_uuid() |
| phone | text | |
| email | text | |
| name | text | NOT NULL, default '' |
| first_name | text | |
| last_name | text | |
| age | int | |
| player_type | text | default 'Intermediate' |
| avatar | text | URL; or use Storage bucket `avatars` |
| location | text | default 'Austin, TX' |
| city | text | |
| state | text | |
| bio | text | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `app_profiles`: `idx_app_profiles_email` on `lower(email)`.

---

### Table: `friend_requests` / `app_friend_requests`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| from_profile_id | uuid | FK → profiles(id) or app_profiles(id) |
| to_profile_id | uuid | FK → profiles(id) or app_profiles(id) |
| status | text | 'pending' \| 'accepted' \| 'rejected', default 'pending' |
| created_at | timestamptz | default now() |

Unique: `(from_profile_id, to_profile_id)`. Indexes on `to_profile_id`, `from_profile_id`.

---

### Table: `events`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| title | text | NOT NULL |
| level | text | default 'Intermediate' |
| level_primary | boolean | default true |
| date | text | NOT NULL |
| venue | text | NOT NULL |
| lat, lng | numeric | |
| distance | text | |
| format | text | default 'Doubles' |
| joined | text | default '0/4 joined' |
| joined_highlight | boolean | default false |
| image | text | |
| weather, weather_icon | text | |
| weather_active | boolean | default false |
| host_avatars | jsonb | default '[]' |
| extra_count | int | default 0 |
| cta | text | default 'Join Game' |
| cta_primary | boolean | default true |
| opacity | numeric | default 1 |
| created_by | uuid | FK profiles(id) or app_profiles(id), nullable |
| created_at, updated_at | timestamptz | |

Indexes: `idx_events_date`, `idx_events_created_at`.

---

### Table: `event_details`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, FK → events(id) ON DELETE CASCADE |
| title | text | NOT NULL |
| level | text | |
| image | text | |
| host_name, host_sub, host_avatar | text | |
| location_name | text | |
| map_image | text | |
| date, time | text | |
| player_count | text | |
| player_avatars | jsonb | default '[]' |
| description | text | |
| chat_preview | jsonb | |
| chat_count | int | default 0 |
| created_at, updated_at | timestamptz | |

---

### Table: `courts`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL |
| address | text | |
| courts | int | default 1 |
| surface | text | |
| lights | boolean | default true |
| distance | text | |
| lat, lng | numeric | |
| image | text | |
| amenities | text | |
| created_at | timestamptz | |

---

### Table: `chats` (Supabase — list only)

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| event_id | uuid | FK events(id), nullable |
| title | text | NOT NULL |
| avatar | text | |
| last_message | text | |
| time | text | |
| unread | int | default 0 |
| active | boolean | default false |
| read | boolean | default false |
| created_at, updated_at | timestamptz | |

Index: `idx_chats_time` on `updated_at desc`.

---

### Table: `chat_messages` (Supabase — optional)

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| chat_id | uuid | FK chats(id) ON DELETE CASCADE |
| author | text | |
| author_avatar | text | |
| author_id | uuid | FK profiles(id), nullable |
| text | text | NOT NULL |
| time | text | |
| image | text | |
| created_at | timestamptz | |

Index: `idx_chat_messages_chat_id`. **Note:** Live messaging in the app uses **Firebase Firestore**, not this table.

---

### Table: `event_attendees`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| event_id | uuid | FK events(id) ON DELETE CASCADE |
| profile_id | uuid | FK profiles(id) or app_profiles(id) |
| name | text | |
| avatar | text | |
| joined_at | timestamptz | default now() |

Unique: `(event_id, profile_id)`. Index: `idx_event_attendees_event_id`.

---

### RLS

All tables use RLS with anon policies for SELECT, INSERT, UPDATE (and where applicable). Tighten for production (e.g. restrict by `auth.uid()` or app user id).

---

## 2. Supabase Storage

Migration: `supabase/migrations/002_storage_avatars_bucket.sql`.

| Bucket | Public | Policies |
|--------|--------|----------|
| avatars | true | Public read; anon INSERT and UPDATE |

- Path for profile photo: `{profileId}.jpg` (see `SupabaseService.uploadProfilePhoto`).

---

## 3. Firebase Firestore (Live Chat)

Used for **real-time group and event chat** (and DMs). Config: Firebase in `config.local.js`. Schema: `app/CHAT_SCHEMA.md`.

```
chats (collection)
  └── {chatId} (document)     e.g. "event-1" or "dm-{uid1}-{uid2}"
        ├── title (string)
        ├── eventId (string)
        ├── lastMessageAt (timestamp)
        ├── lastMessageBody (string)
        └── messages (subcollection)
              └── {messageId}
                    ├── body (string)      required
                    ├── authorName (string) required
                    ├── authorAvatar (string)
                    ├── userId (string)
                    ├── createdAt (timestamp) required
                    └── imageUrl (string)
```

- **Chat list** in the app: Supabase `chats` table or MOCK.
- **Live messages**: Firestore `chats/{chatId}/messages` via `ChatService` (`js/services/chat.js`).

---

## 4. Summary

| Data | Where |
|------|--------|
| Profiles, friend requests | Supabase: `profiles` + `friend_requests` **or** `app_profiles` + `app_friend_requests` |
| Events, event_details, courts | Supabase |
| Chat list (title, preview) | Supabase `chats` or MOCK |
| Live chat messages | **Firebase Firestore** `chats/{chatId}/messages` |
| Profile avatars | Supabase Storage bucket `avatars` |
| Auth | Firebase Auth (app uses this; Supabase Auth not required) |

---

## 5. Migration order (new project)

1. Run `supabase/schema.sql` (or your base schema).
2. If using Firebase Auth: run `supabase/migrations/001_app_profiles_for_firebase.sql`.
3. Run `supabase/migrations/002_storage_avatars_bucket.sql`.
4. Optionally run `supabase/migrations/003_seed_test_profile.sql`.
5. For existing DBs: run `supabase/migrations/001_existing_db_sync.sql` if you need extra columns or friend_requests on existing tables.
