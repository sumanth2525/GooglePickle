import { describe, it, expect } from "vitest";

/**
 * Auth service logic (mirrors js/services/auth.js)
 */
function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

describe("AuthService", () => {
  describe("normalizePhone", () => {
    it("formats 10-digit US number with +1", () => {
      expect(normalizePhone("5125551234")).toBe("+15125551234");
      expect(normalizePhone("(512) 555-1234")).toBe("+15125551234");
    });

    it("formats 11-digit number starting with 1", () => {
      expect(normalizePhone("15125551234")).toBe("+15125551234");
    });

    it("strips non-digits", () => {
      expect(normalizePhone("512-555-1234")).toBe("+15125551234");
      expect(normalizePhone("+1 512 555 1234")).toBe("+15125551234");
    });

    it("handles empty string", () => {
      expect(normalizePhone("")).toBe("+");
    });
  });
});
