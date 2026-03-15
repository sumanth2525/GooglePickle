# Securing API Keys in This Project

Never commit real API keys, tokens, or secrets. This doc describes where keys live and how to keep them out of the repo.

---

## 1. What is already protected (.gitignore)

These files **must not** be committed; they are in `.gitignore`:

| File | Purpose |
|------|--------|
| `app/js/config.local.js` | Firebase, Supabase, OneSignal keys for the **browser app** |
| `app/firebase-messaging-sw.js` | Firebase config for the **push notification service worker** |
| `server/.env` | Twilio, OneSignal, server port for the **auth server** |
| `.env` | Optional root env (if you add one) |

---

## 2. Where to put keys (project root and app)

### Browser app (client-side)

Keys are loaded by `app/index.html` from **`app/js/config.local.js`**.

**Setup:**

1. Copy the sample:  
   `app/js/config.local.sample.js` → `app/js/config.local.js`
2. Edit **`app/js/config.local.js`** and set only the values you need:
   - `FIREBASE_*` — Firebase Console → Project settings → Your apps
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Supabase Dashboard → Settings → API (use **anon public** only)
   - `ONESIGNAL_APP_ID` — optional, for push
3. **Do not** commit `app/js/config.local.js`.

**Important:** Client-side keys (Firebase API key, Supabase anon key) are visible in the browser. Restrict them by domain/app in Firebase and Supabase so they only work from your app.

---

### Auth server (Node)

Secrets are read from **`server/.env`** (via `dotenv`).

**Setup:**

1. Copy:  
   `server/.env.example` → `server/.env`
2. Edit **`server/.env`** with real Twilio (and optional OneSignal) values.
3. **Do not** commit `server/.env`.

---

### Firebase Cloud Messaging (service worker)

Push notifications use **`app/firebase-messaging-sw.js`**, which runs in a separate context and cannot use `config.local.js`.

**Setup:**

1. Copy:  
   `app/firebase-messaging-sw.sample.js` → `app/firebase-messaging-sw.js`
2. Edit **`app/firebase-messaging-sw.js`** and replace the placeholders with your Firebase config (same project as the main app).
3. **Do not** commit `app/firebase-messaging-sw.js`.

---

## 3. Checklist: never commit

- [ ] `app/js/config.local.js` — use `config.local.sample.js` as template only
- [ ] `app/firebase-messaging-sw.js` — use `firebase-messaging-sw.sample.js` as template only
- [ ] `server/.env` — use `server/.env.example` as template only
- [ ] Any file under the project root (or elsewhere) that contains real keys, tokens, or passwords

---

## 4. If a key was committed

1. **Rotate the key immediately** in the provider (Firebase, Supabase, Twilio, OneSignal).
2. Remove the secret from the repo (e.g. replace with placeholders and commit, or use `git filter-repo` / BFG to rewrite history).
3. In GitHub: Security → Secret scanning → close the alert as **Revoked** after rotating.

---

## 5. Production / deployment

- **Server:** Keep using environment variables (e.g. `server/.env` or your host’s env config). Never hardcode server secrets.
- **Browser:** The app today loads keys from `config.local.js`. For production you can:
  - Keep using a generated `config.local.js` that is **not** in the repo (e.g. created at deploy time from env or a secure config service), or
  - Inject config at build time from env into a single bundle so no key file is committed.

---

## 6. Quick reference

| Key / secret type | Where it’s used | Where to put it (local) | Sample file |
|-------------------|-----------------|--------------------------|-------------|
| Firebase (web app) | Browser | `app/js/config.local.js` | `app/js/config.local.sample.js` |
| Supabase URL + anon key | Browser | `app/js/config.local.js` | `app/js/config.local.sample.js` |
| OneSignal App ID | Browser | `app/js/config.local.js` | `app/js/config.local.sample.js` |
| Firebase (FCM worker) | Service worker | `app/firebase-messaging-sw.js` | `app/firebase-messaging-sw.sample.js` |
| Twilio, OneSignal server | Auth server | `server/.env` | `server/.env.example` |

All of the “Where to put it” files are in `.gitignore`; only the sample/example files are committed.
