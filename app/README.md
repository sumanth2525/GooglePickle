# Pickleball Community — Web App

Single-page web app built with the **Stitch design system** (see `../stitch/DESIGN.md`). Mobile-first layout, hash-based routing, and mock data.

## Integrations (optional)

- **Twilio** — Mobile login / account creation via SMS verification. Configure in `js/config.js`; see **INTEGRATION.md**.
- **Firebase** — Live chat (Firestore). Set firebase config in `js/config.js`; SDK is loaded in `index.html`.
- **Geolocation** — Browser location + optional IP fallback for “nearby” events. Events are sorted by distance when location is available. Add `lat`/`lng` to event data; optional `config.geolocation.ipGeoUrl` for IP-based fallback.

Without API keys, the app runs with mock auth (demo code `123456`), mock chat, and browser geolocation only.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .

# VS Code: Live Server extension
```

Then go to `http://localhost:8080` (or the URL your server uses).

## Routes

| Hash        | Screen           |
|------------|------------------|
| `#home`    | Events feed      |
| `#profile` | Profile / Join (log in with “Create Account” or “Log In”) |
| `#chat`    | Message list     |
| `#chat/1`  | Event group chat |
| `#event/1` | Event details    |
| `#add-event` | Host event form |
| `#players` | Players list     |

## Structure

- **index.html** — Shell, Tailwind config, fonts, bottom nav, script order: config → services → data → app.
- **js/config.js** — Placeholder API keys (Twilio, Supabase, geolocation). Replace with real values; see INTEGRATION.md.
- **js/services/geolocation.js** — Browser + optional IP geo, distance, sort/filter events by location.
- **js/services/auth.js** — Phone send/verify (Twilio or backend); mock when not configured.
- **js/services/chat.js** — Supabase live chat; mock when not configured.
- **js/data.js** — Mock data (events with `lat`/`lng`, chats, players, user).
- **js/app.js** — Hash router and render functions; uses services when available.

## Dark mode

Add `class="dark"` to the `<html>` element to toggle dark theme (design system supports it).

## Design

All UI follows `../stitch/DESIGN.md`: primary `#80f20d`, Inter font, Material Symbols, rounded-xl cards and buttons, sticky headers, and bottom nav with FAB.
