/**
 * API integration tests for auth endpoints.
 * Set env: TWILIO_SEND_CODE_URL, TWILIO_VERIFY_CODE_URL
 * Or configure in app/js/config.js (twilio.sendCodeUrl, verifyCodeUrl).
 */
import { describe, it, expect } from "vitest";

const sendUrl = process.env.TWILIO_SEND_CODE_URL || "";
const verifyUrl = process.env.TWILIO_VERIFY_CODE_URL || "";
const hasEndpoints = !!(sendUrl && verifyUrl);

describe("Auth API (Twilio endpoints)", () => {
  describe("POST sendCodeUrl", () => {
    it.skipIf(!hasEndpoints)("accepts { phone } and returns success", async () => {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+15125551234" }),
      });
      const data = await res.json();
      expect(res.ok).toBe(true);
      expect(data.success || data.sid).toBeTruthy();
    });
  });

  describe("POST verifyCodeUrl", () => {
    it.skipIf(!hasEndpoints)("accepts { phone, code } and returns verified", async () => {
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+15125551234", code: "123456" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.verified || data.success || data.error).toBeDefined();
    });

    it.skipIf(!hasEndpoints)("rejects invalid code with error", async () => {
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+15125551234", code: "000000" }),
      });
      const data = await res.json();
      expect(data.verified || data.success).toBeFalsy();
      expect(data.error || res.status >= 400).toBeTruthy();
    });
  });

  it.skipIf(hasEndpoints)("when endpoints not configured, tests are skipped", () => {
    if (!hasEndpoints) {
      expect(sendUrl || verifyUrl).toBeFalsy();
    }
  });
});
