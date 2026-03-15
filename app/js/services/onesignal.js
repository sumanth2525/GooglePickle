/**
 * OneSignal in-app / push notifications.
 * Works on localhost (with allowLocalhostAsSecureOrigin) and production.
 * Requires CONFIG.onesignal.appId from OneSignal Dashboard → Keys & IDs.
 */
const OneSignalService = (function () {
  function isSupported() {
    return "Notification" in window;
  }

  function isConfigured() {
    return typeof CONFIG !== "undefined" && CONFIG.hasOneSignal && CONFIG.hasOneSignal();
  }

  function getPermission() {
    return Notification.permission;
  }

  function isPermissionGranted() {
    return Notification.permission === "granted";
  }

  /**
   * Initialize OneSignal. Call once when app loads if configured.
   * OneSignal SDK script must be loaded before this (see index.html).
   */
  function init() {
    if (!isConfigured() || !window.OneSignalDeferred) return;
    const appId = CONFIG.onesignal.appId;
    if (!appId) return;
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
        });
      } catch (err) {
        console.warn("OneSignal init skipped:", err && err.message ? err.message : err);
      }
    });
  }

  /**
   * Request notification permission and subscribe.
   * Use when user taps the notifications button.
   */
  async function requestPermissionAndSubscribe() {
    if (!isSupported() || !isConfigured()) {
      return { success: false, error: "Not supported or not configured" };
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { success: false, permission };
      }
      if (typeof window.OneSignal !== "undefined" && window.OneSignal.User?.PushSubscription?.optIn) {
        await window.OneSignal.User.PushSubscription.optIn();
      }
      return { success: true };
    } catch (err) {
      console.warn("OneSignalService:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Set the logged-in user's External User ID so we can send them notifications (e.g. when someone joins their event).
   * Call after init when user is logged in. Use email or profileId as externalId (must be stable and unique).
   */
  function setExternalUserId(externalId) {
    if (!isConfigured() || !externalId || !window.OneSignalDeferred) return Promise.resolve();
    return new Promise((resolve) => {
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          if (!OneSignal || typeof OneSignal.login !== "function") {
            resolve();
            return;
          }
          await OneSignal.login(String(externalId));
        } catch (err) {
          console.warn("OneSignal setExternalUserId:", err && err.message ? err.message : err);
        }
        resolve();
      });
    }).catch(function () { return undefined; });
  }

  return {
    isSupported,
    isConfigured,
    getPermission,
    isPermissionGranted,
    init,
    requestPermissionAndSubscribe,
    setExternalUserId,
  };
})();
