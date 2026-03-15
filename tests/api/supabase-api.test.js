/**
 * Supabase API integration tests.
 * Set env: SUPABASE_URL, SUPABASE_ANON_KEY (from config.js / Supabase dashboard).
 * When set, calls real Supabase REST API and checks response shape.
 */
import { describe, it, expect } from "vitest";

const baseUrl = process.env.SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const hasSupabase = !!(baseUrl && anonKey);

const restHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

describe("Supabase API", () => {
  describe("REST /rest/v1/events", () => {
    it.skipIf(!hasSupabase)("returns array or 200 when table exists", async () => {
      const res = await fetch(`${baseUrl}/rest/v1/events?select=id,title&limit=1`, {
        headers: restHeaders,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe("REST /rest/v1/courts", () => {
    it.skipIf(!hasSupabase)("returns array or 200 when table exists", async () => {
      const res = await fetch(`${baseUrl}/rest/v1/courts?select=id,name&limit=1`, {
        headers: restHeaders,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe("REST /rest/v1/event_details", () => {
    it.skipIf(!hasSupabase)("returns array or 200 when table exists", async () => {
      const res = await fetch(`${baseUrl}/rest/v1/event_details?select=id,title&limit=1`, {
        headers: restHeaders,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe("REST /rest/v1/chats", () => {
    it.skipIf(!hasSupabase)("returns array or 200 when table exists", async () => {
      const res = await fetch(`${baseUrl}/rest/v1/chats?select=id,title&limit=1`, {
        headers: restHeaders,
      });
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  it("when Supabase not configured, tests are skipped", () => {
    if (!hasSupabase) {
      expect(baseUrl || anonKey).toBeFalsy();
    }
  });
});
