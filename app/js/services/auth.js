/**
 * Auth service: Twilio-based mobile login and account creation (SMS verify).
 * With real keys: call your backend (sendCodeUrl / verifyCodeUrl) or Twilio Verify.
 * Without keys: mock flow (code stored in sessionStorage for demo).
 */

const AuthService = (function () {
  const STORAGE_KEY = "pickleball_logged_in";
  const PENDING_CODE_KEY = "pickleball_pending_phone";
  const PENDING_VERIFY_KEY = "pickleball_pending_code";

  function isConfigured() {
    return typeof CONFIG !== "undefined" && CONFIG.hasTwilio && CONFIG.hasTwilio();
  }

  function isLoggedIn() {
    if (
      typeof FirebaseAuthService !== "undefined" &&
      FirebaseAuthService.isConfigured &&
      FirebaseAuthService.isConfigured() &&
      FirebaseAuthService.getCurrentUser
    ) {
      const user = FirebaseAuthService.getCurrentUser();
      if (user) return true;
    }
    return localStorage.getItem(STORAGE_KEY) === "true";
  }

  function setLoggedIn(value) {
    if (value) localStorage.setItem(STORAGE_KEY, "true");
    else localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Normalize phone to E.164 for display/storage (strip non-digits, ensure +1 for US).
   * Rejects input longer than 15 digits (E.164 max).
   */
  function normalizePhone(phone) {
    const s = String(phone);
    if (s.length > 20) throw new Error("Phone number too long.");
    const digits = s.replace(/\D/g, "");
    if (digits.length > 15) throw new Error("Invalid phone number.");
    if (digits.length === 10) return "+1" + digits;
    if (digits.length === 11 && digits[0] === "1") return "+" + digits;
    return "+" + digits;
  }

  /**
   * Send verification code to phone.
   * With backend: POST to sendCodeUrl { phone }. Real SMS via Twilio when server + env are set.
   * Mock: when no backend or request fails, store code 123456 for demo.
   */
  function sendVerificationCode(phone) {
    const normalized = normalizePhone(phone);
    const config = typeof CONFIG !== "undefined" && CONFIG.twilio ? CONFIG.twilio : {};

    if (config.sendCodeUrl) {
      return fetch(config.sendCodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      })
        .then(function (r) {
          return r
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              if (r.ok && (data.success || data.sid)) return { success: true, phone: normalized };
              throw new Error(data.error || "Failed to send code");
            });
        })
        .catch(function (err) {
          if (err.message && err.message !== "Failed to send code") throw err;
          if (err.name === "TypeError" && (err.message || "").indexOf("fetch") !== -1) {
            throw new Error(
              "Auth server unreachable. Run in a separate terminal: npm run auth-server. Add server/.env with Twilio keys and Verify Service SID (VA...)."
            );
          }
          throw err;
        });
    }

    // Mock: no backend URL — store code 123456 and phone for verify (no real SMS)
    const mockCode = "123456";
    sessionStorage.setItem(PENDING_CODE_KEY, normalized);
    sessionStorage.setItem(PENDING_VERIFY_KEY, mockCode);
    return Promise.resolve({ success: true, phone: normalized });
  }

  /**
   * Verify code and log the user in (or create account).
   * With backend: POST to verifyCodeUrl { phone, code }.
   * Mock: compare with sessionStorage code.
   */
  function verifyCode(phone, code) {
    const normalized = normalizePhone(phone);
    const config = typeof CONFIG !== "undefined" && CONFIG.twilio ? CONFIG.twilio : {};

    if (config.verifyCodeUrl) {
      return fetch(config.verifyCodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, code: String(code).trim() }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (r.ok && (data.verified || data.success)) {
              setLoggedIn(true);
              return { success: true };
            }
            throw new Error(data.error || "Invalid code");
          });
        })
        .catch(function (err) {
          if (err.message) throw err;
          throw new Error("Could not verify. Check auth server is running.");
        });
    }

    const pendingPhone = sessionStorage.getItem(PENDING_CODE_KEY);
    const pendingCode = sessionStorage.getItem(PENDING_VERIFY_KEY);
    if (pendingPhone !== normalized || !pendingCode) {
      return Promise.reject(new Error("No pending verification for this number. Request a new code."));
    }
    if (String(code).trim() !== pendingCode) {
      return Promise.reject(new Error("Invalid code"));
    }
    sessionStorage.removeItem(PENDING_CODE_KEY);
    sessionStorage.removeItem(PENDING_VERIFY_KEY);
    setLoggedIn(true);
    return Promise.resolve({ success: true });
  }

  function logOut() {
    if (typeof FirebaseAuthService !== "undefined" && FirebaseAuthService.signOut) {
      FirebaseAuthService.signOut();
    }
    setLoggedIn(false);
  }

  return {
    isConfigured,
    isLoggedIn,
    setLoggedIn,
    normalizePhone,
    sendVerificationCode,
    verifyCode,
    logOut,
  };
})();
