/**
 * Live chat service (Firebase Firestore).
 * When CONFIG.firebase is set: uses Firestore for messages, real-time listeners for new messages.
 * Otherwise: uses mock messages from MOCK.chatMessages and in-memory new messages.
 *
 * Structure: Firestore collection "chats" → document {chatId} → subcollection "messages"
 * Each message: { body, authorName, authorAvatar, userId, createdAt, imageUrl? }
 */

const ChatService = (function () {
  let firestore = null;
  let unsubscribe = null;

  function isConfigured() {
    return typeof CONFIG !== "undefined" && CONFIG.hasFirebase && CONFIG.hasFirebase();
  }

  function getFirestore() {
    if (firestore) return firestore;
    if (!isConfigured()) return null;
    const fb = typeof window !== "undefined" && window.firebase;
    if (fb && fb.initializeApp) {
      try {
        try {
          fb.app();
        } catch (_e) {
          fb.initializeApp(CONFIG.firebase);
        }
        firestore = fb.firestore();
        return firestore;
      } catch (e) {
        console.warn("Firebase init:", e);
        return null;
      }
    }
    return null;
  }

  function toMessage(doc, currentUserId) {
    const d = doc.data();
    const createdAt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : new Date();
    return {
      id: doc.id,
      author: d.authorName || "User",
      authorAvatar: d.authorAvatar || "",
      time: formatTime(createdAt),
      text: d.body || "",
      me: d.userId === currentUserId || (d.authorName === "Me" && !currentUserId),
      image: d.imageUrl || null,
    };
  }

  function getCurrentUserId() {
    return (typeof window !== "undefined" && window.__pickleballUserId__) || null;
  }

  /**
   * Get messages for a chat.
   */
  function getMessages(chatId) {
    const db = getFirestore();
    if (db) {
      return db
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .get()
        .then((snap) => {
          const currentUserId = getCurrentUserId();
          return snap.docs.map((doc) => toMessage(doc, currentUserId));
        })
        .catch((err) => {
          console.warn("Firebase getMessages:", err);
          return (typeof MOCK !== "undefined" && MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
        });
    }
    const mock = (typeof MOCK !== "undefined" && MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
    return Promise.resolve(mock);
  }

  /**
   * Subscribe to new messages (live updates).
   * onInitial(msgs) - called once with existing messages (Firebase only)
   * onMessage(msg) - called for each new message
   */
  function subscribeToChat(chatId, onMessage, onInitial) {
    const db = getFirestore();
    if (db) {
      if (unsubscribe) unsubscribe();
      const currentUserId = getCurrentUserId();
      let isFirst = true;
      unsubscribe = db
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot(
          (snap) => {
            if (isFirst && onInitial) {
              isFirst = false;
              const msgs = snap.docs.map((doc) => toMessage(doc, currentUserId));
              onInitial(msgs);
            } else {
              snap.docChanges().forEach((change) => {
                if (change.type === "added") onMessage(toMessage(change.doc, currentUserId));
              });
            }
          },
          (err) => console.warn("Firebase subscribe:", err)
        );
      return () => {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      };
    }
    return () => {};
  }

  /**
   * Send a message. Creates/updates parent chat doc (lastMessageAt) for schema consistency.
   */
  function sendMessage(chatId, text, options) {
    const db = getFirestore();
    if (db) {
      const currentUserId = getCurrentUserId();
      const ts =
        typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date();
      const messageData = {
        body: text,
        authorName: options?.authorName || "Me",
        authorAvatar: options?.authorAvatar || "",
        userId: options?.userId || currentUserId || null,
        createdAt: ts,
        imageUrl: options?.imageUrl || null,
      };
      const chatRef = db.collection("chats").doc(chatId);
      return chatRef
        .collection("messages")
        .add(messageData)
        .then((ref) => {
          chatRef.set({ lastMessageAt: ts, lastMessageBody: text }, { merge: true }).catch(() => {});
          return { success: true, id: ref.id };
        })
        .catch((err) => {
          console.warn("Firebase sendMessage:", err);
          throw err;
        });
    }
    return Promise.resolve({ success: true });
  }

  function formatTime(createdAt) {
    if (!createdAt) return "";
    const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const h = d.getHours();
    const m = d.getMinutes();
    const am = h < 12;
    const h12 = h % 12 || 12;
    return h12 + ":" + String(m).padStart(2, "0") + " " + (am ? "AM" : "PM");
  }

  return {
    isConfigured,
    getFirestore,
    getMessages,
    subscribeToChat,
    sendMessage,
  };
})();
