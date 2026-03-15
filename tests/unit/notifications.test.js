/**
 * Unit tests for notification service logic (isConfigured, permission).
 */
import { describe, it, expect } from "vitest";

function isConfigured(config) {
  return !!(
    typeof config !== "undefined" &&
    config.firebase?.apiKey &&
    config.firebase?.projectId &&
    config.firebase?.vapidKey
  );
}

function isSupported(hasNotification, hasServiceWorker, hasFirebaseMessaging) {
  return hasNotification && hasServiceWorker && hasFirebaseMessaging;
}

describe("NotificationService logic", () => {
  describe("isConfigured", () => {
    it("returns false when firebase is missing", () => {
      expect(isConfigured({})).toBe(false);
    });

    it("returns false when vapidKey is empty", () => {
      expect(
        isConfigured({
          firebase: { apiKey: "k", projectId: "p", vapidKey: "" },
        })
      ).toBe(false);
    });

    it("returns true when apiKey, projectId, and vapidKey are set", () => {
      expect(
        isConfigured({
          firebase: { apiKey: "k", projectId: "p", vapidKey: "vapid123" },
        })
      ).toBe(true);
    });
  });

  describe("isSupported", () => {
    it("returns true when all flags true", () => {
      expect(isSupported(true, true, true)).toBe(true);
    });

    it("returns false when Notification missing", () => {
      expect(isSupported(false, true, true)).toBe(false);
    });

    it("returns false when serviceWorker missing", () => {
      expect(isSupported(true, false, true)).toBe(false);
    });

    it("returns false when firebase.messaging missing", () => {
      expect(isSupported(true, true, false)).toBe(false);
    });
  });
});
