/**
 * OSMCourtsService
 * Uses free OpenStreetMap / Overpass API to find nearby courts by location.
 * Optionally uses Nominatim to reverse-geocode to a human-friendly address.
 *
 * This is used as a fallback when Supabase courts are not configured.
 */

const OSMCourtsService = (function () {
  const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
  const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

  const USER_AGENT = "PickleballCommunity/1.0 (https://github.com/pickleball-community)";

  async function fetchJson(url, options) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Reverse geocode a point to an address string using Nominatim.
   */
  async function reverseGeocode(lat, lng) {
    const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`;
    const data = await fetchJson(url);
    return data.display_name || "";
  }

  /**
   * Fetch nearby courts (tennis / pickleball) from Overpass.
   * radiusMeters: search radius around the user.
   */
  async function fetchNearbyCourts(lat, lng, radiusMeters = 10000) {
    const query = `
      [out:json][timeout:25];
      (
        node["leisure"="pitch"]["sport"~"tennis|pickleball"](around:${radiusMeters},${lat},${lng});
        way["leisure"="pitch"]["sport"~"tennis|pickleball"](around:${radiusMeters},${lat},${lng});
        relation["leisure"="pitch"]["sport"~"tennis|pickleball"](around:${radiusMeters},${lat},${lng});
      );
      out center 40;
    `;
    const body = new URLSearchParams({ data: query.trim() });
    const data = await fetchJson(OVERPASS_URL, {
      method: "POST",
      body,
    });
    const elements = data.elements || [];

    // Limit reverse-geocode lookups for performance.
    const courts = [];
    for (let idx = 0; idx < Math.min(elements.length, 20); idx++) {
      const el = elements[idx];
      const center = el.center || el;
      const cLat = center.lat;
      const cLng = center.lon;
      if (cLat == null || cLng == null) continue;
      let address = "";
      try {
        address = await reverseGeocode(cLat, cLng);
      } catch (_e) {
        address = "";
      }
      const tags = el.tags || {};
      const courtsCount = Math.max(1, Number(tags["capacity:persons"] || tags["capacity"] || 1) || 1);
      courts.push({
        id: String(el.id || "osm-" + (idx + 1)),
        name: tags.name || "Pickleball / Tennis Courts",
        address: address || `${cLat.toFixed(4)}, ${cLng.toFixed(4)}`,
        courts: courtsCount,
        surface: tags.surface || "Unknown surface",
        lights: tags.lit === "yes",
        distance: "",
        lat: cLat,
        lng: cLng,
        image: "https://images.unsplash.com/photo-1519687663-2b5c9034a47a?auto=format&fit=crop&w=900&q=80",
        amenities: tags.access || "",
      });
    }

    return courts;
  }

  /**
   * Convenience: get courts around a user position.
   */
  async function getNearbyCourts(lat, lng) {
    if (lat == null || lng == null) return [];
    return fetchNearbyCourts(lat, lng, 15000);
  }

  return {
    getNearbyCourts,
  };
})();
