/**
 * Unit tests for app route parsing (mirrors getRoute in app.js).
 */
import { describe, it, expect } from "vitest";

function getRoute(hash) {
  const h = (hash || "#home").slice(1);
  const [page, id] = h.split("/");
  return { page: page || "home", id: id || null };
}

describe("getRoute", () => {
  it("returns home when hash is #home", () => {
    expect(getRoute("#home")).toEqual({ page: "home", id: null });
  });

  it("returns home when hash is empty", () => {
    expect(getRoute("")).toEqual({ page: "home", id: null });
  });

  it("parses page and id for #home/tournaments", () => {
    expect(getRoute("#home/tournaments")).toEqual({ page: "home", id: "tournaments" });
  });

  it("parses #event/123", () => {
    expect(getRoute("#event/123")).toEqual({ page: "event", id: "123" });
  });

  it("parses #profile with no id", () => {
    expect(getRoute("#profile")).toEqual({ page: "profile", id: null });
  });

  it("parses #profile/123 for viewing another user's profile", () => {
    expect(getRoute("#profile/123")).toEqual({ page: "profile", id: "123" });
  });

  it("parses #profile/uuid for viewing another user by Supabase id", () => {
    const uuid = "a0000000-0000-0000-0000-000000000001";
    expect(getRoute("#profile/" + uuid)).toEqual({ page: "profile", id: uuid });
  });

  it("parses #chat/abc", () => {
    expect(getRoute("#chat/abc")).toEqual({ page: "chat", id: "abc" });
  });

  it("parses #courts", () => {
    expect(getRoute("#courts")).toEqual({ page: "courts", id: null });
  });
});
