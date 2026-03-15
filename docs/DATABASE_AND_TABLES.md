# Pickleball Community — Complete Database & Tables

Single reference for all databases and tables in the project.

---

## Overview

| System | Purpose |
|--------|--------|
| **Supabase (PostgreSQL)** | Profiles, friends, events, courts, chat list, chat messages, attendees |
| **Supabase Storage** | Profile avatar images (bucket `avatars`) |
| **Firebase Firestore** | Live chat messages (real-time) |

---

# 1. Supabase — PostgreSQL (public schema)

## 1.1 profiles

User profiles (use when `profiles.id` ties to Supabase Auth `auth.users`).

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| phone | text | | |
| email | text | | |
| name | text | '' | NOT NULL |
| first_name | text | | |
| last_name | text | | |
| age | int | | |
| player_type | text | 'Intermediate' | |
| avatar | text | | |
| location | text | 'Austin, TX' | |
| city | text | | |
| state | text | | |
| bio | text | | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

---

## 1.2 app_profiles

User profiles for Firebase Auth (no `auth.users`). Use with config: `SUPABASE_PROFILES_TABLE: "app_profiles"`.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| phone | text | | |
| email | text | | |
| name | text | '' | NOT NULL |
| first_name | text | | |
| last_name | text | | |
| age | int | | |
| player_type | text | 'Intermediate' | |
| avatar | text | | |
| location | text | 'Austin, TX' | |
| city | text | | |
| state | text | | |
| bio | text | | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Index:** `idx_app_profiles_email` on `lower(email)`.

---

## 1.3 friend_requests

Friend requests between users (references `profiles`).

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| from_profile_id | uuid | | NOT NULL, FK → profiles(id) ON DELETE CASCADE |
| to_profile_id | uuid | | NOT NULL, FK → profiles(id) ON DELETE CASCADE |
| status | text | 'pending' | NOT NULL; 'pending' \| 'accepted' \| 'rejected' |
| created_at | timestamptz | now() | |

**Unique:** (from_profile_id, to_profile_id).  
**Indexes:** idx_friend_requests_to, idx_friend_requests_from.

---

## 1.4 app_friend_requests

Friend requests between `app_profiles`. Use with config: `SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests"`.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| from_profile_id | uuid | | NOT NULL, FK → app_profiles(id) ON DELETE CASCADE |
| to_profile_id | uuid | | NOT NULL, FK → app_profiles(id) ON DELETE CASCADE |
| status | text | 'pending' | NOT NULL; 'pending' \| 'accepted' \| 'rejected' |
| created_at | timestamptz | now() | |

**Unique:** (from_profile_id, to_profile_id).  
**Indexes:** idx_app_friend_requests_to, idx_app_friend_requests_from.

---

## 1.5 events

Home feed / event list.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| title | text | | NOT NULL |
| level | text | 'Intermediate' | |
| level_primary | boolean | true | |
| date | text | | NOT NULL |
| venue | text | | NOT NULL |
| lat | numeric | | |
| lng | numeric | | |
| distance | text | | |
| format | text | 'Doubles' | |
| joined | text | '0/4 joined' | |
| joined_highlight | boolean | false | |
| image | text | | |
| weather | text | | |
| weather_icon | text | | |
| weather_active | boolean | false | |
| host_avatars | jsonb | '[]' | |
| extra_count | int | 0 | |
| cta | text | 'Join Game' | |
| cta_primary | boolean | true | |
| opacity | numeric | 1 | |
| created_by | uuid | | FK → profiles(id) ON DELETE SET NULL |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Indexes:** idx_events_date, idx_events_created_at (created_at DESC).

---

## 1.6 event_details

Single event page (one row per event; id = events.id).

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | | PK, FK → events(id) ON DELETE CASCADE |
| title | text | | NOT NULL |
| level | text | | |
| image | text | | |
| host_name | text | | |
| host_sub | text | | |
| host_avatar | text | | |
| location_name | text | | |
| map_image | text | | |
| date | text | | |
| time | text | | |
| player_count | text | | |
| player_avatars | jsonb | '[]' | |
| description | text | | |
| chat_preview | jsonb | | |
| chat_count | int | 0 | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

