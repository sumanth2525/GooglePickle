/**
 * Unit tests for app helpers: escapeHtml (XSS), small utilities used in app.js.
 */
import { describe, it, expect } from "vitest";

function escapeHtml(str) {
  if (str == null) return "";
  const s = String(str);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than and greater-than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("1 < 2")).toBe("1 &lt; 2");
  });

  it("escapes double quote", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("returns empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("converts number to string and does not change safe content", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml("Hello")).toBe("Hello");
  });

  it("prevents script injection in attribute context", () => {
    const bad = '"><script>alert(1)</script>';
    expect(escapeHtml(bad)).not.toContain("<script>");
    expect(escapeHtml(bad)).toContain("&lt;script&gt;");
  });
});

describe("Location display from city + state", () => {
  function locationDisplay(city, state) {
    return city && state ? city + ", " + state : city || state || "";
  }

  it("combines city and state", () => {
    expect(locationDisplay("Austin", "TX")).toBe("Austin, TX");
  });

  it("returns city only when state empty", () => {
    expect(locationDisplay("Austin", "")).toBe("Austin");
  });

  it("returns empty when both empty", () => {
    expect(locationDisplay("", "")).toBe("");
  });
});

describe("Apply players list contract", () => {
  function applyPlayersList(players, list) {
    const next = Array.isArray(list) ? list : players;
    return next;
  }

  it("uses list when array is provided", () => {
    const current = [{ id: "1" }];
    const fromApi = [{ id: "2" }, { id: "3" }];
    expect(applyPlayersList(current, fromApi)).toHaveLength(2);
    expect(applyPlayersList(current, fromApi)[0].id).toBe("2");
  });

  it("keeps current when list is not array", () => {
    const current = [{ id: "1" }];
    expect(applyPlayersList(current, null)).toBe(current);
    expect(applyPlayersList(current, undefined)).toBe(current);
  });

  it("empty array replaces list", () => {
    const current = [{ id: "1" }];
    expect(applyPlayersList(current, [])).toHaveLength(0);
  });
});

describe("Courts fallback", () => {
  function courtsToShow(supabaseData, mockCourts) {
    return supabaseData && supabaseData.length ? supabaseData : mockCourts || [];
  }

  it("uses Supabase data when non-empty", () => {
    const fromDb = [{ id: "1", name: "Court A" }];
    const mock = [{ id: "2", name: "Court B" }];
    expect(courtsToShow(fromDb, mock)).toHaveLength(1);
    expect(courtsToShow(fromDb, mock)[0].name).toBe("Court A");
  });

  it("falls back to mock when Supabase returns empty", () => {
    const mock = [{ id: "1", name: "Court A" }];
    expect(courtsToShow([], mock)).toHaveLength(1);
    expect(courtsToShow(null, mock)).toHaveLength(1);
  });
});
