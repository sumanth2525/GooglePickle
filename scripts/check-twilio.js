/**
 * Check Twilio connection by calling the auth server's /api/auth/check.
 * Start the auth server first: npm run auth-server
 */
const AUTH_SERVER = process.env.AUTH_SERVER_URL || "http://localhost:3081";

async function main() {
  const url = AUTH_SERVER + "/api/auth/check";
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Twilio check failed:", res.status, data.error || res.statusText);
      if (data.hint) console.error("Hint:", data.hint);
      process.exit(1);
    }
    console.log("Twilio connection:", data.ok ? "OK" : "FAIL");
    console.log(data.message || data.error || "Unknown");
    if (data.accountSid) console.log("Account:", data.accountSid);
    if (data.verifyConfigured !== undefined) console.log("Verify SMS configured:", data.verifyConfigured);
    process.exit(data.ok ? 0 : 1);
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED" || err.code === "ECONNREFUSED") {
      console.error("Auth server not reachable at", AUTH_SERVER);
      console.error("Start it with: npm run auth-server");
    } else {
      console.error("Error:", err.message || err);
    }
    process.exit(1);
  }
}

main();
