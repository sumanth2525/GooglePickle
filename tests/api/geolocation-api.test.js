/**
 * API integration tests for geolocation fallback (IP-based).
 * Uses ipapi.co (no key) or config.geolocation.ipGeoUrl.
 */
import { describe, it, expect } from "vitest";

const IP_GEO_URL = "https://ipapi.co/json/";

describe("IP Geolocation API", () => {
  describe("GET ipapi.co/json/", () => {
    it("returns lat/lng when API responds 200", async () => {
      const res = await fetch(IP_GEO_URL);
      expect(typeof res.status).toBe("number");
      if (!res.ok) return; // Rate limit / network issues in CI
      const data = await res.json();
      const lat = data.latitude ?? data.lat;
      const lng = data.longitude ?? data.lng ?? data.lon;
      expect(typeof lat).toBe("number");
      expect(typeof lng).toBe("number");
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    });

    it("response includes location fields when OK", async () => {
      const res = await fetch(IP_GEO_URL);
      if (!res.ok) return;
      const data = await res.json();
      const hasGeo = (data.latitude ?? data.lat) != null && (data.longitude ?? data.lng ?? data.lon) != null;
      expect(hasGeo).toBe(true);
    });
  });
});
