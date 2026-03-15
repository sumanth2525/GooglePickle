# Fixes & Tests Summary — Social + Sports Event Club App

This document summarizes the bug fixes, unit tests, and UI improvements completed for the app (hybrid **social media + sports event club**).

---

## 1. Direct Messages / View Profile Bug + Unit Tests

### What was the bug?
In **Chat → Direct Messages → Compose Message**, when you clicked on a person and then **View Profile**, the app navigated to **your own profile** instead of the **selected user’s profile**.

### Root cause
- The Players list (and compose list) used a single “View Profile” handler that always set `window.location.hash = "profile"` (no user id).
- The router then rendered the **current user’s profile** whenever `page === "profile"` and no id was present.

### How it was fixed
- **View Profile** now passes the **target user’s id**: each card has `data-player-id="${p.id}"` and the click handler sets `window.location.hash = playerId ? "#profile/" + playerId : "#profile"`.
- In `render()`, when the route is `page === "profile"` and an **id** is present, the app calls **`renderOtherProfile(id)`** instead of `renderProfile()`.
- **`renderOtherProfile(playerId)`** loads the other user’s profile (from `MOCK.players` or, when configured, **`SupabaseService.getProfileById(playerId)`**) and shows a read-only profile with “Message” and “Back to Players”.

### Unit tests added (Vitest)
- **`tests/unit/route.test.js`**  
  - `#profile/123` and `#profile/<uuid>` parse to `{ page: "profile", id: "123" }` and uuid as `id`.
- **`tests/unit/profile-route.test.js`**  
  - **`getProfileViewRoute(playerId)`** builds `"#profile/" + playerId` so View Profile links include the player id.  
  - Tests that the DM/compose flow contract (route for viewing another user’s profile) is correct.

### Summary table

| Item        | Description |
|------------|-------------|
| **Bug**    | View Profile from compose opened current user’s profile. |
| **Cause**  | Hash was always `#profile` (no id); app always rendered own profile. |
| **Fix**    | View Profile sets `#profile/<playerId>`; app renders `renderOtherProfile(id)`. |
| **Tests**  | Route parsing for `#profile/<id>`; profile view route helper and DM/compose contract. |

---

## 2. New User Not Appearing in Players List

### What was the bug?
After a new user **signed up with Firebase Auth**, they did **not** appear in the **All Players** list in the Players section.

### Root cause
- Players list was driven only by **mock data** (`MOCK.players`) when Supabase was used without syncing Firebase users into Supabase `profiles`.
- New Firebase accounts were not written to Supabase, so `getProfiles()` never returned them.

### How it was fixed
- **Firebase → Supabase sync:** In the Firebase `init` callback, when a user is logged in, the app calls **`SupabaseService.getOrCreateProfileByEmail(user.email, { name, firstName, lastName, avatar, location, playerType })`**. On success it calls **`saveUserProfile({ profileId: profile.id })`**. So every (new or returning) Firebase user gets a Supabase profile.
- **Players list source:** **`renderPlayers()`** now uses **`SupabaseService.getProfiles()`** when Supabase is configured and passes the result into **`applyPlayersList()`**, so the list shows all Supabase profiles (including newly registered users) instead of only mock data.

### Summary table

| Item        | Description |
|------------|-------------|
| **Bug**    | New Firebase users did not show in All Players. |
| **Cause**  | No sync from Firebase Auth to Supabase `profiles`; list used only mock data. |
| **Fix**    | On login, get-or-create Supabase profile by email; Players list uses `getProfiles()`. |

---

## 3. Dashboard & Create Event UI/UX

### Changes made
- **Home (Dashboard):** Added a short tagline under the user name: *“Find games & connect with players”* for a clearer social + club feel.
- **Create Event:**  
  - Header with light gradient and clearer hierarchy.  
  - Section label styling (uppercase, tracking) for “Event Name”.  
  - Inputs with visible borders and focus ring.  
  - Primary CTA: “Create Event” button with icon, rounded-2xl, shadow, and hover/active states.  
  - Bottom nav with backdrop blur for a more polished look.

