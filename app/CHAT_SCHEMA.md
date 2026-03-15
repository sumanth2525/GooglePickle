# Group & Event Chat — Firebase Firestore Schema

**Choice: Firebase Firestore** for real-time group and event chat (best latency, offline support, simple model).

---

## Firestore structure

```
chats (collection)
  └── {chatId} (document)          ← one per event or DM thread
        ├── title (string)         optional: "Morning Doubles @ Zilker"
        ├── eventId (string)       optional: "1" (links to event)
        ├── lastMessageAt (timestamp)  set on each send (for sorting)
        ├── lastMessageBody (string)  set on each send (preview)
        └── messages (subcollection)
              └── {messageId} (document)
                    ├── body (string)         required
                    ├── authorName (string)  required
                    ├── authorAvatar (string)
                    ├── userId (string)      optional, for "me" detection
                    ├── createdAt (timestamp) required
                    └── imageUrl (string)   optional
```

---

## Field reference

### Collection: `chats`

| Document ID | Description |
|-------------|-------------|
| `"1"` | Event 1 group chat |
| `"2"` | Event 2 group chat |
| `"dm-{uid1}-{uid2}"` | 1:1 DM (optional, same schema) |

### Document: `chats/{chatId}` (optional metadata)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | No | Display name, e.g. "Morning Doubles @ Zilker" |
| eventId | string | No | Event id for event chats |
| lastMessageAt | timestamp | No | Updated on each message (for chat list ordering) |
| lastMessageBody | string | No | Last message preview (updated on each send) |

### Subcollection: `chats/{chatId}/messages`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| body | string | Yes | Message text |
| authorName | string | Yes | Display name, e.g. "Alex" or "Me" |
| authorAvatar | string | No | Avatar URL |
| userId | string | No | Stable user id (for "me" and future auth) |
| createdAt | timestamp | Yes | Server timestamp preferred |
| imageUrl | string | No | Attachment image URL |

---

## Security rules (Firestore → Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chat metadata (optional)
    match /chats/{chatId} {
      allow read, write: if true;  // tighten in production (e.g. auth != null)
    }
    // Messages (group/event chat)
    match /chats/{chatId}/messages/{messageId} {
      allow read: if true;
      allow create: if request.auth != null || true;  // use request.auth != null in production
      allow update, delete: if false;                 // messages are append-only
    }
  }
}
```

**Production:** Replace `if true` with `request.auth != null` (and optionally check chat membership).

---

## Indexes

- **Composite:** Collection `chats/{chatId}/messages`, fields `createdAt` (Ascending).  
  Firestore may prompt you to create this when you first run a query; accept the link in the error.

---

## Creating an event chat

1. **From app:** Use `chatId` = event id (e.g. `"1"` for event 1). No need to create `chats/1` first; the first message creates the subcollection.
2. **Optional:** Create the chat document for metadata (e.g. from your backend when an event is created):

   ```js
   db.collection('chats').doc(eventId).set({
     title: 'Morning Doubles @ Zilker',
     eventId: '1',
     lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
   }, { merge: true });
   ```

The app currently uses **Supabase or MOCK** for the **chat list** (title, last message, time). Firestore is used only for **live messages** inside a chat. To drive the list from Firestore you’d update `chats/{chatId}` on each new message (e.g. `lastMessage`, `lastMessageAt`).

---

## Summary

| What | Where |
|------|--------|
| Chat list (title, last message, unread) | Supabase `chats` table or MOCK |
| Live messages (group/event chat) | **Firebase Firestore** `chats/{chatId}/messages` |
| Send / subscribe | `ChatService.sendMessage`, `ChatService.subscribeToChat` in `js/services/chat.js` |
