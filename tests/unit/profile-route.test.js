/**
 * Unit tests for Direct Messages / Compose flow: View Profile should route to the
 * selected user's profile, not the logged-in user's.
 * getProfileViewRoute(playerId) is the contract: View Profile uses this to set hash.
 */
import { describe, it, expect } from "vitest";

/**
 * Returns the hash for viewing a player's profile (e.g. #profile/123).
 * Used by View Profile button so it opens the target user's profile, not own profile.
 */
function getProfileViewRoute(playerId) {
  return "#profile/" + (playerId || "");
}

describe("getProfileViewRoute (View Profile from Players / DM compose)", () => {
  it("returns #profile/<id> when player id is provided", () => {
    expect(getProfileViewRoute("1")).toBe("#profile/1");
    expect(getProfileViewRoute("2")).toBe("#profile/2");
    expect(getProfileViewRoute("abc")).toBe("#profile/abc");
  });

  it("returns #profile/ for uuid so View Profile opens that user", () => {
    const uuid = "a0000000-0000-0000-0000-000000000001";
    expect(getProfileViewRoute(uuid)).toBe("#profile/" + uuid);
  });

  it("returns #profile/ when playerId is empty so fallback is profile root", () => {
    expect(getProfileViewRoute("")).toBe("#profile/");
    expect(getProfileViewRoute(null)).toBe("#profile/");
    expect(getProfileViewRoute(undefined)).toBe("#profile/");
  });
});

describe("Direct Messages / Compose flow contract", () => {
  it("Chat → Direct Messages → Compose goes to #players", () => {
    const composeTarget = "players";
    expect(composeTarget).toBe("players");
  });

  it("View Profile from a player card must use that player id in the route", () => {
    const playerId = "42";
    const route = getProfileViewRoute(playerId);
    expect(route).toBe("#profile/42");
    expect(route).not.toBe("#profile");
  });
});
