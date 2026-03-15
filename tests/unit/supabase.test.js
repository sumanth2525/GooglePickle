/**
 * Unit tests for Supabase API mapping (snake_case → camelCase).
 * Mirrors app/js/services/supabase.js toEvent, toEventDetail, toCourt, toChat.
 */
import { describe, it, expect } from "vitest";

function toEvent(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    level: row.level || "",
    levelPrimary: !!row.level_primary,
    date: row.date,
    venue: row.venue,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    distance: row.distance,
    format: row.format,
    joined: row.joined,
    joinedHighlight: !!row.joined_highlight,
    image: row.image,
    weather: row.weather,
    weatherIcon: row.weather_icon,
    weatherActive: !!row.weather_active,
    hostAvatars: row.host_avatars || [],
    extraCount: row.extra_count || 0,
    cta: row.cta || "View Details",
    ctaPrimary: row.cta_primary !== false,
    opacity: row.opacity != null ? row.opacity : 1,
  };
}

function toEventDetail(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    level: row.level,
    image: row.image,
    hostName: row.host_name,
    hostSub: row.host_sub,
    hostAvatar: row.host_avatar,
    locationName: row.location_name,
    mapImage: row.map_image,
    date: row.date,
    time: row.time,
    playerCount: row.player_count,
    playerAvatars: row.player_avatars || [],
    description: row.description,
    chatPreview: row.chat_preview || null,
    chatCount: row.chat_count || 0,
  };
}

function toCourt(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    address: row.address,
    courts: row.courts,
    surface: row.surface,
    lights: !!row.lights,
    distance: row.distance,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    image: row.image,
    amenities: row.amenities,
  };
}

function toChat(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    eventId: row.event_id ? String(row.event_id) : null,
    title: row.title,
    avatar: row.avatar,
    lastMessage: row.last_message,
    time: row.time,
    unread: row.unread || 0,
    active: !!row.active,
    read: !!row.read,
  };
}

describe("Supabase API mapping", () => {
  describe("toEvent", () => {
    it("returns null for null/undefined", () => {
      expect(toEvent(null)).toBe(null);
      expect(toEvent(undefined)).toBe(null);
    });

    it("maps snake_case to camelCase with defaults", () => {
      const row = {
        id: 1,
        title: "Morning Doubles",
        date: "Sat, 9 AM",
        venue: "Zilker",
        lat: 30.26,
        lng: -97.77,
      };
      const out = toEvent(row);
      expect(out.id).toBe("1");
      expect(out.title).toBe("Morning Doubles");
      expect(out.level).toBe("");
      expect(out.levelPrimary).toBe(false);
      expect(out.cta).toBe("View Details");
      expect(out.ctaPrimary).toBe(true);
      expect(out.lat).toBe(30.26);
      expect(out.lng).toBe(-97.77);
      expect(out.hostAvatars).toEqual([]);
      expect(out.extraCount).toBe(0);
      expect(out.opacity).toBe(1);
    });

    it("maps boolean and numeric fields correctly", () => {
      const row = {
        id: "2",
        level_primary: true,
        joined_highlight: true,
        weather_active: true,
        extra_count: 2,
        cta_primary: false,
        opacity: 0.9,
        host_avatars: ["https://a.com/1"],
      };
      const out = toEvent(row);
      expect(out.levelPrimary).toBe(true);
      expect(out.joinedHighlight).toBe(true);
      expect(out.weatherActive).toBe(true);
      expect(out.extraCount).toBe(2);
      expect(out.ctaPrimary).toBe(false);
      expect(out.opacity).toBe(0.9);
      expect(out.hostAvatars).toEqual(["https://a.com/1"]);
    });
  });

  describe("toEventDetail", () => {
    it("returns null for null", () => {
      expect(toEventDetail(null)).toBe(null);
    });

    it("maps event_details row to app shape", () => {
      const row = {
        id: "1",
        title: "Sunset Match",
        host_name: "Alex",
        host_sub: "Host • 4.5",
        location_name: "Zilker Park",
        player_count: "4",
        chat_preview: { name: "Bob", text: "Hi" },
        chat_count: 5,
      };
      const out = toEventDetail(row);
      expect(out.id).toBe("1");
      expect(out.hostName).toBe("Alex");
      expect(out.hostSub).toBe("Host • 4.5");
      expect(out.locationName).toBe("Zilker Park");
      expect(out.playerCount).toBe("4");
      expect(out.chatPreview).toEqual({ name: "Bob", text: "Hi" });
      expect(out.chatCount).toBe(5);
      expect(out.playerAvatars).toEqual([]);
    });
  });

  describe("toCourt", () => {
    it("returns null for null", () => {
      expect(toCourt(null)).toBe(null);
    });

    it("maps courts row with lights boolean", () => {
      const row = {
        id: "1",
        name: "Zilker Park Courts",
        address: "2100 Barton Springs Rd",
        courts: 8,
        surface: "Concrete",
        lights: true,
        lat: 30.2669,
        lng: -97.7728,
      };
      const out = toCourt(row);
      expect(out.id).toBe("1");
      expect(out.name).toBe("Zilker Park Courts");
      expect(out.courts).toBe(8);
      expect(out.lights).toBe(true);
      expect(out.lat).toBe(30.2669);
    });

    it("treats lights as false when falsy", () => {
      expect(toCourt({ id: 1, lights: false }).lights).toBe(false);
      expect(toCourt({ id: 1 }).lights).toBe(false);
    });
  });

  describe("toChat", () => {
    it("returns null for null", () => {
      expect(toChat(null)).toBe(null);
    });

    it("maps chats row with event_id and unread", () => {
      const row = {
        id: "1",
        event_id: "1",
        title: "Event Chat",
        last_message: "See you there",
        time: "10:45 AM",
        unread: 3,
        active: true,
        read: false,
      };
      const out = toChat(row);
      expect(out.id).toBe("1");
      expect(out.eventId).toBe("1");
      expect(out.unread).toBe(3);
      expect(out.active).toBe(true);
      expect(out.read).toBe(false);
    });
  });
});
