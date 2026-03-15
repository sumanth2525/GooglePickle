/**
 * FCM Service Worker — handles background push notifications (PWA on iOS 16.4+).
 *
 * SETUP: Copy this file to firebase-messaging-sw.js and replace the placeholders
 * with your Firebase config (Firebase Console → Project Settings → Your apps).
 * Do not commit firebase-messaging-sw.js with real keys (it is gitignored).
 */
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

if (firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(handleBackgroundMessage);
}

function handleBackgroundMessage(payload) {
  const { title, body, icon, data } = payload.notification || payload.data || {};
  const iconUrl =
    icon ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBjcXVDOMD2-VXu2A2iBCoXB5LDaO26iuIAQ-lPQ5JuAZSBXfbCjHboooLZwoj0V76aKbemIc9U3vUI-8p0KZrhhgKYgC9g550o0deo2hlpJz7-1kAOzBlV6QU7ingYnVYzyOWYXFnDDTaIjSUrHn1GSRhsAOqSX_7XMgmKRHLwAp32PGrLiLwx3P_4tC__x1Ufwjvuscmo2YjbG06L7JrxgLbeuUgOsQka1uEzKs4hkv7uRBjtu7DwnnSm__4Jk00ZqqQJ3-rm38U";
  const options = {
    body: body || payload.data?.body || "New notification",
    icon: iconUrl,
    badge: iconUrl,
    data: data || payload.data || {},
    tag: payload.data?.tag || "pickleball",
    renotify: true,
  };
  self.registration.showNotification(title || "Pickleball Community", options);
}
