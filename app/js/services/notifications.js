/**
 * Push notifications (FCM).
 * Works when PWA is added to home screen on iOS 16.4+.
 * Requires CONFIG.firebase with vapidKey.
 */
const NotificationService = (function () {
  const TOKEN_KEY = "pickleball_fcm_token";

  function isSupported() {
    return (
      "Notification" in window && "serviceWorker" in navigator && typeof firebase !== "undefined" && firebase.messaging
    );
  }

  function isConfigured() {
    return (
      typeof CONFIG !== "undefined" &&
      CONFIG.firebase?.apiKey &&
      CONFIG.firebase?.projectId &&
      CONFIG.firebase?.vapidKey
    );
  }

  function getPermission() {
    return Notification.permission;
  }

  function isPermissionGranted() {
    return Notification.permission === "granted";
  }

  /**
   * Request notification permission and subscribe to FCM.
   * Call when user taps the notifications button or on first visit.
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
      const token = await subscribe();
      return { success: true, token };
    } catch (err) {
      console.warn("NotificationService:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Subscribe to FCM and return token. Send token to your backend to target this device.
   */
  async function subscribe() {
    if (!isSupported() || !isConfigured()) return null;
    const { vapidKey } = CONFIG.firebase;
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register("firebase-messaging-sw.js", { scope: "./" });
      await navigator.serviceWorker.ready;
    }
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (token) localStorage.setItem(TOKEN_KEY, token);
    return token;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Handle foreground messages (app open). Background handled by SW.
   */
  function onForegroundMessage(callback) {
    if (!isSupported() || !firebase.messaging) return () => {};
    const messaging = firebase.messaging();
    const unsub = messaging.onMessage((payload) => {
      if (callback) callback(payload);
    });
    return () => unsub && unsub();
  }

  return {
    isSupported,
    isConfigured,
    getPermission,
    isPermissionGranted,
    requestPermissionAndSubscribe,
    subscribe,
    getToken,
    onForegroundMessage,
  };
})();
