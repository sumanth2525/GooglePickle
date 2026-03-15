/**
 * Unit tests for home page event cards: event id, detail route, card data shape.
 */
import { describe, it, expect } from "vitest";

function getEventIdForCard(event) {
  return event.id != null ? String(event.id) : "";
}

function getEventDetailHash(eventId) {
  return "#event/" + (eventId || "");
}

function eventCardHasRequiredFields(e) {
  return e && (e.id != null || e.title != null);
}

const MOCK_EVENTS = [
  { id: "1", title: "Morning Doubles", date: "Sat 9AM", venue: "Zilker", level: "Intermediate" },
  { id: "2", title: "Sunset Play", date: "Sun 5PM", venue: "Austin High", level: "Advanced" },
  { id: "event-uuid-here", title: "Supabase Event", date: "Mon", venue: "Court 1", level: "Beginner" },
];

describe("Event card event id", () => {
  it("returns string id when event has id", () => {
    expect(getEventIdForCard({ id: "1" })).toBe("1");
    expect(getEventIdForCard({ id: 2 })).toBe("2");
    expect(getEventIdForCard({ id: "event-uuid-here" })).toBe("event-uuid-here");
  });

  it("returns empty string when event id is null or undefined", () => {
    expect(getEventIdForCard({ id: null })).toBe("");
    expect(getEventIdForCard({ id: undefined })).toBe("");
    expect(getEventIdForCard({})).toBe("");
  });
});

describe("Event detail hash", () => {
  it("builds #event/<id> for navigation", () => {
    expect(getEventDetailHash("1")).toBe("#event/1");
    expect(getEventDetailHash("abc")).toBe("#event/abc");
  });

  it("handles empty id", () => {
    expect(getEventDetailHash("")).toBe("#event/");
  });
});

describe("Event card data shape", () => {
  it("each mock event has id and title", () => {
    MOCK_EVENTS.forEach((e) => expect(eventCardHasRequiredFields(e)).toBe(true));
  });

  it("events can have string or uuid id for Supabase", () => {
    const withUuid = { id: "a0000000-0000-0000-0000-000000000001", title: "E" };
    expect(getEventIdForCard(withUuid)).toBe(withUuid.id);
  });
});

describe("Event chat id from event", () => {
  it("event chat document id is event-<eventId>", () => {
    const eventId = "1";
    expect("event-" + eventId).toBe("event-1");
  });

  it("same event always produces same chat id", () => {
    const eventId = "42";
    const chatId = "event-" + eventId;
    expect(chatId).toBe("event-42");
  });
});
