/**
 * Geolocation service: browser position, IP fallback, and distance/nearby logic.
 * Uses CONFIG.geolocation when present (from config.js).
 */

const GeolocationService = (function () {
  const DEFAULT = { lat: 30.2672, lng: -97.7431 }; // Austin, TX
  const MILES_PER_KM = 0.621371;

  function getConfig() {
    return typeof CONFIG !== "undefined" && CONFIG.geolocation
      ? CONFIG.geolocation
      : { defaultCenter: DEFAULT, maxDistanceMiles: 50 };
  }

  /**
   * Get user position from browser Geolocation API.
   * @returns {Promise<{lat: number, lng: number, label?: string}>}
   */
  function getCurrentPosition() {
    return new Promise((resolve, _reject) => {
      if (!navigator.geolocation) {
        const cfg = getConfig();
        const dc = cfg.defaultCenter || DEFAULT;
        resolve({ lat: dc.lat, lng: dc.lng, label: dc.label });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          // Denied or error: try IP geo if configured, else default
          if (typeof CONFIG !== "undefined" && CONFIG.hasIpGeo && CONFIG.hasIpGeo()) {
            fetchIpGeo()
              .then(resolve)
              .catch(() => {
                const cfg = getConfig();
                const dc = cfg.defaultCenter || DEFAULT;
                resolve({ lat: dc.lat, lng: dc.lng, label: dc.label });
              });
          } else {
            const cfg = getConfig();
            const dc = cfg.defaultCenter || DEFAULT;
            resolve({ lat: dc.lat, lng: dc.lng, label: dc.label });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  /**
   * IP-based geolocation fallback (when CONFIG.geolocation.ipGeoUrl is set).
   */
  function fetchIpGeo() {
    const url =
      typeof CONFIG !== "undefined" && CONFIG.geolocation && CONFIG.geolocation.ipGeoUrl
        ? CONFIG.geolocation.ipGeoUrl
        : null;
    if (!url) return Promise.reject(new Error("No IP geo URL"));
    return fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const lat = data.latitude ?? data.lat;
        const lng = data.longitude ?? data.lng ?? data.lon;
        if (lat != null && lng != null) {
          return { lat: Number(lat), lng: Number(lng), label: data.city || data.region || "" };
        }
        throw new Error("Invalid IP geo response");
      });
  }

  /**
   * Haversine distance in miles between two points.
   */
  function distanceMiles(lat1, lng1, lat2, lng2) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * MILES_PER_KM;
  }

  /**
   * Sort events by distance from user position. Mutates and returns the array.
   * Each event should have .lat and .lng (optional); missing coords get high distance.
   */
  function sortEventsByDistance(events, userLat, userLng) {
    if (userLat == null || userLng == null) return events;
    events.forEach((e) => {
      e._distanceMiles = e.lat != null && e.lng != null ? distanceMiles(userLat, userLng, e.lat, e.lng) : 999;
    });
    events.sort((a, b) => (a._distanceMiles || 999) - (b._distanceMiles || 999));
    return events;
  }

  /**
   * Filter events within maxDistanceMiles of user. Requires events to have .lat, .lng.
   */
  function filterNearbyEvents(events, userLat, userLng, maxMiles) {
    const max = maxMiles ?? getConfig().maxDistanceMiles ?? 50;
    if (userLat == null || userLng == null) return events;
    return events.filter((e) => {
      if (e.lat == null || e.lng == null) return true;
      const d = distanceMiles(userLat, userLng, e.lat, e.lng);
      e._distanceMiles = d;
      return d <= max;
    });
  }

  /**
   * Format distance for display (e.g. "1.2 mi", "0.3 mi").
   */
  function formatDistance(miles) {
    if (miles == null) return "";
    if (miles < 0.1) return "&lt; 0.1 mi";
    return miles.toFixed(1) + " mi";
  }

  return {
    getCurrentPosition,
    fetchIpGeo,
    distanceMiles,
    sortEventsByDistance,
    filterNearbyEvents,
    formatDistance,
    getConfig,
  };
})();
