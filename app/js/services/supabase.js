/**
 * Supabase API service — events, courts, chats, profiles.
 * Auth = Firebase only. Account creation = Supabase profile (created when user signs in with Firebase).
 * Finding people = findPeople() queries Supabase profiles by city, player type, or search text.
 * When CONFIG.supabase is set, fetches from Supabase; app falls back to MOCK when not configured or on error.
 * Table names are configurable: CONFIG.supabase.profilesTable (default "profiles"), friendRequestsTable (default "friend_requests"). For an existing DB with profiles(id)→auth.users, run 001_app_profiles_for_firebase.sql and set these to "app_profiles" / "app_friend_requests".
 */
const SupabaseService = (function () {
  let client = null;
  function getProfilesTable() {
    return (typeof CONFIG !== "undefined" && CONFIG.supabase && CONFIG.supabase.profilesTable) || "profiles";
  }
  function getFriendRequestsTable() {
    return (typeof CONFIG !== "undefined" && CONFIG.supabase && CONFIG.supabase.friendRequestsTable) || "friend_requests";
  }

  function getClient() {
    if (client) return client;
    if (typeof CONFIG === "undefined" || !CONFIG.hasSupabase || !CONFIG.hasSupabase()) return null;
    if (typeof supabase === "undefined" || !supabase.createClient) return null;
    try {
      client = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
      return client;
    } catch (e) {
      console.warn("Supabase init:", e);
      return null;
    }
  }

  function isConfigured() {
    return !!getClient();
  }

  /** Map DB row (snake_case) to app shape (camelCase). */
  function toEvent(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      title: row.title,
      level: row.level || "",
      levelPrimary: !!row.level_primary,
      date: row.date,
      venue: row.venue,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      distance: row.distance,
      format: row.format,
      joined: row.joined,
      joinedHighlight: !!row.joined_highlight,
      image: row.image,
      weather: row.weather,
      weatherIcon: row.weather_icon,
      weatherActive: !!row.weather_active,
      hostAvatars: row.host_avatars || [],
      extraCount: row.extra_count || 0,
      cta: row.cta || "View Details",
      ctaPrimary: row.cta_primary !== false,
      opacity: row.opacity != null ? row.opacity : 1,
    };
  }

  function toEventDetail(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      title: row.title,
      level: row.level,
      image: row.image,
      hostName: row.host_name,
      hostSub: row.host_sub,
      hostAvatar: row.host_avatar,
      locationName: row.location_name,
      mapImage: row.map_image,
      date: row.date,
      time: row.time,
      playerCount: row.player_count,
      playerAvatars: row.player_avatars || [],
      description: row.description,
      chatPreview: row.chat_preview || null,
      chatCount: row.chat_count || 0,
    };
  }

  function toCourt(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      name: row.name,
      address: row.address,
      courts: row.courts,
      surface: row.surface,
      lights: !!row.lights,
      distance: row.distance,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      image: row.image,
      amenities: row.amenities,
    };
  }

  function toChat(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      eventId: row.event_id ? String(row.event_id) : null,
      title: row.title,
      avatar: row.avatar,
      lastMessage: row.last_message,
      time: row.time,
      unread: row.unread || 0,
      active: !!row.active,
      read: !!row.read,
    };
  }

  /** Map DB profile row to app shape (camelCase). */
  function toProfile(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      email: row.email,
      phone: row.phone,
      name: row.name || "",
      firstName: row.first_name,
      lastName: row.last_name,
      age: row.age != null ? row.age : null,
      playerType: row.player_type || "Intermediate",
      avatar: row.avatar,
      location: row.location || "",
      city: row.city || "",
      state: row.state || "",
      bio: row.bio || "",
    };
  }

  /**
   * Fetch events list (home feed).
   */
  function getEvents() {
    const c = getClient();
    if (!c) return Promise.resolve(null);
    return c
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getEvents:", error);
          return null;
        }
        return (data || []).map(toEvent);
      });
  }

  /**
   * Create a new event (and event_detail row). Payload: { title, date, time, venue, locationName?, playerCount?, format?, level? }.
   */
  function createEvent(payload) {
    const c = getClient();
    if (!c) return Promise.reject(new Error("Supabase not configured"));
    const title = payload.title || "New Event";
    const date = payload.date || "";
    const time = payload.time || "";
    const venue = payload.venue || "";
    const locationName = payload.locationName || venue;
    const playerCount = String(payload.playerCount != null ? payload.playerCount : 4);
    const format = payload.format || "Doubles";
    const level = payload.level || "Intermediate";
    const joined = "0/" + playerCount + " joined";
    const eventRow = {
      title,
      level,
      level_primary: true,
      date: date + (time ? " " + time : ""),
      venue,
      format,
      joined,
      joined_highlight: false,
      cta: "Join Game",
      cta_primary: true,
      opacity: 1,
    };
    if (payload.createdBy) eventRow.created_by = payload.createdBy;
    return c
      .from("events")
      .insert(eventRow)
      .select("id")
      .single()
      .then(({ data: eventData, error: eventError }) => {
        if (eventError || !eventData) {
          console.warn("Supabase createEvent insert:", eventError);
          throw new Error(eventError ? eventError.message : "Failed to create event");
        }
        const eventId = eventData.id;
        const detailRow = {
          id: eventId,
          title,
          level,
          date,
          time,
          location_name: locationName,
          player_count: playerCount,
          description: "",
          host_name: "",
          host_sub: "",
          host_avatar: "",
          map_image: "",
          player_avatars: [],
          chat_preview: null,
          chat_count: 0,
        };
        return c
          .from("event_details")
          .insert(detailRow)
          .then(({ error: detailError }) => {
            if (detailError) console.warn("Supabase event_details insert:", detailError);
            return eventId;
          })
          .then((eventId) => {
            const creatorAvatar =
              payload.creatorAvatar ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(payload.creatorName ? String(payload.creatorName).charAt(0) : "H") +
                "&background=94e22e&color=1a1a1a&size=128";
            const creatorAttendee = {
              event_id: eventId,
              profile_id: payload.createdBy || null,
              name: payload.creatorName || null,
              avatar: creatorAvatar,
            };
            return c
              .from("event_attendees")
              .insert(creatorAttendee)
              .then(({ error: attError }) => {
                if (attError) console.warn("Supabase createEvent add creator to attendees:", attError);
                return c
                  .from("events")
                  .update({ joined: "1/" + playerCount + " joined" })
                  .eq("id", eventId);
              })
              .then(() => eventId);
          });
      });
  }

  /**
   * Get the event creator's profile (email) for sending join notifications. Returns { email } or null.
   */
  function getEventCreatorProfile(eventId) {
    const c = getClient();
    if (!c || !eventId) return Promise.resolve(null);
    return c
      .from("events")
      .select("created_by")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data: eventRow, error: eventError }) => {
        if (eventError || !eventRow || !eventRow.created_by) return null;
        return c.from(getProfilesTable()).select("email").eq("id", eventRow.created_by).maybeSingle();
      })
      .then((result) => {
        if (!result || result.error || !result.data || !result.data.email) return null;
        return { email: result.data.email };
      })
      .catch(() => null);
  }

  /**
   * Fetch single event details by id. Players list is built from event_attendees so joined users always show.
   */
  function getEventDetail(eventId) {
    const c = getClient();
    if (!c) return Promise.resolve(null);
    return c
      .from("event_details")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data: detailRow, error }) => {
        if (error) {
          console.warn("Supabase getEventDetail:", error);
          return null;
        }
        if (!detailRow) return null;
        return c
          .from("event_attendees")
          .select("name, avatar")
          .eq("event_id", eventId)
          .order("joined_at", { ascending: true })
          .then(({ data: attendees, error: attError }) => {
            if (attError) console.warn("Supabase getEventDetail attendees:", attError);
            const base = toEventDetail(detailRow);
            const avatars = (attendees || []).map((a) => {
              if (a.avatar) return a.avatar;
              const initial = (a.name && String(a.name).charAt(0)) || "P";
              return (
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(initial) +
                "&background=94e22e&color=1a1a1a&size=128"
              );
            });
            base.playerAvatars = avatars;
            return base;
          });
      });
  }

  /**
   * Fetch courts list.
   */
  function getCourts() {
    const c = getClient();
    if (!c) return Promise.resolve(null);
    return c
      .from("courts")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getCourts:", error);
          return null;
        }
        return (data || []).map(toCourt);
      });
  }

  /**
   * Join an event: record attendee and update joined display string.
   * Uses local user profile (name/avatar) only; profile_id is optional.
   */
  function joinEvent(eventId, user) {
    const c = getClient();
    if (!c) return Promise.reject(new Error("Supabase not configured"));
    const safeEventId = eventId;
    const attendee = {
      event_id: safeEventId,
      profile_id: null,
      name: user && user.name ? user.name : null,
      avatar: user && user.avatar ? user.avatar : null,
    };

    // Insert attendee, then recompute joined string based on attendee count and configured player_count.
    return c
      .from("event_attendees")
      .insert(attendee)
      .then(({ error: insertError }) => {
        if (insertError) {
          console.warn("Supabase joinEvent insert attendee:", insertError);
          throw new Error(insertError.message || "Failed to join event");
        }
        // Get capacity from event_details and attendee count from event_attendees.
        return Promise.all([
          c.from("event_details").select("player_count, player_avatars").eq("id", safeEventId).maybeSingle(),
          c.from("event_attendees").select("id", { count: "exact", head: true }).eq("event_id", safeEventId),
        ]);
      })
      .then(([detailResult, countResult]) => {
        const detailError = detailResult.error;
        const detail = detailResult.data;
        const countError = countResult.error;
        const joinedCount = typeof countResult.count === "number" ? countResult.count : 1;

        if (detailError) {
          console.warn("Supabase joinEvent fetch details:", detailError);
        }
        if (countError) {
          console.warn("Supabase joinEvent count attendees:", countError);
        }

        const capacityStr = detail && detail.player_count != null ? String(detail.player_count) : "4";
        const joinedStr = joinedCount + "/" + capacityStr + " joined";

        const updatedAvatars = detail && Array.isArray(detail.player_avatars) ? detail.player_avatars.slice(0, 5) : [];
        const joinerAvatar =
          user && user.avatar
            ? user.avatar
            : "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(user && user.name ? String(user.name).charAt(0) : "P") +
              "&background=94e22e&color=1a1a1a&size=128";
        updatedAvatars.unshift(joinerAvatar);

        // Update events.joined for home card and optionally event_details avatars.
        const updates = [];
        updates.push(c.from("events").update({ joined: joinedStr }).eq("id", safeEventId));
        updates.push(c.from("event_details").update({ player_avatars: updatedAvatars }).eq("id", safeEventId));
        return Promise.all(updates).then(() => ({ joined: joinedStr, count: joinedCount }));
      });
  }

  /**
   * Fetch single court by id.
   */
  function getCourt(courtId) {
    const c = getClient();
    if (!c) return Promise.resolve(null);
    return c
      .from("courts")
      .select("*")
      .eq("id", courtId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getCourt:", error);
          return null;
        }
        return data ? toCourt(data) : null;
      });
  }

  /**
   * Fetch chats list (for Messages).
   */
  function getChats() {
    const c = getClient();
    if (!c) return Promise.resolve(null);
    return c
      .from("chats")
      .select("*")
      .order("time", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getChats:", error);
          return null;
        }
        return (data || []).map(toChat);
      });
  }

  /**
   * Get profile by email (case-insensitive).
   * Uses limit(1) so duplicate emails never cause PGRST116; one row per email enforced by DB.
   */
  function getProfileByEmail(email) {
    const c = getClient();
    if (!c || !email) return Promise.resolve(null);
    const raw = String(email).trim();
    if (!raw) return Promise.resolve(null);
    const escaped = raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    return c
      .from(getProfilesTable())
      .select("*")
      .ilike("email", escaped)
      .order("created_at", { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getProfileByEmail:", error);
          return Promise.reject(new Error(error.message || "Supabase error"));
        }
        const row = data && data[0];
        return row ? toProfile(row) : null;
      });
  }

  /** Map a profile row to the player-card shape used by the app (find people / Players list). */
  function rowToPlayerCard(row) {
    if (!row) return null;
    const loc = row.location || "";
    const city = row.city || (loc.split(",")[0] || "").trim() || loc;
    return {
      id: String(row.id),
      name: row.name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Player",
      age: row.age,
      city: city,
      state: row.state || (loc.split(",")[1] || "").trim(),
      level: row.player_type || "Intermediate",
      levelPrimary: true,
      tagline: row.bio || "",
      avatar:
        row.avatar ||
        "https://ui-avatars.com/api/?name=" +
          encodeURIComponent((row.name || "P").charAt(0)) +
          "&background=94e22e&color=1a1a1a&size=128",
      online: false,
    };
  }

  /**
   * Fetch all profiles (for Players list). Orders by name.
   */
  function getProfiles() {
    const c = getClient();
    if (!c) return Promise.resolve([]);
    return c
      .from(getProfilesTable())
      .select("id, name, first_name, last_name, age, player_type, avatar, location, email, city, state, bio")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getProfiles:", error);
          return [];
        }
        return (data || []).map(rowToPlayerCard);
      });
  }

  /**
   * Find people (profiles) in Supabase with optional filters.
   * Used for Players list: auth is Firebase; accounts are in Supabase; this queries Supabase only.
   * @param {Object} filters - { excludeProfileId?: string, city?: string, playerType?: string, searchText?: string }
   * @returns {Promise<Array>} List of player-card shaped objects.
   */
  function findPeople(filters) {
    const c = getClient();
    if (!c) return Promise.resolve([]);
    const excludeId = filters && filters.excludeProfileId ? String(filters.excludeProfileId).trim() : "";
    const city = filters && filters.city ? String(filters.city).trim() : "";
    const playerType = filters && filters.playerType ? String(filters.playerType).trim() : "";
    const searchText = filters && filters.searchText ? String(filters.searchText).trim() : "";

    let q = c
      .from(getProfilesTable())
      .select("id, name, first_name, last_name, age, player_type, avatar, location, email, city, state, bio")
      .order("name");

    if (city) q = q.ilike("city", "%" + city + "%");
    if (playerType) q = q.eq("player_type", playerType);

    return q.then(({ data, error }) => {
      if (error) {
        console.warn("Supabase findPeople:", error);
        return [];
      }
      let list = (data || []).map(rowToPlayerCard);
      if (excludeId) list = list.filter(function (p) { return String(p.id) !== excludeId; });
      if (searchText) {
        const term = searchText.toLowerCase();
        list = list.filter(function (p) {
          const name = (p.name || "").toLowerCase();
          const cityStr = (p.city || "").toLowerCase();
          const stateStr = (p.state || "").toLowerCase();
          const bio = (p.tagline || "").toLowerCase();
          return name.indexOf(term) !== -1 || cityStr.indexOf(term) !== -1 || stateStr.indexOf(term) !== -1 || bio.indexOf(term) !== -1;
        });
      }
      return list;
    });
  }

  /**
   * Get profile by id (for viewing another user's profile).
   */
  function getProfileById(profileId) {
    const c = getClient();
    if (!c || !profileId) return Promise.resolve(null);
    return c
      .from(getProfilesTable())
      .select("*")
      .eq("id", profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getProfileById:", error);
          return null;
        }
        return data ? toProfile(data) : null;
      });
  }

  /**
   * Get or create profile by email; returns profile with id (for friend requests).
   */
  function getOrCreateProfileByEmail(email, defaults) {
    const c = getClient();
    if (!c || !email) return Promise.resolve(null);
    const em = String(email).trim().toLowerCase();
    return getProfileByEmail(em).then((existing) => {
      if (existing) return existing;
      const name =
        defaults && (defaults.firstName || defaults.lastName)
          ? [defaults.firstName, defaults.lastName].filter(Boolean).join(" ")
          : (defaults && defaults.name) || em.split("@")[0] || "User";
      const row = {
        email: em,
        name: name,
        first_name: defaults && defaults.firstName,
        last_name: defaults && defaults.lastName,
        age: defaults && defaults.age,
        player_type: (defaults && defaults.playerType) || "Intermediate",
        avatar: defaults && defaults.avatar,
        location: (defaults && defaults.location) || "Austin, TX",
        phone: defaults && defaults.phone,
        city: defaults && defaults.city,
        state: defaults && defaults.state,
        bio: defaults && defaults.bio,
      };
      return c
        .from(getProfilesTable())
        .insert(row)
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            console.warn("Supabase getOrCreateProfileByEmail insert:", error);
            if (error && (error.code === "PGRST204" || (error.message && error.message.indexOf("Could not find") !== -1))) {
              console.warn("Tip: If your DB has app_profiles (not profiles), set in config.local.js: SUPABASE_PROFILES_TABLE: \"app_profiles\", SUPABASE_FRIEND_REQUESTS_TABLE: \"app_friend_requests\"");
            }
            return Promise.reject(new Error(error ? error.message : "Insert failed"));
          }
          return getProfileByEmail(em);
        });
    });
  }

  /**
   * Update profile by id. Payload: { id, firstName?, lastName?, age?, location?, city?, state?, bio?, playerType?, avatar?, name? }.
   */
  function updateProfile(payload) {
    const c = getClient();
    if (!c || !payload || !payload.id)
      return Promise.reject(new Error("Supabase not configured or missing profile id"));
    const updates = {};
    if (payload.firstName !== undefined) updates.first_name = payload.firstName;
    if (payload.lastName !== undefined) updates.last_name = payload.lastName;
    if (payload.age !== undefined)
      updates.age = payload.age == null || payload.age === "" ? null : parseInt(payload.age, 10);
    if (payload.location !== undefined) updates.location = payload.location;
    if (payload.city !== undefined) updates.city = payload.city;
    if (payload.state !== undefined) updates.state = payload.state;
    if (payload.bio !== undefined) updates.bio = payload.bio;
    if (payload.playerType !== undefined) updates.player_type = payload.playerType;
    if (payload.avatar !== undefined) updates.avatar = payload.avatar;
    if (payload.name !== undefined) updates.name = payload.name;
    return c
      .from(getProfilesTable())
      .update(updates)
      .eq("id", payload.id)
      .select()
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase updateProfile:", error);
          throw new Error(error.message || "Failed to update profile");
        }
        return data ? toProfile(data) : null;
      });
  }

  /**
   * Fetch pending friend requests received by profileId (with sender info).
   */
  function getFriendRequestsReceived(profileId) {
    const c = getClient();
    if (!c || !profileId) return Promise.resolve([]);
    return c
      .from(getFriendRequestsTable())
      .select("id, from_profile_id, created_at, from_profile:from_profile_id(name, email, avatar)")
      .eq("to_profile_id", profileId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase getFriendRequestsReceived:", error);
          return [];
        }
        const fromData = (r) => {
          const from = r.from_profile;
          return (Array.isArray(from) ? from[0] : from) || {};
        };
        return (data || []).map((r) => ({
          id: r.id,
          fromProfileId: r.from_profile_id,
          createdAt: r.created_at,
          fromName: fromData(r).name || "Someone",
          fromEmail: fromData(r).email,
          fromAvatar: fromData(r).avatar,
        }));
      });
  }

  /**
   * Send a friend request from one profile to another.
   */
  function sendFriendRequest(fromProfileId, toProfileId) {
    const c = getClient();
    if (!c || !fromProfileId || !toProfileId) return Promise.reject(new Error("Missing client or profile ids"));
    if (fromProfileId === toProfileId) return Promise.reject(new Error("Cannot send request to yourself"));
    return c
      .from(getFriendRequestsTable())
      .upsert(
        { from_profile_id: fromProfileId, to_profile_id: toProfileId, status: "pending" },
        { onConflict: "from_profile_id,to_profile_id" }
      )
      .then(({ error }) => {
        if (error) throw new Error(error.message || "Failed to send friend request");
      });
  }

  /**
   * Accept a friend request (update status to accepted).
   */
  function acceptFriendRequest(requestId) {
    const c = getClient();
    if (!c || !requestId) return Promise.reject(new Error("Missing client or request id"));
    return c
      .from(getFriendRequestsTable())
      .update({ status: "accepted" })
      .eq("id", requestId)
      .then(({ error }) => {
        if (error) throw new Error(error.message || "Failed to accept request");
      });
  }

  /**
   * Decline a friend request (update status to rejected).
   */
  function declineFriendRequest(requestId) {
    const c = getClient();
    if (!c || !requestId) return Promise.reject(new Error("Missing client or request id"));
    return c
      .from(getFriendRequestsTable())
      .update({ status: "rejected" })
      .eq("id", requestId)
      .then(({ error }) => {
        if (error) throw new Error(error.message || "Failed to decline request");
      });
  }

  const AVATARS_BUCKET = "avatars";

  /**
   * Upload a profile photo (resized blob) to Supabase Storage. Returns the public URL.
   * Caller should resize/compress the image before passing (e.g. max 256x256, JPEG 0.8).
   * Requires bucket "avatars" to exist with public read and anon insert (see migration 002).
   */
  function uploadProfilePhoto(profileId, blob) {
    const c = getClient();
    if (!c || !profileId || !blob) return Promise.reject(new Error("Supabase not configured or missing profileId/blob"));
    const path = profileId + ".jpg";
    return c.storage
      .from(AVATARS_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true })
      .then(({ data, error }) => {
        if (error) {
          console.warn("Supabase uploadProfilePhoto:", error);
          throw new Error(error.message || "Failed to upload photo");
        }
        const { data: urlData } = c.storage.from(AVATARS_BUCKET).getPublicUrl(data.path);
        return urlData.publicUrl;
      });
  }

  return {
    isConfigured,
    getClient,
    getEvents,
    getEventDetail,
    getEventCreatorProfile,
    joinEvent,
    createEvent,
    getCourts,
    getCourt,
    getChats,
    getProfileByEmail,
    getProfileById,
    getProfiles,
    findPeople,
    getOrCreateProfileByEmail,
    updateProfile,
    getFriendRequestsReceived,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    uploadProfilePhoto,
  };
})();
