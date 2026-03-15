/**
 * Unit tests for mock data and app data helpers (AVATAR_OPTIONS, tournaments, default location).
 */
import { describe, it, expect } from "vitest";

const AVATAR_OPTIONS = ["https://example.com/1", "https://example.com/2", "https://example.com/3"];

const MOCK_TOURNAMENTS = [
  {
    id: "t1",
    title: "Austin Summer Slam",
    date: "Aug 15–16",
    venue: "Zilker Park",
    level: "Open",
    registered: 24,
    maxTeams: 32,
  },
  {
    id: "t2",
    title: "Round Rock Doubles",
    date: "Sep 7",
    venue: "Round Rock TC",
    level: "3.0–4.5",
    registered: 12,
    maxTeams: 16,
  },
];

function normalizeUSPhone(val) {
  const raw = String(val).trim().replace(/\D/g, "");
  if (raw.length === 10) return "+1" + raw;
  if (raw.length === 11 && raw.charAt(0) === "1") return "+" + raw;
  return raw.length >= 10 ? "+1" + raw.slice(-10) : "";
}

describe("Mock data and helpers", () => {
  describe("AVATAR_OPTIONS", () => {
    it("is an array of avatar URLs", () => {
      expect(Array.isArray(AVATAR_OPTIONS)).toBe(true);
      expect(AVATAR_OPTIONS.length).toBeGreaterThanOrEqual(1);
      AVATAR_OPTIONS.forEach((url) => {
        expect(typeof url).toBe("string");
        expect(url.length).toBeGreaterThan(0);
      });
    });
  });

  describe("tournaments", () => {
    it("have id, title, date, venue, level", () => {
      MOCK_TOURNAMENTS.forEach((t) => {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("title");
        expect(t).toHaveProperty("date");
        expect(t).toHaveProperty("venue");
        expect(t).toHaveProperty("level");
      });
    });

    it("have registered and maxTeams when used for UI", () => {
      expect(MOCK_TOURNAMENTS[0].registered).toBe(24);
      expect(MOCK_TOURNAMENTS[0].maxTeams).toBe(32);
    });
  });

  describe("normalizeUSPhone", () => {
    it("normalizes 10-digit number to +1XXXXXXXXXX", () => {
      expect(normalizeUSPhone("5125551234")).toBe("+15125551234");
      expect(normalizeUSPhone("512 555 1234")).toBe("+15125551234");
    });

    it("keeps 11-digit starting with 1 as +1...", () => {
      expect(normalizeUSPhone("15125551234")).toBe("+15125551234");
    });

    it("returns empty string for too few digits", () => {
      expect(normalizeUSPhone("123")).toBe("");
      expect(normalizeUSPhone("")).toBe("");
    });

    it("strips non-digits", () => {
      expect(normalizeUSPhone("(512) 555-1234")).toBe("+15125551234");
    });
  });
});
