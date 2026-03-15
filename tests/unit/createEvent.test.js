/**
 * Unit tests for createEvent payload building (mirrors SupabaseService.createEvent shape).
 */
import { describe, it, expect } from "vitest";

function buildEventRow(payload) {
  const title = payload.title || "New Event";
  const date = payload.date || "";
  const time = payload.time || "";
  const venue = payload.venue || "";
  const playerCount = String(payload.playerCount != null ? payload.playerCount : 4);
  const format = payload.format || "Doubles";
  const level = payload.level || "Intermediate";
  const joined = "0/" + playerCount + " joined";
  return {
    title,
    level,
    level_primary: true,
    date: date + (time ? " " + time : ""),
    venue,
    format,
    joined,
    joined_highlight: false,
    cta: "Join Game",
    cta_primary: true,
    opacity: 1,
  };
}

function buildEventDetailRow(payload, eventId) {
  const title = payload.title || "New Event";
  const date = payload.date || "";
  const time = payload.time || "";
  const venue = payload.venue || "";
  const locationName = payload.locationName || venue;
  const playerCount = String(payload.playerCount != null ? payload.playerCount : 4);
  const _format = payload.format || "Doubles";
  const level = payload.level || "Intermediate";
  return {
    id: eventId,
    title,
    level,
    date,
    time,
    location_name: locationName,
    player_count: playerCount,
    description: "",
    host_name: "",
    host_sub: "",
    host_avatar: "",
    map_image: "",
    player_avatars: [],
    chat_preview: null,
    chat_count: 0,
  };
}

describe("createEvent payload", () => {
  describe("buildEventRow", () => {
    it("uses defaults when payload is minimal", () => {
      const row = buildEventRow({ title: "Morning Smash", date: "2025-03-15", venue: "Zilker" });
      expect(row.title).toBe("Morning Smash");
      expect(row.date).toBe("2025-03-15");
      expect(row.venue).toBe("Zilker");
      expect(row.level).toBe("Intermediate");
      expect(row.format).toBe("Doubles");
      expect(row.joined).toBe("0/4 joined");
      expect(row.cta).toBe("Join Game");
    });

    it("includes time in date when provided", () => {
      const row = buildEventRow({
        title: "Sunset Play",
        date: "2025-03-15",
        time: "18:00",
        venue: "Austin High",
      });
      expect(row.date).toBe("2025-03-15 18:00");
    });

    it("uses playerCount for joined string", () => {
      const row = buildEventRow({
        title: "Big Game",
        date: "2025-03-16",
        venue: "Round Rock",
        playerCount: 8,
      });
      expect(row.joined).toBe("0/8 joined");
    });
  });

  describe("buildEventDetailRow", () => {
    it("maps payload to event_details shape with eventId", () => {
      const eventId = "uuid-123";
      const payload = {
        title: "Drills",
        date: "2025-03-15",
        time: "10:00",
        venue: "Zilker",
        locationName: "Zilker Park, Austin",
        playerCount: 12,
        level: "Beginner",
      };
      const row = buildEventDetailRow(payload, eventId);
      expect(row.id).toBe(eventId);
      expect(row.title).toBe("Drills");
      expect(row.location_name).toBe("Zilker Park, Austin");
      expect(row.player_count).toBe("12");
      expect(row.level).toBe("Beginner");
      expect(row.chat_count).toBe(0);
    });
  });
});
