/**
 * Unit tests for auth verify (mock flow: pending code match).
 */
import { describe, it, expect, beforeEach } from "vitest";

const PENDING_CODE_KEY = "pickleball_pending_code";
const PENDING_PHONE_KEY = "pickleball_pending_phone";

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

function verifyCodeMock(phone, code, session) {
  const normalized = normalizePhone(phone);
  const pendingPhone = session[PENDING_PHONE_KEY];
  const pendingCode = session[PENDING_CODE_KEY];
  if (pendingPhone !== normalized || !pendingCode) {
    return { success: false, error: "No pending verification for this number. Request a new code." };
  }
  if (String(code).trim() !== pendingCode) {
    return { success: false, error: "Invalid code" };
  }
  delete session[PENDING_PHONE_KEY];
  delete session[PENDING_CODE_KEY];
  return { success: true };
}

function sendCodeMock(phone, session) {
  const normalized = normalizePhone(phone);
  const mockCode = "123456";
  session[PENDING_PHONE_KEY] = normalized;
  session[PENDING_CODE_KEY] = mockCode;
  return { success: true, phone: normalized };
}

describe("Auth verify (mock)", () => {
  let session;

  beforeEach(() => {
    session = {};
  });

  it("sendCodeMock stores pending phone and code", () => {
    const r = sendCodeMock("5125551234", session);
    expect(r.success).toBe(true);
    expect(r.phone).toBe("+15125551234");
    expect(session[PENDING_PHONE_KEY]).toBe("+15125551234");
    expect(session[PENDING_CODE_KEY]).toBe("123456");
  });

  it("verifyCodeMock succeeds when phone and code match", () => {
    sendCodeMock("5125551234", session);
    const r = verifyCodeMock("+15125551234", "123456", session);
    expect(r.success).toBe(true);
    expect(session[PENDING_CODE_KEY]).toBeUndefined();
  });

  it("verifyCodeMock fails when code wrong", () => {
    sendCodeMock("5125551234", session);
    const r = verifyCodeMock("+15125551234", "000000", session);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Invalid");
  });

  it("verifyCodeMock fails when no pending verification", () => {
    const r = verifyCodeMock("+15125551234", "123456", session);
    expect(r.success).toBe(false);
    expect(r.error).toContain("No pending");
  });

  it("verifyCodeMock fails when phone differs from pending", () => {
    sendCodeMock("5125551234", session);
    const r = verifyCodeMock("+15125559999", "123456", session);
    expect(r.success).toBe(false);
  });

  it("accepts code with spaces (trimmed)", () => {
    sendCodeMock("5125551234", session);
    const r = verifyCodeMock("+15125551234", "  123456  ", session);
    expect(r.success).toBe(true);
  });
});
