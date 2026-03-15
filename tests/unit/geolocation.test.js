import { describe, it, expect } from "vitest";

/**
 * Pure geolocation logic (mirrors js/services/geolocation.js)
 */
const MILES_PER_KM = 0.621371;

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * MILES_PER_KM;
}

function formatDistance(miles) {
  if (miles == null) return "";
  if (miles < 0.1) return "< 0.1 mi";
  return miles.toFixed(1) + " mi";
}

function sortEventsByDistance(events, userLat, userLng) {
  if (userLat == null || userLng == null) return events;
  events.forEach((e) => {
    e._distanceMiles = e.lat != null && e.lng != null ? distanceMiles(userLat, userLng, e.lat, e.lng) : 999;
  });
  events.sort((a, b) => (a._distanceMiles ?? 999) - (b._distanceMiles ?? 999));
  return events;
}

function filterNearbyEvents(events, userLat, userLng, maxMiles) {
  const max = maxMiles ?? 50;
  if (userLat == null || userLng == null) return events;
  return events.filter((e) => {
    if (e.lat == null || e.lng == null) return true;
    const d = distanceMiles(userLat, userLng, e.lat, e.lng);
    e._distanceMiles = d;
    return d <= max;
  });
}

describe("GeolocationService", () => {
  describe("distanceMiles", () => {
    it("returns 0 for same point", () => {
      expect(distanceMiles(30, -97, 30, -97)).toBeCloseTo(0, 2);
    });

    it("computes approximate Austin to Round Rock distance", () => {
      const d = distanceMiles(30.2672, -97.7431, 30.5083, -97.6789);
      expect(d).toBeGreaterThan(15);
      expect(d).toBeLessThan(30);
    });

    it("is symmetric", () => {
      expect(distanceMiles(30, -97, 31, -96)).toBeCloseTo(distanceMiles(31, -96, 30, -97), 2);
    });
  });

  describe("formatDistance", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatDistance(null)).toBe("");
      expect(formatDistance(undefined)).toBe("");
    });

    it("returns < 0.1 mi for small distances", () => {
      expect(formatDistance(0.05)).toBe("< 0.1 mi");
    });

    it("formats miles to 1 decimal", () => {
      expect(formatDistance(1.2)).toBe("1.2 mi");
      expect(formatDistance(22)).toBe("22.0 mi");
    });
  });

  describe("sortEventsByDistance", () => {
    it("returns events unchanged when user position is null", () => {
      const events = [{ id: 1, lat: 30, lng: -97 }];
      expect(sortEventsByDistance(events, null, null)).toBe(events);
    });

    it("adds _distanceMiles and sorts by distance", () => {
      const events = [
        { id: "far", lat: 31, lng: -96 },
        { id: "near", lat: 30.27, lng: -97.74 },
      ];
      sortEventsByDistance(events, 30.2672, -97.7431);
      expect(events[0].id).toBe("near");
      expect(events[0]._distanceMiles).toBeLessThan(events[1]._distanceMiles);
    });

    it("assigns 999 miles to events without coords, sorts by distance", () => {
      const events = [{ id: "no-coords" }, { id: "with-coords", lat: 30, lng: -97 }];
      sortEventsByDistance(events, 30, -97);
      const withCoords = events.find((e) => e.lat != null);
      const withoutCoords = events.find((e) => e.lat == null);
      expect(withCoords._distanceMiles).toBeLessThan(1);
      expect(withoutCoords._distanceMiles).toBe(999);
      expect(events[0].id).toBe("with-coords");
    });
  });

  describe("filterNearbyEvents", () => {
    it("returns all events when user position is null", () => {
      const events = [{ id: "1", lat: 30, lng: -97 }];
      expect(filterNearbyEvents(events, null, null, 10)).toBe(events);
    });

    it("includes events within maxMiles", () => {
      const events = [
        { id: "near", lat: 30.27, lng: -97.74 },
        { id: "far", lat: 31.5, lng: -96 },
      ];
      const out = filterNearbyEvents(events, 30.2672, -97.7431, 5);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe("near");
      expect(out[0]._distanceMiles).toBeLessThanOrEqual(5);
    });

    it("includes events without coords", () => {
      const events = [{ id: "no-coords" }, { id: "with-coords", lat: 30, lng: -97 }];
      const out = filterNearbyEvents(events, 30, -97, 1);
      expect(out).toHaveLength(2);
      expect(out.some((e) => e.id === "no-coords")).toBe(true);
    });

    it("uses default max 50 when maxMiles not provided", () => {
      const events = [{ id: "a", lat: 30.27, lng: -97.74 }];
      const out = filterNearbyEvents(events, 30.2672, -97.7431);
      expect(out).toHaveLength(1);
    });
  });
});
