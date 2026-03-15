# Why OTP Was Not Received

If users request a code but never get an SMS, check the following.

## 1. Auth server not running

The app calls `sendCodeUrl` (e.g. `http://localhost:3081/api/auth/send-code`). If the auth server is not running, the request fails and the app may fall back to mock (code `123456` in session, no real SMS).

**Fix:** Start the auth server:
```bash
npm run auth-server
```

## 2. Twilio not configured on the server

The server reads from **`server/.env`** (or project root `.env`). If `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, or `TWILIO_VERIFY_SERVICE_SID` are missing, the server returns **503** and `"Twilio Verify not configured"`. No SMS is sent.

**Fix:**
1. Copy `server/.env.example` to `server/.env`.
2. Set in `server/.env`:
   - `TWILIO_ACCOUNT_SID` — Twilio Console → Account → API keys
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID` — Twilio Console → **Verify** → **Services** → create a service → copy SID (starts with `VA...`).

Then restart the auth server and run:
```bash
npm run twilio-check
```

## 3. Trial account: number not verified (Error 21608)

On a **Twilio trial** account, SMS can only be sent **to verified phone numbers**. If the recipient number is not in **Verified Caller IDs**, Twilio returns an error and the server responds with a message like:

> Twilio trial: add this number as a Verified Caller ID. Twilio Console → Phone Numbers → Manage → Verified Caller IDs.

**Fix:** In Twilio Console go to **Phone Numbers** → **Manage** → **Verified Caller IDs** and add the phone number (E.164, e.g. `+15125551234`) you use for testing. Then try sending the code again.

## 4. Invalid phone format

Twilio Verify expects E.164 (e.g. `+15125551234`). The app normalizes US 10-digit numbers to `+1` + digits. If the number is invalid or from an unsupported country, Twilio may return 60200/60203.

**Fix:** Use a valid E.164 number; for US use 10 digits (app adds `+1`).

## 5. App not pointing at the auth server

In `app/js/config.js`, `twilio.sendCodeUrl` and `twilio.verifyCodeUrl` must point at your running auth server (e.g. `http://localhost:3081/api/auth/send-code` and `.../verify-code`). If they point elsewhere or are empty, the app uses the **mock** flow (no real SMS, code `123456`).

**Fix:** Set both URLs to your auth server base URL + `/api/auth/send-code` and `/api/auth/verify-code`.

---

## Quick check

Run the Twilio connection check (auth server must be running):

```bash
npm run auth-server   # in one terminal
npm run twilio-check  # in another
```

If you see `verifyConfigured: true`, Twilio and Verify are configured and OTPs should be sent. If the number still doesn’t receive SMS, it’s almost always **#3 (trial verified caller)** or carrier/network issues.
