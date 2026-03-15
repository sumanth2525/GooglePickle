/**
 * Firebase Auth: email/password and Google sign-in.
 * Syncs auth state to localStorage so the rest of the app (getLoggedInUser, isLoggedIn) works.
 * Requires CONFIG.firebase (apiKey, authDomain, projectId, etc.).
 */
const FirebaseAuthService = (function () {
  let auth = null;
  let unsubscribe = null;

  function isConfigured() {
    return typeof CONFIG !== "undefined" && CONFIG.hasFirebase && CONFIG.hasFirebase();
  }

  function getAuth() {
    if (auth) return auth;
    if (typeof firebase === "undefined" || !firebase.auth) return null;
    if (!isConfigured()) return null;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG.firebase);
      }
      auth = firebase.auth();
      return auth;
    } catch (e) {
      console.warn("Firebase Auth init:", e);
      return null;
    }
  }

  function syncUserToStorage(user) {
    if (user) {
      localStorage.setItem("pickleball_logged_in", "true");
      localStorage.setItem("pickleball_user_name", user.displayName || user.email || "User");
      localStorage.setItem("pickleball_user_avatar", user.photoURL || "");
      if (user.email) localStorage.setItem("pickleball_user_email", user.email);
      if (!localStorage.getItem("pickleball_user_player_type"))
        localStorage.setItem("pickleball_user_player_type", "Intermediate");
    } else {
      localStorage.removeItem("pickleball_logged_in");
      localStorage.removeItem("pickleball_user_name");
      localStorage.removeItem("pickleball_user_avatar");
      localStorage.removeItem("pickleball_user_email");
      localStorage.removeItem("pickleball_profile_id");
    }
  }

  /**
   * Map Firebase Auth error codes to user-friendly messages.
   */
  function getAuthErrorMessage(code, defaultMessage) {
    var msg = defaultMessage || "Sign-in failed.";
    if (!code) return msg;
    if (code === "auth/operation-not-allowed")
      return "Google sign-in is not enabled. In Firebase Console go to Authentication → Sign-in method and enable Google.";
    if (code === "auth/unauthorized-domain")
      return "This domain is not allowed. In Firebase Console go to Authentication → Settings → Authorized domains and add this site (e.g. localhost or your app URL).";
    if (code === "auth/popup-blocked") return "Popup was blocked. Allow popups for this site or try again.";
    if (code === "auth/popup-closed-by-user") return "Sign-in was cancelled.";
    if (code === "auth/cancelled-popup-request") return "Please complete the sign-in in the popup, or try again.";
    if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
    if (code === "auth/internal-error") return "Something went wrong. Try again or use email sign-in.";
    return msg;
  }

  /**
   * Start listening to auth state and sync to localStorage. Call once after config is loaded.
   * onRedirectSuccess(errOrMessage) – called when returning from sign-in redirect.
   * onAuthStateChange(user) – optional; called whenever auth state changes so app can sync to Supabase.
   */
  function init(onRedirectSuccess, onAuthStateChange) {
    const a = getAuth();
    if (!a) return;
    if (unsubscribe) return;

    // Handle return from signInWithRedirect (Google sign-in when popup was blocked)
    firebase
      .auth()
      .getRedirectResult()
      .then(function (result) {
        if (result && result.user) {
          syncUserToStorage(result.user);
          if (typeof onRedirectSuccess === "function") onRedirectSuccess();
        }
      })
      .catch(function (err) {
        console.warn("Firebase redirect result:", err);
        if (err && err.code && typeof onRedirectSuccess === "function") {
          onRedirectSuccess(getAuthErrorMessage(err.code, err.message));
        }
      });

    unsubscribe = a.onAuthStateChanged(function (user) {
      syncUserToStorage(user);
      if (typeof onAuthStateChange === "function") onAuthStateChange(user);
    });
  }

  function signUpWithEmail(email, password) {
    const a = getAuth();
    if (!a) return Promise.reject(new Error("Firebase Auth not configured"));
    return firebase
      .auth()
      .createUserWithEmailAndPassword(email, password)
      .then(function (cred) {
        syncUserToStorage(cred.user);
        return { user: cred.user };
      });
  }

  function signInWithEmail(email, password) {
    const a = getAuth();
    if (!a) return Promise.reject(new Error("Firebase Auth not configured"));
    return firebase
      .auth()
      .signInWithEmailAndPassword(email, password)
      .then(function (cred) {
        syncUserToStorage(cred.user);
        return { user: cred.user };
      });
  }

  function signInWithGoogle() {
    const a = getAuth();
    if (!a) return Promise.reject(new Error("Firebase Auth not configured"));
    const provider = new firebase.auth.GoogleAuthProvider();
    return firebase
      .auth()
      .signInWithPopup(provider)
      .then(function (result) {
        syncUserToStorage(result.user);
        return { user: result.user };
      })
      .catch(function (err) {
        var code = err && err.code;
        var friendly = getAuthErrorMessage(code, err.message || "Google sign-in failed.");
        // If popup was blocked, fall back to redirect (user will leave page and come back)
        if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
          return firebase
            .auth()
            .signInWithRedirect(provider)
            .then(function () {
              return { user: null, redirect: true };
            })
            .catch(function (redirectErr) {
              return Promise.reject(
                new Error(getAuthErrorMessage(redirectErr && redirectErr.code, redirectErr.message || friendly))
              );
            });
        }
        return Promise.reject(new Error(friendly));
      });
  }

  function signOut() {
    const a = getAuth();
    if (a) {
      a.signOut();
    }
    syncUserToStorage(null);
  }

  function getCurrentUser() {
    const a = getAuth();
    return a ? a.currentUser : null;
  }

  /**
   * Check Firebase Auth connection: init and SDK readiness.
   * Returns { ok: true, projectId } when configured and auth instance is ready.
   */
  function checkConnection() {
    return new Promise(function (resolve) {
      if (!isConfigured()) {
        resolve({ ok: false, error: "CONFIG.firebase missing or incomplete (need apiKey, projectId)" });
        return;
      }
      if (typeof firebase === "undefined" || !firebase.auth) {
        resolve({ ok: false, error: "Firebase SDK not loaded (firebase.auth missing)" });
        return;
      }
      try {
        const a = getAuth();
        if (!a) {
          resolve({ ok: false, error: "Firebase Auth init failed (check console)" });
          return;
        }
        resolve({
          ok: true,
          projectId: CONFIG.firebase.projectId,
          authDomain: CONFIG.firebase.authDomain,
          message: "Firebase Auth ready",
        });
      } catch (e) {
        resolve({ ok: false, error: e.message || String(e) });
      }
    });
  }

  return {
    isConfigured,
    init,
    checkConnection,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    syncUserToStorage,
  };
})();
