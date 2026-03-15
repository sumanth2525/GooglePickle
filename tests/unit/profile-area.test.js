/**
 * Unit tests for profile city/area and "My area" players filter (mirrors app.js logic).
 */
import { describe, it, expect } from "vitest";

function normalizeCity(s) {
  return (s || "").toString().toLowerCase().trim();
}

function sameCity(userCity, playerCity) {
  const u = normalizeCity(userCity);
  const p = normalizeCity(playerCity);
  return !!(p && p === u);
}

function getCityFromLocation(location) {
  if (!location || typeof location !== "string") return "";
  return (location.split(",")[0] || "").trim();
}

const MOCK_PLAYERS = [
  { id: "1", name: "Alex", city: "Austin", level: "Intermediate" },
  { id: "2", name: "Sam", city: "Round Rock", level: "Beginner" },
  { id: "3", name: "Jordan", city: "Austin", level: "Advanced" },
];

describe("normalizeCity", () => {
  it("lowercases and trims", () => {
    expect(normalizeCity("Austin")).toBe("austin");
    expect(normalizeCity("  Austin  ")).toBe("austin");
  });

  it("handles null and undefined", () => {
    expect(normalizeCity(null)).toBe("");
    expect(normalizeCity(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(normalizeCity("")).toBe("");
  });
});

describe("sameCity", () => {
  it("returns true when cities match (case insensitive)", () => {
    expect(sameCity("Austin", "Austin")).toBe(true);
    expect(sameCity("austin", "Austin")).toBe(true);
  });

  it("returns false when cities differ", () => {
    expect(sameCity("Austin", "Round Rock")).toBe(false);
  });

  it("returns false when player city is empty", () => {
    expect(sameCity("Austin", "")).toBe(false);
    expect(sameCity("Austin", null)).toBe(false);
  });
});

describe("getCityFromLocation", () => {
  it("extracts city from 'City, State'", () => {
    expect(getCityFromLocation("Austin, TX")).toBe("Austin");
    expect(getCityFromLocation("Round Rock, TX")).toBe("Round Rock");
  });

  it("returns first part when no comma", () => {
    expect(getCityFromLocation("Austin")).toBe("Austin");
  });

  it("returns empty for null or empty", () => {
    expect(getCityFromLocation("")).toBe("");
    expect(getCityFromLocation(null)).toBe("");
  });
});

describe("My area filter", () => {
  it("filters players by same city", () => {
    const userCity = "Austin";
    const filtered = MOCK_PLAYERS.filter((p) => sameCity(userCity, p.city));
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.name)).toContain("Alex");
    expect(filtered.map((p) => p.name)).toContain("Jordan");
  });

  it("returns empty when no players in same city", () => {
    const filtered = MOCK_PLAYERS.filter((p) => sameCity("Miami", p.city));
    expect(filtered).toHaveLength(0);
  });
});

describe("Profile city/state/bio shape", () => {
  it("profile can have city, state, bio for display and matching", () => {
    const profile = { id: "1", name: "Test", city: "Austin", state: "TX", bio: "Love pickleball!" };
    expect(profile.city).toBe("Austin");
    expect(profile.state).toBe("TX");
    expect(profile.bio).toBe("Love pickleball!");
  });
});
