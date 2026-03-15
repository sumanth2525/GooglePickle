/**
 * App configuration. Use placeholders below; in production inject from env or a secure config endpoint.
 * Never commit real secrets. See .env.example and docs/AGENTIC-AUDIT.md.
 */
(function () {
  var env = typeof window !== "undefined" && window.__PICKLEBALL_ENV__ ? window.__PICKLEBALL_ENV__ : {};
  var get = function (key, fallback) {
    return env[key] != null && env[key] !== "" ? env[key] : fallback || "";
  };

  window.CONFIG = {
    twilio: {
      accountSid: get("TWILIO_ACCOUNT_SID"),
      authToken: get("TWILIO_AUTH_TOKEN"),
      verifyServiceSid: get("TWILIO_VERIFY_SERVICE_SID"),
      sendCodeUrl: get("SEND_CODE_URL", "http://localhost:3081/api/auth/send-code"),
      verifyCodeUrl: get("VERIFY_CODE_URL", "http://localhost:3081/api/auth/verify-code"),
    },
    firebase: {
      apiKey: get("FIREBASE_API_KEY"),
      authDomain: get("FIREBASE_AUTH_DOMAIN"),
      projectId: get("FIREBASE_PROJECT_ID"),
      storageBucket: get("FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: get("FIREBASE_MESSAGING_SENDER_ID"),
      appId: get("FIREBASE_APP_ID"),
      vapidKey: get("FIREBASE_VAPID_KEY", ""),
    },
    supabase: {
      url: get("SUPABASE_URL"),
      anonKey: get("SUPABASE_ANON_KEY"),
      profilesTable: get("SUPABASE_PROFILES_TABLE", "profiles"),
      friendRequestsTable: get("SUPABASE_FRIEND_REQUESTS_TABLE", "friend_requests"),
    },
    onesignal: {
      appId: get("ONESIGNAL_APP_ID", ""),
      notifyEventCreatorUrl: get("NOTIFY_EVENT_CREATOR_URL", ""),
    },
    geolocation: {
      ipGeoUrl: get("IP_GEO_URL", "https://ipapi.co/json/"),
      defaultCenter: { lat: 30.2672, lng: -97.7431, label: "Austin, TX" },
      maxDistanceMiles: 50,
    },
  };

  var CONFIG = window.CONFIG;
  CONFIG.hasTwilio = function () {
    return (
      !!(CONFIG.twilio.accountSid && CONFIG.twilio.authToken) ||
      !!(CONFIG.twilio.sendCodeUrl && CONFIG.twilio.verifyCodeUrl)
    );
  };
  CONFIG.hasFirebase = function () {
    return !!(CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
  };
  CONFIG.hasSupabase = function () {
    return !!(CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey);
  };
  CONFIG.hasIpGeo = function () {
    return !!CONFIG.geolocation.ipGeoUrl;
  };
  CONFIG.hasOneSignal = function () {
    return !!(CONFIG.onesignal && CONFIG.onesignal.appId);
  };
})();