---

## 1.7 courts

Courts list.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| name | text | | NOT NULL |
| address | text | | |
| courts | int | 1 | |
| surface | text | | |
| lights | boolean | true | |
| distance | text | | |
| lat | numeric | | |
| lng | numeric | | |
| image | text | | |
| amenities | text | | |
| created_at | timestamptz | now() | |

---

## 1.8 chats

Conversation list (Messages tab). Live message content uses Firestore.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| event_id | uuid | | FK → events(id) ON DELETE SET NULL |
| title | text | | NOT NULL |
| avatar | text | | |
| last_message | text | | |
| time | text | | |
| unread | int | 0 | |
| active | boolean | false | |
| read | boolean | false | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Index:** idx_chats_time (updated_at DESC).

---

## 1.9 chat_messages

Stored chat messages (optional; app live chat uses Firestore).

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| chat_id | uuid | | NOT NULL, FK → chats(id) ON DELETE CASCADE |
| author | text | | |
| author_avatar | text | | |
| author_id | uuid | | profiles(id) or app_profiles id |
| text | text | | NOT NULL |
| time | text | | |
| image | text | | |
| created_at | timestamptz | now() | |

**Index:** idx_chat_messages_chat_id.

---

## 1.10 event_attendees

Who joined which event.

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | uuid | gen_random_uuid() | PK |
| event_id | uuid | | NOT NULL, FK → events(id) ON DELETE CASCADE |
| profile_id | uuid | | FK → profiles(id) ON DELETE CASCADE |
| name | text | | |
| avatar | text | | |
| joined_at | timestamptz | now() | |

**Unique:** (event_id, profile_id).  
**Index:** idx_event_attendees_event_id.

---

# 2. Supabase — Storage

## 2.1 Bucket: avatars

| Property | Value |
|----------|--------|
| id | avatars |
| name | avatars |
| public | true |

**Policies:** Public read; anon INSERT and UPDATE.  
**Usage:** Profile photos; path `{profileId}.jpg`.

---

# 3. Firebase — Firestore

## 3.1 Collection: chats

One document per conversation (event or DM). Document ID examples: `event-1`, `dm-{uid1}-{uid2}`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | No | e.g. "Morning Doubles @ Zilker" |
| eventId | string | No | Links to event |
| lastMessageAt | timestamp | No | Updated on each send |
| lastMessageBody | string | No | Last message preview |

### Subcollection: chats/{chatId}/messages

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| body | string | Yes | Message text |
| authorName | string | Yes | Display name |
| authorAvatar | string | No | Avatar URL |
| userId | string | No | For "me" and auth |
| createdAt | timestamp | Yes | Server timestamp preferred |
| imageUrl | string | No | Attachment |

---

# 4. Table summary (Supabase only)

| Table | Used when |
|-------|-----------|
| profiles | Supabase Auth |
| app_profiles | Firebase Auth (current app config) |
| friend_requests | With profiles |
| app_friend_requests | With app_profiles (current app config) |
| events | Always |
| event_details | Always |
| courts | Always |
| chats | Always (chat list) |
| chat_messages | Optional (live chat is Firestore) |
| event_attendees | Always |

---

# 5. Run order (fresh Supabase project)

1. **supabase/schema.sql** — profiles, friend_requests, events, event_details, courts, chats, chat_messages, event_attendees, RLS, indexes.
2. **supabase/migrations/001_app_profiles_for_firebase.sql** — app_profiles, app_friend_requests (if using Firebase Auth).
3. **supabase/migrations/002_storage_avatars_bucket.sql** — Storage bucket `avatars` and policies.
4. **supabase/migrations/004_chat_schema.sql** — Optional; (re)create chats + chat_messages with RLS (safe if already in schema.sql).
5. **supabase/migrations/003_seed_test_profile.sql** — Optional seed for app_profiles.

Firestore: configure in Firebase Console (Rules + create `chats` collection as needed by app).
