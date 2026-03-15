/**
 * Unit tests for Firebase Auth service logic (config check, connection result shape).
 */
import { describe, it, expect } from "vitest";

function isConfigured(config) {
  return !!(
    typeof config !== "undefined" &&
    config.hasFirebase &&
    typeof config.hasFirebase === "function" &&
    config.hasFirebase()
  );
}

function checkConnectionResult(config, sdkLoaded, authInstance) {
  if (!config || !config.firebase || !config.firebase.apiKey || !config.firebase.projectId) {
    return { ok: false, error: "CONFIG.firebase missing or incomplete (need apiKey, projectId)" };
  }
  if (!sdkLoaded) {
    return { ok: false, error: "Firebase SDK not loaded (firebase.auth missing)" };
  }
  if (!authInstance) {
    return { ok: false, error: "Firebase Auth init failed (check console)" };
  }
  return {
    ok: true,
    projectId: config.firebase.projectId,
    authDomain: config.firebase.authDomain,
    message: "Firebase Auth ready",
  };
}

function syncUserToStorage(user, storage) {
  if (user) {
    storage.pickleball_logged_in = "true";
    storage.pickleball_user_name = user.displayName || user.email || "User";
    storage.pickleball_user_avatar = user.photoURL || "";
    if (user.email) storage.pickleball_user_email = user.email;
  } else {
    delete storage.pickleball_logged_in;
    delete storage.pickleball_user_name;
    delete storage.pickleball_user_avatar;
    delete storage.pickleball_user_email;
  }
}

describe("FirebaseAuthService logic", () => {
  describe("isConfigured", () => {
    it("returns false when config has no hasFirebase", () => {
      expect(isConfigured({})).toBe(false);
    });

    it("returns true when config.hasFirebase is a function returning true", () => {
      const config = { hasFirebase: () => true };
      expect(isConfigured(config)).toBe(true);
    });

    it("returns false when hasFirebase returns false", () => {
      const config = { hasFirebase: () => false };
      expect(isConfigured(config)).toBe(false);
    });
  });

  describe("checkConnectionResult", () => {
    const validConfig = {
      firebase: { apiKey: "key", projectId: "proj", authDomain: "proj.firebaseapp.com" },
    };

    it("returns ok: false when config is incomplete", () => {
      const r = checkConnectionResult({ firebase: {} }, true, {});
      expect(r.ok).toBe(false);
      expect(r.error).toContain("apiKey");
    });

    it("returns ok: false when SDK not loaded", () => {
      const r = checkConnectionResult(validConfig, false, {});
      expect(r.ok).toBe(false);
      expect(r.error).toContain("SDK");
    });

    it("returns ok: false when auth instance is null", () => {
      const r = checkConnectionResult(validConfig, true, null);
      expect(r.ok).toBe(false);
    });

    it("returns ok: true with projectId and message when all valid", () => {
      const r = checkConnectionResult(validConfig, true, { currentUser: null });
      expect(r.ok).toBe(true);
      expect(r.projectId).toBe("proj");
      expect(r.authDomain).toBe("proj.firebaseapp.com");
      expect(r.message).toBe("Firebase Auth ready");
    });
  });

  describe("syncUserToStorage", () => {
    it("sets logged_in and name when user provided", () => {
      const storage = {};
      syncUserToStorage({ displayName: "Alex", email: "a@b.com", photoURL: "https://x.com/1" }, storage);
      expect(storage.pickleball_logged_in).toBe("true");
      expect(storage.pickleball_user_name).toBe("Alex");
      expect(storage.pickleball_user_avatar).toBe("https://x.com/1");
      expect(storage.pickleball_user_email).toBe("a@b.com");
    });

    it("uses email as name when displayName missing", () => {
      const storage = {};
      syncUserToStorage({ email: "u@test.com" }, storage);
      expect(storage.pickleball_user_name).toBe("u@test.com");
    });

    it("uses 'User' when neither displayName nor email", () => {
      const storage = {};
      syncUserToStorage({ photoURL: "" }, storage);
      expect(storage.pickleball_user_name).toBe("User");
    });

    it("clears keys when user is null", () => {
      const storage = {
        pickleball_logged_in: "true",
        pickleball_user_name: "Alex",
        pickleball_user_avatar: "u",
        pickleball_user_email: "e",
      };
      syncUserToStorage(null, storage);
      expect(storage.pickleball_logged_in).toBeUndefined();
      expect(storage.pickleball_user_name).toBeUndefined();
      expect(storage.pickleball_user_avatar).toBeUndefined();
      expect(storage.pickleball_user_email).toBeUndefined();
    });
  });
});