---

## 4. Courts Page Showing No Data

### What was the bug?
The **Courts** page showed **no data** even though court data exists under **`Data/Courts/pickleball_courts.json`**.

### Root cause
- **`app/js/courts-data.js`** already maps that JSON into **`MOCK.courts`** (22 courts) and is loaded after **`data.js`** in **`index.html`**.
- **`renderCourts()`** preferred Supabase: when Supabase was configured but returned an **empty array** `[]`, it called **`applyCourts([])`**, so the UI showed no courts and did not fall back to **`MOCK.courts`**.

### How it was fixed
- **Fallback logic:** When Supabase is configured, the app now uses **`MOCK.courts`** when Supabase returns **null** or an **empty array**:  
  `applyCourts((data && data.length) ? data : (MOCK.courts || []))`.  
  Same fallback on Supabase error and in the non-Supabase branch: **`applyCourts(MOCK.courts || [])`**.
- With **`courts-data.js`** in place, **`MOCK.courts`** is the 22 courts from **`Data/Courts/pickleball_courts.json`**, so the Courts page now shows all of them when Supabase has no courts.

### Summary table

| Item        | Description |
|------------|-------------|
| **Bug**    | Courts page showed no data. |
| **Cause**  | Supabase empty array was used as-is; no fallback to `MOCK.courts` (filled by courts-data.js). |
| **Fix**    | Use Supabase result only if non-empty; otherwise use `MOCK.courts`. Data from `Data/Courts/` via `courts-data.js`. |

---

## 5. Overall App Direction (Rewritten Prompt)

Use this as a short, copy-paste prompt for future work:

---

**1. Direct Messages / View Profile**  
- In Chat → Direct Messages → Compose, clicking “View Profile” on a user must open **that user’s profile**, not the logged-in user’s. Implement `#profile/<id>` and `renderOtherProfile(id)`; add unit tests for route and View Profile behavior.

**2. New users in Players list**  
- When a user registers with Firebase Auth, ensure their profile is created/updated in Supabase (e.g. `getOrCreateProfileByEmail` on login). The Players list should be driven by Supabase `getProfiles()` so new users appear after the next load.

**3. Dashboard & Create Event UI/UX**  
- Improve the Dashboard and Create Event flow with clear hierarchy, modern styling, and a “social + sports club” feel (tagline, gradients, section labels, primary CTA, bottom nav).

**4. Courts page data**  
- Courts page must show data from project **`Data/Courts/`** (e.g. **`pickleball_courts.json`**). Use **`app/js/courts-data.js`** to map JSON into **`MOCK.courts`** and ensure **`renderCourts()`** falls back to **`MOCK.courts`** when Supabase returns no courts.

**5. Product direction**  
- The app is a **hybrid social media + sports event club**: connect with players (social), discover/create/join events (club), view courts and profiles, and message — all in one cohesive experience.

---

## Files touched (reference)

- **`app/js/app.js`** — View Profile hash and handler, `renderOtherProfile()`, `render()` profile branch, Firebase→Supabase sync, `renderPlayers()` with `getProfiles()`, `renderCourts()` fallback, Home tagline, Create Event UI.
- **`app/js/services/supabase.js`** — `getProfileById()`, `getProfiles()`, `getOrCreateProfileByEmail()` (used for sync).
- **`tests/unit/route.test.js`** — `#profile/<id>` route tests.
- **`tests/unit/profile-route.test.js`** — Profile view route and DM/compose contract tests.
- **`app/js/courts-data.js`** — Already present; maps **`Data/Courts/pickleball_courts.json`** into **`MOCK.courts`**.
- **`docs/FIXES-AND-TESTS-SUMMARY.md`** — This summary.

All 101 unit tests pass (including the new profile-route and route tests).
