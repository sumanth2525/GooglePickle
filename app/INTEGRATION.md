# Integrations (Twilio, Firebase, Geolocation)

Replace placeholder values in **`js/config.js`** with your real API keys and URLs. Keep secrets out of version control.

---

## 1. Twilio — Mobile login & account creation

Used for: sending SMS verification codes and verifying codes for phone-based login/signup.

### Option A: Backend (recommended)

Create two endpoints that use Twilio on the server:

- **POST** `sendCodeUrl` — body: `{ "phone": "+1..." }`. Your server calls Twilio Verify or Messages API, then returns `{ "success": true }` or `{ "error": "..." }`.
- **POST** `verifyCodeUrl` — body: `{ "phone": "+1...", "code": "123456" }`. Your server verifies with Twilio and returns `{ "verified": true }` or `{ "error": "..." }`.

In `config.js` set:

```js
twilio: {
  sendCodeUrl: "https://your-api.com/api/auth/send-code",
  verifyCodeUrl: "https://your-api.com/api/auth/verify-code",
}
```

### Option B: Twilio credentials (client-side, not for production)

If you must call Twilio from the client (not recommended for auth token), set:

```js
twilio: {
  accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authToken: "your_auth_token",
  verifyServiceSid: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // optional
}
```

**Without config:** The app uses a **mock** flow: clicking "Send code" stores a demo code `123456` in sessionStorage; entering `123456` logs you in.

---

## 2. Firebase — Live chat (group & 1:1)

Used for: real-time event group chat and direct messages.

### Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Add a web app → copy the config object into `config.js`:

```js
firebase: {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc...",
}
```

3. **Firestore:** In Console → Firestore Database → Create database (start in test mode for dev).  
   Full schema (group/event chat): see **CHAT_SCHEMA.md**.  
   Short version:
   - Collection `chats` → document id = chat id (e.g. `"1"` for event 1)
   - Subcollection `messages` → each message: `body`, `authorName`, `authorAvatar`, `userId?`, `createdAt`, `imageUrl?`
   - Optional on `chats/{id}`: `title`, `eventId`, `lastMessageAt`, `lastMessageBody` (updated when sending)

4. **Security rules** (Firestore → Rules). For development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId}/messages/{msgId} {
      allow read, write: if true;  // restrict in production
    }
  }
}
```

5. Firebase SDK is loaded in `index.html`. When `config.firebase` is set, the chat service uses Firestore.

**Without config:** The app uses **mock** messages from `data.js` and in-memory appends.

### Push notifications (FCM)

For push notifications when users add the app to the home screen (iOS 16.4+):

1. **Cloud Messaging → Web Push certificates** — Generate a key pair, copy the key.
2. Add to `config.js`:
   ```js
   firebase: {
     // ...existing fields...
     vapidKey: "Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
   }
   ```
3. **Copy the same Firebase config** into `firebase-messaging-sw.js` (the service worker cannot read `config.js`).
4. Serve over **HTTPS**. Push requires a secure context.
5. Users tap the notifications bell to enable push. The token is stored; send it to your backend to target this device.

---

## 3. Supabase — API (events, courts, chats)

Used for: loading events (home feed), event details, courts, and chat list from your database.

### Setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. In `config.js` set:
   ```js
   supabase: {
     url: "https://xxxx.supabase.co",
     anonKey: "eyJhbG...",
   }
   ```
4. Create tables (Table Editor or SQL). The app expects these names and columns (snake_case in DB, mapped to camelCase in app):

**Table `events`** (home feed cards):
- id (text/uuid), title, level, level_primary (bool), date, venue, lat, lng (numeric), distance, format, joined, joined_highlight (bool), image, weather, weather_icon, weather_active (bool), host_avatars (jsonb array), extra_count (int), cta, cta_primary (bool), opacity (numeric)

**Table `event_details`** (single event page):
- id, title, level, image, host_name, host_sub, host_avatar, location_name, map_image, date, time, player_count, player_avatars (jsonb), description, chat_preview (jsonb, e.g. `{name, text}`), chat_count (int)

**Table `courts`**:
- id, name, address, courts (int), surface, lights (bool), distance, lat, lng, image, amenities

**Table `chats`** (message list):
- id, event_id, title, avatar (url), last_message, time, unread (int), active (bool), read (bool)

5. Enable Row Level Security (RLS) as needed; for public read use policies that allow `select` for anon.

**Without config:** The app uses **mock** data from `data.js`.

---

## 4. Geolocation / IP geolocation

Used for: sorting and filtering events by distance, and showing “nearby” games.

### Browser location

The app uses the **Geolocation API** (`navigator.geolocation.getCurrentPosition`) by default. No config required. The user may be prompted to allow location.

### Optional: IP fallback

When the user denies or location is unavailable, you can use an IP-based geolocation provider. In `config.js` set:

```js
geolocation: {
  ipGeoUrl: "https://ipapi.co/json/",
  defaultCenter: { lat: 30.2672, lng: -97.7431 },
  maxDistanceMiles: 50,
}
```

The service expects the API to return `latitude` and `longitude` (or `lat`/`lng`). Other providers (e.g. your own backend at `/api/geo`) are fine as long as the response shape matches.

### Event data

Events in `data.js` (or from your API) should include **`lat`** and **`lng`** for distance sorting and “nearby” logic. The geolocation service uses these to compute distance and sort the home feed.

---

## File overview

| File | Purpose |
|------|--------|
| `js/config.js` | Placeholder API keys and URLs; replace with real values. |
| `js/services/geolocation.js` | Browser + optional IP geo, distance, sort/filter events. |
| `js/services/auth.js` | Twilio-style phone send/verify; mock when not configured. |
| `js/services/chat.js` | Firebase Firestore live chat; mock when not configured. |
| `js/services/notifications.js` | FCM push subscriptions; mock when not configured. |
| `js/services/supabase.js` | Supabase client; fetches events, event_details, courts, chats when configured. |
| `firebase-messaging-sw.js` | Service worker for background push; requires same Firebase config as config.js. |

After updating `config.js` and `firebase-messaging-sw.js`, reload the app; no build step required.
