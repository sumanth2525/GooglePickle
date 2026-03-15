/**
 * Twilio Verify backend — send and verify OTPs.
 * Optional: OneSignal notify event creator when someone joins.
 * Run: npm run auth-server (from project root).
 *
 * Env: TWILIO_*, optional ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY (Keys & IDs → REST API Key)
 */

import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3081;
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGIN || "http://localhost:3080")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow = origin && ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: "Too many requests. Try again later." },
  standardHeaders: true,
});
app.use("/api/auth", authLimiter);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  console.warn(
    "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_VERIFY_SERVICE_SID. Set them in .env (see .env.example)."
  );
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/** GET /api/auth/check — verify Twilio credentials and Verify service without sending SMS */
app.get("/api/auth/check", async (req, res) => {
  try {
    if (!accountSid || !authToken) {
      return res.status(503).json({
        ok: false,
        error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in server/.env",
        hint: "Copy server/.env.example to server/.env and set your Twilio credentials.",
      });
    }
    if (!client) {
      return res.status(503).json({ ok: false, error: "Twilio client not initialized" });
    }
    await client.api.accounts(accountSid).fetch();
    const hasVerify = !!verifyServiceSid;
    if (!hasVerify) {
      return res.json({
        ok: true,
        accountSid: accountSid.slice(0, 8) + "...",
        message: "Twilio credentials valid. Add TWILIO_VERIFY_SERVICE_SID (VA...) to send real SMS.",
        verifyConfigured: false,
      });
    }
    return res.json({
      ok: true,
      accountSid: accountSid.slice(0, 8) + "...",
      verifyServiceSid: verifyServiceSid.slice(0, 8) + "...",
      message: "Twilio and Verify service configured. OTPs will be sent via SMS.",
      verifyConfigured: true,
    });
  } catch (err) {
    const code = err.code === 20003 || err.code === 20429 ? 403 : 500;
    return res.status(code).json({
      ok: false,
      error: err.message || "Twilio request failed",
      hint:
        err.code === 20003 || err.code === 20429
          ? "Check Account SID and Auth Token in server/.env (Twilio Console → Account → API keys)."
          : undefined,
    });
  }
});

app.post("/api/auth/send-code", async (req, res) => {
  try {
    const phone = req.body?.phone;
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ success: false, error: "Phone number required" });
    }
    if (!client || !verifyServiceSid) {
      return res.status(503).json({ success: false, error: "Twilio Verify not configured" });
    }
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phone, channel: "sms" });
    return res.json({ success: true, sid: verification.sid });
  } catch (err) {
    let message = err.message || "Failed to send code";
    if (err.code === 21608 || (err.message && err.message.toLowerCase().includes("verified"))) {
      message =
        "Twilio trial: add this number as a Verified Caller ID. Twilio Console → Phone Numbers → Manage → Verified Caller IDs.";
    } else if (err.code === 20429 || err.code === 20003) {
      message = "Twilio auth failed. Check Account SID and Auth Token in server/.env";
    } else if (err.code === 60200 || err.code === 60203) {
      message = "Invalid phone number. Use E.164 (e.g. +15125551234).";
    }
    const code = err.code === 20429 || err.code === 20003 ? 403 : 500;
    return res.status(code).json({ success: false, error: message });
  }
});

app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const phone = req.body?.phone;
    const code = req.body?.code;
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: "Phone and code required" });
    }
    if (!client || !verifyServiceSid) {
      return res.status(503).json({ success: false, error: "Twilio Verify not configured" });
    }
    const check = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phone, code: String(code).trim() });
    if (check.status === "approved") {
      return res.json({ success: true, verified: true });
    }
    return res.status(400).json({ success: false, error: "Invalid code" });
  } catch (err) {
    const message = err.message || "Invalid code";
    return res.status(400).json({ success: false, error: message });
  }
});

/** POST /api/notify/event-creator — send OneSignal push/email to event creator when someone joins. Body: { creatorExternalId, eventTitle, joinerName } */
app.post("/api/notify/event-creator", express.json(), async (req, res) => {
  const creatorExternalId = req.body?.creatorExternalId;
  const eventTitle = req.body?.eventTitle || "Your event";
  const joinerName = req.body?.joinerName || "Someone";
  if (!creatorExternalId || typeof creatorExternalId !== "string") {
    return res.status(400).json({ success: false, error: "creatorExternalId required" });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return res.status(503).json({
      success: false,
      error:
        "OneSignal not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in server/.env (OneSignal Dashboard → Keys & IDs).",
    });
  }
  const title = "Someone joined your event";
  const body = `${joinerName} joined "${eventTitle}".`;
  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [String(creatorExternalId).trim()] },
      target_channel: "push",
      contents: { en: body },
      headings: { en: title },
    };
    const r = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ success: false, error: data.errors?.[0] || data.message || "OneSignal request failed" });
    }
    return res.json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to send notification" });
  }
});

app.listen(PORT, () => {
  console.log(
    `Auth server http://localhost:${PORT} (Twilio Verify${ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY ? ", OneSignal notify" : ""})`
  );
});
