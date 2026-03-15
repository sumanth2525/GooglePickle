# Step-by-step: What to add now

Use **`app/js/config.local.js`** for all values. Replace the empty strings `""` with your real values.

---

## 1. Firebase (Google sign-in + email sign-in)

1. Go to [Firebase Console](https://console.firebase.google.com/) and open your project (or create one).
2. Click the **gear** next to "Project Overview" → **Project settings**.
3. Under **Your apps**, select your web app (or add one; pick "Web" and register the app).
4. Copy each value into `config.local.js`:

   | In config.local.js   | In Firebase Console |
   |----------------------|----------------------|
   | `FIREBASE_API_KEY`  | "API Key" (starts with `AIza...`) |
   | `FIREBASE_AUTH_DOMAIN` | "Auth domain" (e.g. `myproject.firebaseapp.com`) |
   | `FIREBASE_PROJECT_ID`  | "Project ID" |
   | `FIREBASE_STORAGE_BUCKET` | "Storage bucket" (e.g. `myproject.appspot.com`) |
   | `FIREBASE_MESSAGING_SENDER_ID` | "Messaging sender ID" (numeric) |
   | `FIREBASE_APP_ID`    | "App ID" (e.g. `1:123456:web:abc...`) |

5. In Firebase: **Authentication** → **Sign-in method** → enable **Google** and **Email/Password**.
6. In Firebase: **Authentication** → **Settings** → **Authorized domains** → add `localhost` (and your production domain when you deploy).

After this, **Firebase Auth (Google + email) works** once you save and reload the app.

---

## 2. Supabase (events, courts, chats, **Players** from database)

**How it fits with Firebase:**  
- **Auth** = **Firebase only** (sign-in, login, account identity).  
- **Account (profile) creation** = **Supabase only**: when a user signs in with Firebase, the app creates or updates their row in Supabase `profiles` (by email). All profile data lives in Supabase.  
- **Find people** = **Supabase only**: the app uses `findPeople()` to query `profiles` by city, player type, or search text. Events, courts, chats, and the Players list all use Supabase. **You need both Firebase and Supabase configured** for the Players section to show real users.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. **Settings** (gear) → **API**.
3. Copy into `config.local.js`:

   | In config.local.js | In Supabase |
   |--------------------|-------------|
   | `SUPABASE_URL`     | "Project URL" (e.g. `https://xxxx.supabase.co`) |
   | `SUPABASE_ANON_KEY`| "Project API keys" → **anon** **public** key (long JWT) |

4. Run the SQL in **`supabase/schema.sql`** in Supabase → **SQL Editor** if you haven’t already (creates tables and RLS).
5. **Profile photo upload:** To use “Upload photo” in Edit profile, run **`supabase/migrations/002_storage_avatars_bucket.sql`** in the SQL Editor. It creates a public **avatars** bucket and allows the app to upload resized profile images (small file size for speed).

After this, **events, courts, chats, and the Players list** can come from Supabase instead of mock data. Each Firebase user who opens the app gets a Supabase profile (by email); they then show up in **Players** for others.

---

## 3. Twilio (SMS OTP for phone login)

1. **Auth server env (not config.local.js):**  
   Copy **`server/.env.example`** to **`server/.env`**.
2. In [Twilio Console](https://console.twilio.com/): **Account** → get **Account SID** and **Auth Token**.
3. In Twilio: **Verify** → **Services** → create a service → copy the **SID** (starts with `VA...`).
4. In **`server/.env`** set:
   - `TWILIO_ACCOUNT_SID=AC...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_VERIFY_SERVICE_SID=VA...`
5. Start the auth server: `npm run auth-server`.

`config.local.js` already has `SEND_CODE_URL` and `VERIFY_CODE_URL` pointing to `http://localhost:3081`. No change needed there unless your app or server run on different ports.

After this, **phone OTP login** works when the auth server is running and the number is verified (on trial accounts).

---

## 4. OneSignal (push notifications + notify event creators, optional)

1. Go to [OneSignal](https://onesignal.com/) and create or open your app.
2. **Settings** → **Keys & IDs** → copy **OneSignal App ID** and **REST API Key**.
3. In `app/js/config.local.js` set:
   - `ONESIGNAL_APP_ID: "your-app-id"` (e.g. `4c67b442-9707-4f07-90df-e68334115088`).
   - `NOTIFY_EVENT_CREATOR_URL: "http://localhost:3081/api/notify/event-creator"` (so the app can ask the server to notify event creators when someone joins).
4. In `server/.env` add (so the auth server can send notifications):
   - `ONESIGNAL_APP_ID=your-app-id`
   - `ONESIGNAL_REST_API_KEY=your-rest-api-key`
5. Restart the auth server (`npm run auth-server`). Event creators will receive a **push** when someone joins their event (they must have allowed notifications and have the same email set as External User ID). For **email** delivery, enable Email in OneSignal and add the channel; you can then extend the server to send email in addition to push.

---

## Checklist

- [ ] **Firebase** keys in `config.local.js` → Google + email sign-in works.
- [ ] **Supabase** URL + anon key in `config.local.js` → real events/courts/chats **and Players list** (same config as on desktop; e.g. mobile must load the same `config.local.js` or env so Supabase is configured).
- [ ] **Twilio** in `server/.env` + `npm run auth-server` → phone OTP works.
- [ ] **OneSignal** (optional) in `config.local.js` → push notifications.

Save `config.local.js` after any change, then refresh the app in the browser.
