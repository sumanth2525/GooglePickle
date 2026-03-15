/**
 * Local config: copy this file to config.local.js and set your keys.
 * config.local.js is gitignored. In index.html add before config.js:
 *   <script src="js/config.local.js"></script>
 */
window.__PICKLEBALL_ENV__ = {
  SEND_CODE_URL: "http://localhost:3081/api/auth/send-code",
  VERIFY_CODE_URL: "http://localhost:3081/api/auth/verify-code",
  FIREBASE_API_KEY: "",
  FIREBASE_AUTH_DOMAIN: "",
  FIREBASE_PROJECT_ID: "",
  FIREBASE_STORAGE_BUCKET: "",
  FIREBASE_MESSAGING_SENDER_ID: "",
  FIREBASE_APP_ID: "",
  FIREBASE_VAPID_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  // If your DB has app_profiles (and profiles is for auth.users), set:
  // SUPABASE_PROFILES_TABLE: "app_profiles",
  // SUPABASE_FRIEND_REQUESTS_TABLE: "app_friend_requests",
  // IMPORTANT: SUPABASE_URL and SUPABASE_ANON_KEY must be from the SAME project.
  // Use the anon PUBLIC key only (Dashboard → Settings → API → anon public). Never use the service_role key in the app.
  ONESIGNAL_APP_ID: "",
  IP_GEO_URL: "https://ipapi.co/json/",
};
