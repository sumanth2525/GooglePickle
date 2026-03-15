import { describe, it, expect } from "vitest";

/**
 * Chat message formatting (mirrors js/services/chat.js)
 */
function formatTime(createdAt) {
  if (!createdAt) return "";
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  const h12 = h % 12 || 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + (am ? "AM" : "PM");
}

function toMessageShape(docData, currentUserId) {
  return {
    id: docData.id,
    author: docData.authorName || "User",
    authorAvatar: docData.authorAvatar || "",
    time: formatTime(docData.createdAt),
    text: docData.body || "",
    me: docData.userId === currentUserId || (docData.authorName === "Me" && !currentUserId),
  };
}

describe("ChatService", () => {
  describe("formatTime", () => {
    it("formats 7:15 AM", () => {
      const d = new Date(2024, 0, 1, 7, 15);
      expect(formatTime(d)).toBe("7:15 AM");
    });

    it("formats 12:30 PM", () => {
      const d = new Date(2024, 0, 1, 12, 30);
      expect(formatTime(d)).toBe("12:30 PM");
    });

    it("returns empty string for null", () => {
      expect(formatTime(null)).toBe("");
    });
  });

  describe("toMessage shape", () => {
    it("marks message as 'me' when userId matches", () => {
      const shape = toMessageShape({ id: "1", body: "Hi", authorName: "Me", userId: "u1", authorAvatar: "" }, "u1");
      expect(shape.me).toBe(true);
    });

    it("marks message as not 'me' when userId differs", () => {
      const shape = toMessageShape({ id: "1", body: "Hi", authorName: "Bob", userId: "u2", authorAvatar: "" }, "u1");
      expect(shape.me).toBe(false);
    });
  });
});
