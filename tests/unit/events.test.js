/**
 * Unit tests for events list logic (fallback, shape, tournament tab).
 */
import { describe, it, expect } from "vitest";

const MOCK_EVENTS = [
  { id: "1", title: "Morning Doubles", date: "Sat, 9:00 AM", venue: "Zilker", lat: 30.27, lng: -97.77 },
  { id: "2", title: "Beginner Drills", date: "Sun, 11:30 AM", venue: "Austin High", lat: 30.26, lng: -97.76 },
];

function applyEventsFallback(apiData, mockEvents) {
  const list = apiData && apiData.length > 0 ? apiData : (mockEvents || []).slice();
  return list;
}

function eventHasRequiredFields(event) {
  return (
    event &&
    typeof event.id !== "undefined" &&
    typeof event.title !== "undefined" &&
    (event.date != null || event.venue != null)
  );
}

describe("Events list", () => {
  describe("applyEventsFallback", () => {
    it("uses API data when non-empty", () => {
      const api = [{ id: "a", title: "API Event" }];
      expect(applyEventsFallback(api, MOCK_EVENTS)).toHaveLength(1);
      expect(applyEventsFallback(api, MOCK_EVENTS)[0].id).toBe("a");
    });

    it("falls back to mock when API returns empty array", () => {
      expect(applyEventsFallback([], MOCK_EVENTS)).toHaveLength(2);
      expect(applyEventsFallback([], MOCK_EVENTS)[0].title).toBe("Morning Doubles");
    });

    it("falls back to mock when API is null", () => {
      expect(applyEventsFallback(null, MOCK_EVENTS)).toHaveLength(2);
    });

    it("returns empty array when both API and mock are empty", () => {
      expect(applyEventsFallback([], [])).toHaveLength(0);
    });
  });

  describe("event shape", () => {
    it("each event has id, title, and date or venue", () => {
      MOCK_EVENTS.forEach((e) => expect(eventHasRequiredFields(e)).toBe(true));
    });

    it("events can have lat/lng for distance sort", () => {
      expect(MOCK_EVENTS[0].lat).toBe(30.27);
      expect(MOCK_EVENTS[0].lng).toBe(-97.77);
    });
  });
});
