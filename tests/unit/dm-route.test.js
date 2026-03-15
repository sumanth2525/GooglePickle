/**
 * Unit tests for DM and event chat routes (mirrors app.js routing).
 * - #chat/dm-<profileId> opens direct message with that user
 * - #chat/event-<eventId> opens event chat
 * - getDMChatId produces stable room id for two users
 */
import { describe, it, expect } from "vitest";

function getRoute(hash) {
  const h = (hash || "#home").slice(1);
  const [page, id] = h.split("/");
  return { page: page || "home", id: id || null };
}

/**
 * Stable DM chat id so both users see the same thread (mirrors getDMChatId in app.js).
 */
function getDMChatId(myProfileId, otherProfileId) {
  const myId = myProfileId ? String(myProfileId) : "me";
  const other = String(otherProfileId || "");
  if (!other) return null;
  return "dm-" + [myId, other].sort().join("-");
}

describe("getRoute", () => {
  it("parses #chat/dm-123 for direct message with user 123", () => {
    const r = getRoute("#chat/dm-123");
    expect(r.page).toBe("chat");
    expect(r.id).toBe("dm-123");
  });

  it("parses #chat/dm-<uuid> for DM with Supabase profile", () => {
    const uuid = "a0000000-0000-0000-0000-000000000001";
    const r = getRoute("#chat/dm-" + uuid);
    expect(r.page).toBe("chat");
    expect(r.id).toBe("dm-" + uuid);
  });

  it("parses #chat/event-1 for event chat", () => {
    const r = getRoute("#chat/event-1");
    expect(r.page).toBe("chat");
    expect(r.id).toBe("event-1");
  });

  it("parses #chat/event-<uuid> for event chat with Supabase event id", () => {
    const uuid = "b0000000-0000-0000-0000-000000000002";
    const r = getRoute("#chat/event-" + uuid);
    expect(r.page).toBe("chat");
    expect(r.id).toBe("event-" + uuid);
  });

  it("id.startsWith('dm-') identifies DM route", () => {
    const r = getRoute("#chat/dm-abc");
    expect(r.id && r.id.startsWith("dm-")).toBe(true);
  });

  it("id.startsWith('event-') identifies event chat route", () => {
    const r = getRoute("#chat/event-1");
    expect(r.id && r.id.startsWith("event-")).toBe(true);
  });
});

describe("getDMChatId", () => {
  it("returns stable id for two users (order independent)", () => {
    const id1 = getDMChatId("user-a", "user-b");
    const id2 = getDMChatId("user-b", "user-a");
    expect(id1).toBe(id2);
    expect(id1).toBe("dm-user-a-user-b");
  });

  it("returns null when otherProfileId is empty", () => {
    expect(getDMChatId("me", "")).toBe(null);
    expect(getDMChatId("me", null)).toBe(null);
  });

  it("uses 'me' when myProfileId is missing", () => {
    expect(getDMChatId(null, "other")).toBe("dm-me-other");
    expect(getDMChatId("", "other")).toBe("dm-me-other");
  });

  it("produces valid Firestore-style document id", () => {
    const id = getDMChatId("uuid-1", "uuid-2");
    expect(id).toMatch(/^dm-[a-z0-9-]+$/);
    expect(id.length).toBeGreaterThan(3);
  });
});

describe("DM and event chat slice contract", () => {
  it("DM otherProfileId is id.slice(3) when id is dm-xxx", () => {
    const id = "dm-550e8400-e29b-41d4-a716-446655440000";
    expect(id.slice(3)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("event chat eventId is id.slice(6) when id is event-xxx", () => {
    const id = "event-1";
    expect(id.slice(6)).toBe("1");
    expect("event-abc-uuid".slice(6)).toBe("abc-uuid");
  });
});
