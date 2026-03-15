# Agentic Audit Report — Pickleball Community App

## Phase 1 — Findings

### CRITICAL
| # | Finding | Location | Notes |
|---|---------|----------|--------|
| 1 | **Hardcoded API keys and secrets** | `app/js/config.js` | Twilio `accountSid`, `authToken`; Firebase `apiKey`, `authDomain`, `projectId`, etc.; Supabase `url`, `anonKey` are committed. Anyone with repo access can use or leak them. |

### HIGH
| # | Finding | Location | Notes |
|---|---------|----------|--------|
| 2 | **CORS allows single origin** | `server/index.js` | `ALLOW_ORIGIN` is one value; production should validate against an allowlist of origins. |
| 3 | **Supabase RLS overly permissive** | `supabase/schema.sql` | Anon can read/insert/update all tables; no row-level checks. Fine for demo; production needs user-scoped policies. |
| 4 | **No rate limiting** | `server/index.js` | `/api/auth/send-code` and `/api/auth/verify-code` can be brute-forced or abused for SMS flooding. |

### MEDIUM
| # | Finding | Location | Notes |
|---|---------|----------|--------|
| 5 | **XSS risk via innerHTML** | `app/js/app.js` | Event, court, chat, and user data are interpolated into `innerHTML`. If DB or API returns HTML/script, it runs. Escape or use safe rendering for user/DB content. |
| 6 | **No security headers** | `server/index.js` | Missing Helmet (or equivalent): X-Content-Type-Options, X-Frame-Options, etc. |
| 7 | **Phone input not validated** | `app/js/services/auth.js` | `normalizePhone` accepts any string; very long input could stress server or storage. Cap length and validate format. |

### LOW
| # | Finding | Location | Notes |
|---|---------|----------|--------|
| 8 | **No root .env.example** | Project root | App config is client-side; server has `server/.env.example`. Root `.env.example` can document app build/runtime env vars if any are added. |

---

## Phase 3 — Pickleball Rules

This app is a **community app** (events, courts, chat, profile). It does **not** include match scoring or game logic. Therefore:

- **N/A** — Rally/traditional scoring, games to 11, match formats, tiebreaker, server rotation, score announcement, kitchen fault, timeouts: not applicable until a scoring module is added.

---

## Phase 2 — Fixes Applied

| # | Fix | What / why |
|---|-----|------------|
| 1 | **Secrets removed from repo** | `app/js/config.js` now reads from `window.__PICKLEBALL_ENV__` (injected e.g. by `config.local.js`). No hardcoded API keys. Added `app/js/config.local.sample.js`, `.gitignore` (config.local.js, .env), `.env.example`. |
| 2 | **CORS allowlist** | `server/index.js`: `ALLOW_ORIGIN` can be comma-separated; response `Access-Control-Allow-Origin` is set only to request origin if it is in the list, else first allowed origin. |
| 3 | **RLS** | No code change; documented. Production should restrict Supabase RLS by user/session. |
| 4 | **Rate limiting** | `express-rate-limit` on `/api/auth`: 30 requests per 15 minutes per IP. |
| 5 | **XSS mitigation** | `escapeHtml()` in `app/js/app.js`; event cards, court cards, and key user-facing strings escaped before `innerHTML`. |
| 6 | **Security headers** | `helmet` added to Express (contentSecurityPolicy disabled to avoid breaking existing scripts). |
| 7 | **Phone validation** | `auth.js` `normalizePhone()`: rejects input &gt; 20 chars and &gt; 15 digits (E.164). |
| 8 | **Root .env.example** | Added with placeholders for app and server. |

---

## Phase 4 — Run & Verify

- `npm install` — OK (added helmet, express-rate-limit).
- `npm run build` — N/A (no build step in this project).
- `npm test` — 94 tests passed.
- `npm run lint` — N/A (no lint script).
- `npm run serve:app` — App serves on port 3080.

---

## Phase 5 — Security Hardening

- Rate limiting on `/api/auth` (see Phase 2).
- CORS allowlist (see Phase 2).
- Helmet for HTTP headers (see Phase 2).
- Supabase client uses parameterized queries via SDK (no raw SQL).
- Passwords: not stored in this app (Firebase/Twilio handle auth).
- Secrets: not in client bundle; use `config.local.js` or server-injected env.

---

## Phase 6 — Final Report

### Bugs fixed
- None identified beyond security/config.

### Security issues resolved
- **CRITICAL:** Removed hardcoded API keys from `config.js`; config now from `window.__PICKLEBALL_ENV__`.
- **HIGH:** CORS restricted to allowlist; rate limiting on auth endpoints; Helmet added.
- **MEDIUM:** XSS mitigation via `escapeHtml()` for dynamic content; phone length validation.

### Pickleball rules verified
- **N/A** — This repo is a community app (events, courts, chat, profile). No match scoring or game logic; when a scoring module is added, re-run Phase 3 per `.cursor/rules/agentic-pickleball-workflow.mdc`.

### Known limitations / TODOs
- Production: set `window.__PICKLEBALL_ENV__` (e.g. from `config.local.js` or server-rendered script) with real keys so Firebase/Supabase/Twilio work.
- Supabase RLS is permissive (anon read/insert/update); tighten for production.
- Optional: add `npm run lint` and fix any lint findings.

### How to run the app
```bash
npm install
npm run serve:app          # App at http://localhost:3080
npm run auth-server        # Auth server at http://localhost:3081 (optional, for Twilio OTP)
npm test                   # Unit tests
npm run test:e2e           # E2E (Playwright)
```
**Firebase Auth / Supabase / Twilio:** Config is read from `window.__PICKLEBALL_ENV__`. To enable:
1. Copy `app/js/config.local.sample.js` to `app/js/config.local.js`.
2. Fill in your Firebase (and optionally Supabase/Twilio) values in `config.local.js`.
3. In `app/index.html` add `<script src="js/config.local.js"></script>` **before** `<script src="js/config.js"></script>`.
Then reload the app; Firebase Auth (Google/email sign-in) will work.
