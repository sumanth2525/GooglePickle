import { describe, it, expect, beforeEach } from "vitest";

/**
 * Config helper logic (mirrors js/config.js)
 */
function hasTwilio(c) {
  return !!(c.twilio?.accountSid && c.twilio?.authToken) || !!(c.twilio?.sendCodeUrl && c.twilio?.verifyCodeUrl);
}

function hasFirebase(c) {
  return !!(c.firebase?.apiKey && c.firebase?.projectId);
}

function hasSupabase(c) {
  return !!(c.supabase?.url && c.supabase?.anonKey);
}

function hasIpGeo(c) {
  return !!c.geolocation?.ipGeoUrl;
}

function hasOneSignal(c) {
  return !!(c.onesignal && c.onesignal.appId);
}

describe("CONFIG helpers", () => {
  let config;

  beforeEach(() => {
    config = {
      twilio: {
        accountSid: "",
        authToken: "",
        sendCodeUrl: "",
        verifyCodeUrl: "",
      },
      firebase: {
        apiKey: "",
        projectId: "",
      },
      supabase: {
        url: "",
        anonKey: "",
      },
      geolocation: {
        ipGeoUrl: "",
      },
      onesignal: {
        appId: "",
      },
    };
  });

  describe("hasTwilio", () => {
    it("returns false when twilio is empty", () => {
      expect(hasTwilio(config)).toBe(false);
    });

    it("returns true when accountSid and authToken are set", () => {
      config.twilio.accountSid = "AC123";
      config.twilio.authToken = "secret";
      expect(hasTwilio(config)).toBe(true);
    });

    it("returns true when sendCodeUrl and verifyCodeUrl are set", () => {
      config.twilio.sendCodeUrl = "https://api.com/send";
      config.twilio.verifyCodeUrl = "https://api.com/verify";
      expect(hasTwilio(config)).toBe(true);
    });

    it("returns false when only accountSid is set", () => {
      config.twilio.accountSid = "AC123";
      expect(hasTwilio(config)).toBe(false);
    });
  });

  describe("hasFirebase", () => {
    it("returns false when firebase is empty", () => {
      expect(hasFirebase(config)).toBe(false);
    });

    it("returns true when apiKey and projectId are set", () => {
      config.firebase.apiKey = "AIza...";
      config.firebase.projectId = "my-project";
      expect(hasFirebase(config)).toBe(true);
    });

    it("returns false when only apiKey is set", () => {
      config.firebase.apiKey = "AIza...";
      expect(hasFirebase(config)).toBe(false);
    });
  });

  describe("hasSupabase", () => {
    it("returns false when supabase is empty", () => {
      expect(hasSupabase(config)).toBe(false);
    });

    it("returns true when url and anonKey are set", () => {
      config.supabase.url = "https://xxx.supabase.co";
      config.supabase.anonKey = "eyJhbG...";
      expect(hasSupabase(config)).toBe(true);
    });

    it("returns false when only url is set", () => {
      config.supabase.url = "https://xxx.supabase.co";
      expect(hasSupabase(config)).toBe(false);
    });
  });

  describe("hasIpGeo", () => {
    it("returns false when ipGeoUrl is empty", () => {
      expect(hasIpGeo(config)).toBe(false);
    });

    it("returns true when ipGeoUrl is set", () => {
      config.geolocation.ipGeoUrl = "https://ipapi.co/json/";
      expect(hasIpGeo(config)).toBe(true);
    });
  });

  describe("hasOneSignal", () => {
    it("returns false when onesignal is missing or appId empty", () => {
      expect(hasOneSignal(config)).toBe(false);
      config.onesignal = {};
      expect(hasOneSignal(config)).toBe(false);
    });

    it("returns true when onesignal.appId is set", () => {
      config.onesignal = { appId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" };
      expect(hasOneSignal(config)).toBe(true);
    });
  });
});
