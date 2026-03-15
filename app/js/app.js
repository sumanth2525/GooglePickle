(function () {
  const main = document.getElementById("main");
  const bottomNav = document.getElementById("bottom-nav");
  let lastUserPosition = null;
  let lastCourtsList = [];
  /** In-memory profile from Supabase (no profile data in localStorage). */
  let currentUserProfile = null;
  /** Prevents repeated "Loading profile..." when load fails or is slow. Reset on logout. */
  let profileLoadAttempted = false;
  /** Last error from profile load (e.g. "Invalid API key") so the UI can show a hint. */
  let lastProfileLoadError = null;

  function escapeHtml(str) {
    if (str == null) return "";
    const s = String(str);
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * Resize and compress an image file for profile avatar. Returns a JPEG Blob (max 256x256, quality 0.82).
   * Keeps file size small for faster load and less memory.
   */
  function resizeImageForAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Please choose an image file (JPEG, PNG, or WebP)."));
        return;
      }
      const maxSize = 256;
      const quality = 0.82;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else reject(new Error("Failed to compress image"));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load image"));
      };
      img.src = url;
    });
  }

  function getRoute() {
    const hash = (window.location.hash || "#home").slice(1);
    const [page, id] = hash.split("/");
    return { page: page || "home", id: id || null };
  }

  function setActiveNav(page) {
    document.querySelectorAll(".nav-link").forEach((a) => {
      const isActive = a.getAttribute("href") === `#${page}` || a.dataset.nav === page;
      a.classList.toggle("text-primary", isActive);
      a.classList.toggle("text-slate-400", !isActive);
      a.classList.toggle("dark:text-slate-500", !isActive);
      const icon = a.querySelector(".material-symbols-outlined");
      if (icon) icon.classList.toggle("active-icon", isActive);
    });
  }

  function showNav(show) {
    bottomNav.classList.toggle("hidden", !show);
  }

  function isLoggedIn() {
    return typeof AuthService !== "undefined"
      ? AuthService.isLoggedIn()
      : localStorage.getItem("pickleball_logged_in") === "true";
  }

  function updateChatNavVisibility() {
    const chatLink = document.querySelector('#bottom-nav a[data-nav="chat"]');
    // Always show chat icon; access is still locked by route guard in render().
    if (chatLink) chatLink.classList.remove("hidden");
  }

  function handleNotificationsClick() {
    if (
      typeof CONFIG !== "undefined" &&
      CONFIG.hasOneSignal &&
      CONFIG.hasOneSignal() &&
      typeof OneSignalService !== "undefined" &&
      OneSignalService.isConfigured() &&
      OneSignalService.isSupported()
    ) {
      OneSignalService.requestPermissionAndSubscribe().then((r) => {
        if (r.success) alert("Notifications enabled! You'll get alerts for events and messages.");
        else if (r.permission === "denied") alert("Notifications blocked. Enable them in your browser settings.");
        else alert(r.error || "Could not enable notifications.");
      });
      return;
    }
    if (
      typeof NotificationService !== "undefined" &&
      NotificationService.isConfigured() &&
      NotificationService.isSupported()
    ) {
      NotificationService.requestPermissionAndSubscribe().then((r) => {
        if (r.success) alert("Notifications enabled! You'll get alerts for events and messages.");
        else if (r.permission === "denied") alert("Notifications blocked. Enable them in your browser settings.");
        else alert(r.error || "Could not enable notifications.");
      });
      return;
    }
    if ("Notification" in window) {
      Notification.requestPermission().then((p) => {
        if (p === "granted") alert("Notifications enabled! You'll get alerts for events and messages.");
        else if (p === "denied") alert("Notifications blocked. Enable them in your browser settings.");
      });
    } else {
      alert("Notifications are not supported in this browser.");
    }
  }

  function getLoggedInUser() {
    const def = MOCK.user || {};
    const firebaseUser =
      typeof FirebaseAuthService !== "undefined" &&
      FirebaseAuthService.getCurrentUser &&
      FirebaseAuthService.getCurrentUser();
    const emailFromAuth = firebaseUser && firebaseUser.email ? firebaseUser.email : localStorage.getItem("pickleball_user_email") || "";
    const nameFromAuth = firebaseUser && (firebaseUser.displayName || firebaseUser.email) ? firebaseUser.displayName || firebaseUser.email : localStorage.getItem("pickleball_user_name") || def.name;
    const avatarFromAuth = firebaseUser && firebaseUser.photoURL ? firebaseUser.photoURL : localStorage.getItem("pickleball_user_avatar") || def.avatar;
    const p = currentUserProfile;
    const displayName = p && (p.firstName || p.lastName || p.name) ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name : nameFromAuth;
    return {
      name: displayName || nameFromAuth,
      firstName: (p && p.firstName) || "",
      lastName: (p && p.lastName) || "",
      age: p && p.age != null ? p.age : null,
      email: (p && p.email) || emailFromAuth,
      avatar: (p && p.avatar) || avatarFromAuth,
      location: (p && p.location) || "",
      city: (p && p.city) || "",
      state: (p && p.state) || "",
      bio: (p && p.bio) || "",
      phone: (p && p.phone) || null,
      playerType: (p && p.playerType) || "Intermediate",
      profileId: (p && p.id) ? String(p.id) : null,
    };
  }

  /**
   * Load current user's profile from Supabase into memory (no localStorage for profile data).
   * Call on init and when auth state changes. Returns promise that resolves to the profile or null.
   */
  function loadCurrentUserProfileFromSupabase() {
    const rawEmail =
      (typeof FirebaseAuthService !== "undefined" && FirebaseAuthService.getCurrentUser && FirebaseAuthService.getCurrentUser() && FirebaseAuthService.getCurrentUser().email) ||
      localStorage.getItem("pickleball_user_email") ||
      "";
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || (typeof SupabaseService === "undefined" || !SupabaseService.isConfigured() || !SupabaseService.getProfileByEmail)) {
      currentUserProfile = null;
      return Promise.resolve(null);
    }
    const u = getLoggedInUser();
    const PROFILE_LOAD_TIMEOUT_MS = 8000;
    const loadPromise = SupabaseService.getProfileByEmail(email)
      .then(function (profile) {
        if (profile) {
          currentUserProfile = profile;
          lastProfileLoadError = null;
          return profile;
        }
        return SupabaseService.getOrCreateProfileByEmail(email, {
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar,
          location: u.location,
          city: u.city,
          state: u.state,
          bio: u.bio,
          playerType: u.playerType,
        }).then(function (created) {
          currentUserProfile = created;
          if (created) lastProfileLoadError = null;
          return created;
        });
      })
      .catch(function (err) {
        const msg = err && err.message ? err.message : String(err);
        console.warn("loadCurrentUserProfileFromSupabase:", msg);
        lastProfileLoadError = msg;
        currentUserProfile = null;
        return null;
      });
    const timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("timeout")); }, PROFILE_LOAD_TIMEOUT_MS);
    });
    return Promise.race([loadPromise, timeoutPromise]).catch(function (err) {
      if (err && err.message === "timeout") {
        console.warn("Profile load timed out after " + PROFILE_LOAD_TIMEOUT_MS / 1000 + "s");
      }
      if (err && err.message) lastProfileLoadError = err.message;
      currentUserProfile = null;
      return null;
    });
  }

  function saveUserProfile(data) {
    if (!data) return;
    if (currentUserProfile) {
      if (data.profileId != null) currentUserProfile.id = data.profileId;
      if (data.name != null) currentUserProfile.name = data.name;
      if (data.firstName != null) currentUserProfile.firstName = data.firstName;
      if (data.lastName != null) currentUserProfile.lastName = data.lastName;
      if (data.age !== undefined) currentUserProfile.age = data.age;
      if (data.email != null) currentUserProfile.email = data.email;
      if (data.location != null) currentUserProfile.location = data.location;
      if (data.city != null) currentUserProfile.city = data.city;
      if (data.state != null) currentUserProfile.state = data.state;
      if (data.bio != null) currentUserProfile.bio = data.bio;
      if (data.avatar != null) currentUserProfile.avatar = data.avatar;
      if (data.phone != null) currentUserProfile.phone = data.phone;
      if (data.playerType != null) currentUserProfile.playerType = data.playerType;
    } else if (data.profileId != null || data.email != null) {
      currentUserProfile = {
        id: data.profileId,
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        age: data.age,
        email: data.email,
        location: data.location,
        city: data.city,
        state: data.state,
        bio: data.bio,
        avatar: data.avatar,
        phone: data.phone,
        playerType: data.playerType,
      };
    }
  }

  /**
   * Sync current user (from Firebase Auth + localStorage) to Supabase profiles.
   * Required for Players list: auth is Firebase, player data is Supabase; both must be configured.
   * Returns a promise so callers can wait for profile create/update.
   */
  function syncLoggedInUserToSupabase() {
    if (!isLoggedIn()) return Promise.resolve();
    const u = getLoggedInUser();
    if (typeof OneSignalService !== "undefined" && OneSignalService.setExternalUserId && OneSignalService.isConfigured()) {
      OneSignalService.setExternalUserId(u.email || u.profileId || "").catch(function () {});
    }
    if (
      typeof SupabaseService !== "undefined" &&
      SupabaseService.isConfigured() &&
      SupabaseService.getOrCreateProfileByEmail &&
      u.email
    ) {
      return SupabaseService.getOrCreateProfileByEmail(u.email, {
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.avatar,
        location: u.location,
        city: u.city,
        state: u.state,
        bio: u.bio,
        playerType: u.playerType,
      })
        .then(function (profile) {
          if (profile) {
            currentUserProfile = profile;
          }
        })
        .catch(function (err) {
          console.warn("Supabase profile sync failed (Players list needs Supabase):", err && err.message ? err.message : err);
        });
    }
    return Promise.resolve();
  }

  function renderHome() {
    const { id: homeTab } = getRoute();
    const isTournaments = homeTab === "tournaments";
    const user = getLoggedInUser();
    setActiveNav("home");
    showNav(true);

    function applyEvents(eventsList) {
      let events = (eventsList || []).slice();
      const defaultLabel =
        typeof CONFIG !== "undefined" &&
        CONFIG.geolocation &&
        CONFIG.geolocation.defaultCenter &&
        CONFIG.geolocation.defaultCenter.label
          ? CONFIG.geolocation.defaultCenter.label
          : user.location || "Select location";
      const locEl = document.getElementById("user-location-label");
      if (locEl)
        locEl.textContent = lastUserPosition
          ? lastUserPosition.label || user.location || "Current location"
          : defaultLabel;
      if (
        lastUserPosition &&
        lastUserPosition.lat != null &&
        lastUserPosition.lng != null &&
        typeof GeolocationService !== "undefined"
      ) {
        GeolocationService.sortEventsByDistance(events, lastUserPosition.lat, lastUserPosition.lng);
      }
      const cardsEl = document.getElementById("home-event-cards");
      if (cardsEl) {
        cardsEl.innerHTML = buildEventCardsHtml(events, user);
        wireEventCardClicks();
      }
    }

    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
      SupabaseService.getEvents()
        .then((data) => {
          const list = data && data.length > 0 ? data : (MOCK.events || []).slice();
          applyEvents(list);
        })
        .catch(() => {
          applyEvents(MOCK.events || []);
        });
    } else {
      applyEvents(MOCK.events || []);
    }

    function buildEventCardsHtml(eventsList, _userData) {
      return (eventsList || [])
        .map((e) => {
          const eventId = e.id != null ? String(e.id) : "";
          const distDisplay =
            typeof GeolocationService !== "undefined" && e._distanceMiles != null
              ? GeolocationService.formatDistance(e._distanceMiles)
              : e.distance || "";
          return `
    <div class="event-card group bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer ${e.opacity < 1 ? "opacity-90" : ""}" data-event-id="${escapeHtml(eventId)}" role="button" tabindex="0">
      <div class="relative h-48 w-full">
        <img class="w-full h-full object-cover" alt="" src="${escapeHtml(e.image || "")}"/>
        ${
          e.weather
            ? `<div class="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <span class="material-symbols-outlined ${e.weatherActive ? "text-amber-500 active-icon" : "text-blue-400"} text-sm">${escapeHtml(e.weatherIcon || "")}</span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(e.weather)}</span>
        </div>`
            : ""
        }
        ${
          e.hostAvatars && e.hostAvatars.length
            ? `<div class="absolute bottom-3 right-3">
          <div class="flex -space-x-2">
            ${e.hostAvatars.map((url) => `<img class="size-8 rounded-full border-2 border-white dark:border-slate-800 object-cover" alt="" src="${escapeHtml(url)}"/>`).join("")}
            ${e.extraCount ? `<div class="size-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">+${escapeHtml(e.extraCount)}</div>` : ""}
          </div>
        </div>`
            : ""
        }
      </div>
      <div class="p-4">
        <div class="flex justify-between items-start mb-1">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">${escapeHtml(e.title)}</h3>
          <span class="${e.levelPrimary ? "bg-primary/20 text-slate-800 dark:text-primary" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">${escapeHtml(e.level)}</span>
        </div>
        <div class="space-y-1.5 mb-4">
          <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <span class="material-symbols-outlined text-base">event</span>
            <span>${escapeHtml(e.date)} • ${escapeHtml(e.venue)}</span>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-1 text-slate-400 dark:text-slate-500 text-xs">
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">near_me</span><span>${escapeHtml(distDisplay)}</span></div>
            <div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">sports_tennis</span><span>${escapeHtml(e.format)}</span></div>
            <div class="flex items-center gap-1 ${e.joinedHighlight ? "text-primary font-semibold" : ""}"><span class="material-symbols-outlined text-sm">group</span><span>${escapeHtml(e.joined)}</span></div>
          </div>
        </div>
        <a href="#event/${escapeHtml(eventId)}" class="event-card-cta block w-full ${e.ctaPrimary ? "bg-primary hover:bg-primary/90 text-slate-900" : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"} font-bold py-3 rounded-xl transition-colors shadow-lg shadow-primary/20 text-center">${escapeHtml(e.cta)}</a>
      </div>
    </div>`;
        })
        .join("");
    }

    function wireEventCardClicks() {
      const container = document.getElementById("home-event-cards");
      if (!container) return;
      container.querySelectorAll(".event-card[data-event-id]").forEach((card) => {
        const id = card.getAttribute("data-event-id");
        if (!id) return;
        const go = () => {
          window.location.hash = "#event/" + id;
        };
        card.addEventListener("click", (e) => {
          if (!e.target.closest("a")) {
            e.preventDefault();
            go();
          }
        });
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      });
    }

    const defaultLocationLabel =
      typeof CONFIG !== "undefined" &&
      CONFIG.geolocation &&
      CONFIG.geolocation.defaultCenter &&
      CONFIG.geolocation.defaultCenter.label
        ? CONFIG.geolocation.defaultCenter.label
        : user.location || "Select location";
    const initialLocationLabel = lastUserPosition
      ? lastUserPosition.label || user.location || "Current location"
      : defaultLocationLabel;
    const eventCards = buildEventCardsHtml(MOCK.events || [], user);
    const tournaments = MOCK.tournaments || [];
    const tournamentCardsHtml = tournaments
      .map(function (t) {
        return (
          '<div class="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700"><div class="relative h-40 w-full"><img class="w-full h-full object-cover" alt="" src="' +
          (t.image || "") +
          '"/><div class="absolute bottom-2 left-2 right-2 flex justify-between items-end"><span class="bg-primary/90 text-slate-900 px-2 py-1 rounded text-xs font-bold">' +
          (t.level || "Open") +
          '</span><span class="bg-black/60 text-white px-2 py-1 rounded text-xs">' +
          (t.registered || 0) +
          "/" +
          (t.maxTeams || 0) +
          ' teams</span></div></div><div class="p-4"><h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">' +
          (t.title || "") +
          '</h3><p class="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-base">event</span>' +
          (t.date || "") +
          " • " +
          (t.venue || "") +
          '</p><p class="text-slate-400 dark:text-slate-500 text-xs mt-1">' +
          (t.prize || "") +
          '</p><button type="button" class="mt-3 w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-2.5 rounded-xl text-sm">Register</button></div></div>'
        );
      })
      .join("");

    main.innerHTML = `
    <header class="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md pt-6 px-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/30">
            <img class="w-full h-full object-cover" alt="" src="${user.avatar}"/>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Welcome back</p>
            <h2 class="text-lg font-bold leading-none text-slate-900 dark:text-white">${user.name}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Find games & connect with players</p>
          </div>
        </div>
        <button type="button" id="notifications-btn" class="size-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700">
          <span class="material-symbols-outlined text-slate-600 dark:text-slate-300">notifications</span>
        </button>
      </div>
      <div class="flex gap-3 mb-4">
        <button type="button" id="location-btn" class="flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-slate-800 dark:text-slate-200">
          <span class="material-symbols-outlined text-sm">location_on</span>
          <span id="user-location-label" class="text-sm font-semibold">${initialLocationLabel}</span>
          <span class="material-symbols-outlined text-sm">expand_more</span>
        </button>
      </div>
      <div class="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <a href="#home" id="home-tab-events" class="relative flex flex-col items-center justify-center pb-3 text-sm font-bold ${!isTournaments ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:text-slate-500"}">
          <span>Events</span>
          ${!isTournaments ? '<div class="absolute bottom-0 w-full h-[3px] bg-primary rounded-t-full"></div>' : ""}
        </a>
        <a href="#home/tournaments" id="home-tab-tournaments" class="relative flex flex-col items-center justify-center pb-3 text-sm font-bold ${isTournaments ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:text-slate-500"}">
          <span>Tournaments</span>
          ${isTournaments ? '<div class="absolute bottom-0 w-full h-[3px] bg-primary rounded-t-full"></div>' : ""}
        </a>
        <a href="#courts" class="flex flex-col items-center justify-center pb-3 text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500">Courts</a>
      </div>
    </header>
    <div id="home-event-cards" class="flex-1 p-4 space-y-4 pb-24 ${isTournaments ? "hidden" : ""}">
      ${eventCards}
    </div>
    <div id="home-tournament-cards" class="flex-1 p-4 space-y-4 pb-24 ${isTournaments ? "" : "hidden"}">
      ${tournamentCardsHtml || '<p class="text-slate-500 dark:text-slate-400 text-center py-8">No tournaments yet. Courts list coming soon.</p>'}
    </div>`;
    main.querySelector("#notifications-btn").addEventListener("click", handleNotificationsClick);
    wireEventCardClicks();
    main.querySelector("#location-btn").addEventListener("click", () => {
      if (typeof GeolocationService !== "undefined") {
        const locEl = document.getElementById("user-location-label");
        if (locEl) locEl.textContent = "Getting location…";
        const gotEvents = (eventsList) => {
          GeolocationService.getCurrentPosition()
            .then((pos) => {
              lastUserPosition = pos;
              const label =
                pos.label || user.location || (pos.lat != null && pos.lng != null ? "Current location" : "");
              const locEl2 = document.getElementById("user-location-label");
              if (locEl2) locEl2.textContent = label;
              const list = (eventsList || []).slice();
              if (pos.lat != null && pos.lng != null) GeolocationService.sortEventsByDistance(list, pos.lat, pos.lng);
              const cardsEl = document.getElementById("home-event-cards");
              if (cardsEl) {
                cardsEl.innerHTML = buildEventCardsHtml(list, user);
                wireEventCardClicks();
              }
            })
            .catch(() => {
              if (locEl)
                locEl.textContent = lastUserPosition
                  ? lastUserPosition.label || user.location
                  : user.location || "Select location";
            });
        };
        if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
          SupabaseService.getEvents()
            .then((data) => gotEvents(data && data.length > 0 ? data : MOCK.events))
            .catch(() => gotEvents(MOCK.events));
        } else {
          gotEvents(MOCK.events);
        }
      } else {
        alert("Location not available.");
      }
    });
  }

  function renderOtherProfile(playerId) {
    setActiveNav("players");
    showNav(true);
    const player = (MOCK.players && MOCK.players.find((p) => String(p.id) === String(playerId))) || null;
    const esc = (s) =>
      s == null
        ? ""
        : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    function renderWithPlayer(p) {
      if (!p) {
        main.innerHTML = `<header class="p-4"><a href="#players" class="text-primary font-bold">← Back to Players</a></header><p class="p-4">Player not found.</p>`;
        return;
      }
      main.innerHTML = `
      <header class="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 pt-6 pb-4 flex items-center gap-3">
        <a href="#players" class="size-10 flex items-center justify-center rounded-full bg-slate-200/50 dark:bg-slate-800/50">
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">arrow_back</span>
        </a>
        <h2 class="text-lg font-bold flex-1">Profile</h2>
      </header>
      <div class="p-4 space-y-4">
        <div class="flex flex-col items-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="w-24 h-24 rounded-full bg-cover bg-center border-4 border-primary shrink-0 mb-4" style="background-image:url('${esc(p.avatar)}')"></div>
          <h1 class="text-xl font-bold">${esc(p.name)}${p.age != null ? ", " + esc(p.age) : ""}</h1>
          ${p.city ? `<p class="text-slate-500 dark:text-slate-400 text-sm">${esc(p.city)}</p>` : ""}
          ${p.level ? `<span class="mt-2 px-3 py-1 bg-primary/20 text-slate-900 dark:text-primary text-xs font-bold rounded-full uppercase">${esc(p.level)}</span>` : ""}
          ${p.tagline ? `<p class="mt-3 text-sm text-slate-600 dark:text-slate-400 italic text-center">"${esc(p.tagline)}"</p>` : ""}
        </div>
        <button type="button" class="profile-message-btn block w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-4 rounded-xl text-center flex items-center justify-center gap-2 border-0 cursor-pointer" data-profile-id="${esc(p.id)}">
          <span class="material-symbols-outlined">chat_bubble</span>
          Message
        </button>
        <a href="#players" class="block w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-bold py-3 rounded-xl text-center">Back to Players</a>
      </div>`;
      const msgBtn = main.querySelector(".profile-message-btn");
      if (msgBtn && p && p.id)
        msgBtn.addEventListener("click", () => {
          window.location.hash = "#chat/dm-" + String(p.id);
        });
    }

    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && SupabaseService.getProfileById) {
      SupabaseService.getProfileById(playerId)
        .then((profile) => {
          if (profile) {
            const p = {
              id: profile.id,
              name: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" "),
              age: profile.age,
              city: profile.city || profile.location,
              level: profile.playerType,
              tagline: profile.bio || "",
              avatar: profile.avatar,
            };
            renderWithPlayer(p);
          } else renderWithPlayer(player);
        })
        .catch(() => renderWithPlayer(player));
    } else {
      renderWithPlayer(player);
    }
  }

  function renderProfile() {
    const loggedIn = isLoggedIn();
    setActiveNav("profile");
    showNav(true);
    updateChatNavVisibility();

    if (loggedIn) {
      const shouldLoadProfile =
        !currentUserProfile &&
        !profileLoadAttempted &&
        typeof SupabaseService !== "undefined" &&
        SupabaseService.isConfigured() &&
        typeof loadCurrentUserProfileFromSupabase === "function" &&
        (FirebaseAuthService && FirebaseAuthService.getCurrentUser && FirebaseAuthService.getCurrentUser()
          ? FirebaseAuthService.getCurrentUser().email
          : localStorage.getItem("pickleball_user_email"));
      if (shouldLoadProfile) {
        profileLoadAttempted = true;
        main.innerHTML =
          "<header class=\"sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 pt-6 pb-2\"><h2 class=\"text-slate-900 dark:text-slate-100 text-lg font-bold text-center\">Profile</h2></header><div class=\"p-8 text-center text-slate-500 dark:text-slate-400\">Loading profile…</div>";
        loadCurrentUserProfileFromSupabase().then(function () {
          renderProfile();
        });
        return;
      }
      const user = getLoggedInUser();
      const escape = (s) =>
        s == null
          ? ""
          : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const playerTypes = ["Beginner", "Intermediate", "Advanced"];

      main.innerHTML = `
      <header class="sticky top-0 z-20 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md px-4 pt-5 pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
        <h2 class="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight text-center">Profile</h2>
      </header>
      <div class="p-4 space-y-5 pb-28">
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/10 dark:via-primary/5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div class="p-5 flex items-start gap-4">
            <div class="size-20 rounded-2xl bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden border-2 border-primary/30 shadow-md shrink-0 ring-2 ring-white/50 dark:ring-slate-700/50">
              <img id="profile-avatar" class="w-full h-full object-cover" alt="" src="${escape(user.avatar) || ""}"/>
            </div>
            <div class="flex-1 min-w-0 pt-0.5">
              <h1 id="profile-name" class="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">${escape(user.name) || "Your name"}</h1>
              <p id="profile-email" class="text-slate-500 dark:text-slate-400 text-sm mt-0.5 truncate">${escape(user.email) || "—"}</p>
              ${user.playerType ? `<span class="inline-flex items-center mt-2 px-2.5 py-1 rounded-lg bg-primary/25 dark:bg-primary/20 text-slate-800 dark:text-slate-200 text-xs font-semibold">${escape(user.playerType)}</span>` : ""}
            </div>
            <button type="button" id="edit-profile-btn" class="size-10 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-all shrink-0 shadow-sm" title="Edit profile">
              <span class="material-symbols-outlined text-slate-600 dark:text-slate-300 text-[22px]">edit</span>
            </button>
          </div>
        </div>
        <div class="rounded-2xl bg-white dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/80">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span class="material-symbols-outlined text-base opacity-70">person</span> Details
            </h3>
          </div>
          <div class="p-4 space-y-4">
          ${!currentUserProfile && typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() ? (lastProfileLoadError && (String(lastProfileLoadError).indexOf("Invalid API key") !== -1 || String(lastProfileLoadError).indexOf("401") !== -1) ? "<p class=\"text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-2\"><strong>Invalid Supabase API key.</strong> Use the <strong>anon public</strong> key from the <strong>same project</strong> as your SUPABASE_URL. In Supabase Dashboard open the project with URL <code>qixqhwlqratwnnpoulvv</code> → Settings → API → copy <strong>anon public</strong> (long JWT) into <code>config.local.js</code> as <code>SUPABASE_ANON_KEY</code>. Then hard refresh (Ctrl+F5).</p>" : (typeof CONFIG !== "undefined" && CONFIG.supabase && CONFIG.supabase.profilesTable === "app_profiles" ? "<p class=\"text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-2\">Profile didn’t load. Do a <strong>hard refresh</strong> (Ctrl+F5), then open Profile again. If it still fails, open the browser console (F12) and check for red errors—RLS policies on <code>app_profiles</code> must allow anon SELECT and INSERT.</p>" : "<p class=\"text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-2\">Profile didn’t load. If your DB has <strong>app_profiles</strong>, add to <code>config.local.js</code>: <code>SUPABASE_PROFILES_TABLE: \"app_profiles\"</code>, <code>SUPABASE_FRIEND_REQUESTS_TABLE: \"app_friend_requests\"</code>. Then refresh and open Profile again.</p>")) : ""}
            <div class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div class="space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">First name</span><p id="profile-first-name" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.firstName) || "—"}</p></div>
              <div class="space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">Last name</span><p id="profile-last-name" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.lastName) || "—"}</p></div>
              <div class="space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">Age</span><p id="profile-age" class="font-medium text-slate-900 dark:text-slate-100">${user.age !== null && user.age !== "" ? escape(user.age) : "—"}</p></div>
              <div class="space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">City</span><p id="profile-city" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.city) || escape((user.location || "").split(",")[0]) || "—"}</p></div>
              <div class="space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">State / Area</span><p id="profile-state" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.state) || escape((user.location || "").split(",")[1]) || "—"}</p></div>
              <div class="space-y-0.5 col-span-2"><span class="text-xs text-slate-500 dark:text-slate-400 block">Location</span><p id="profile-location" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.location) || "—"}</p></div>
              <div class="space-y-0.5 col-span-2"><span class="text-xs text-slate-500 dark:text-slate-400 block">Type of player</span><p id="profile-player-type" class="font-medium text-slate-900 dark:text-slate-100">${escape(user.playerType) || "—"}</p></div>
              ${user.bio ? `<div class="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-700/80 space-y-0.5"><span class="text-xs text-slate-500 dark:text-slate-400 block">Bio</span><p id="profile-bio" class="font-medium text-slate-700 dark:text-slate-300 text-sm leading-relaxed">${escape(user.bio)}</p></div>` : ""}
            </div>
          </div>
        </div>
        <div id="profile-edit-form" class="hidden rounded-2xl bg-white dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span class="material-symbols-outlined text-lg">edit</span> Edit profile
            </h3>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">First name</label><input id="edit-first-name" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="text" placeholder="First name"/></div>
              <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Last name</label><input id="edit-last-name" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="text" placeholder="Last name"/></div>
            </div>
            <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Age</label><input id="edit-age" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="number" min="1" max="120" placeholder="Age"/></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">City</label><input id="edit-city" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="text" placeholder="e.g. Austin"/></div>
              <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">State / Region</label><input id="edit-state" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="text" placeholder="e.g. TX"/></div>
            </div>
            <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Location (display)</label><input id="edit-location" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="text" placeholder="e.g. Austin, TX"/></div>
            <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Bio</label><textarea id="edit-bio" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 min-h-[88px] focus:ring-2 focus:ring-primary focus:border-transparent resize-y" placeholder="A short intro or what you're looking for..." rows="3"></textarea></div>
            <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Email</label><input id="edit-email" class="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-500 dark:text-slate-400 cursor-not-allowed" type="email" placeholder="Email" readonly/></div>
            <div><label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Type of player</label><select id="edit-player-type" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent">${playerTypes.map((t) => `<option value="${escape(t)}" ${user.playerType === t ? "selected" : ""}>${escape(t)}</option>`).join("")}</select></div>
            <div>
              <label class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">Profile photo</label>
              <div class="flex items-center gap-3 mb-2">
                <div id="edit-avatar-preview" class="size-16 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <span class="material-symbols-outlined text-slate-400 text-2xl">person</span>
                </div>
                <div class="flex-1 min-w-0">
                  <input id="edit-avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"/>
                  <button type="button" id="edit-avatar-upload-btn" class="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-sm py-2 px-3 rounded-xl transition-colors">Upload photo</button>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Resized to save space</p>
                </div>
              </div>
              <div id="edit-avatar-grid" class="flex flex-wrap gap-2 mb-2"></div>
              <input id="edit-avatar" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent" type="url" placeholder="Or paste custom avatar URL"/>
            </div>
            <div class="flex gap-3 pt-1">
              <button type="button" id="profile-save-btn" class="flex-1 bg-primary hover:opacity-90 active:scale-[0.98] text-slate-900 font-bold py-3 rounded-xl shadow-sm transition-all">Save</button>
              <button type="button" id="profile-cancel-btn" class="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
        <div id="friend-requests-section" class="rounded-2xl bg-white dark:bg-slate-800/90 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/80">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span class="material-symbols-outlined text-base opacity-70">group_add</span> Friend requests
            </h3>
          </div>
          <div class="p-4">
            <div id="friend-requests-list" class="space-y-2"></div>
            <div class="mt-4 flex gap-2">
              <input id="friend-email-input" type="email" placeholder="Friend's email" class="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"/>
              <button type="button" id="send-friend-request-btn" class="bg-primary hover:opacity-90 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm shrink-0">Send</button>
            </div>
          </div>
        </div>
        <button id="logout-btn" class="w-full py-3 rounded-xl font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition-colors">Log out</button>
      </div>`;

      function renderFriendRequests(requests) {
        const list = main.querySelector("#friend-requests-list");
        if (!list) return;
        if (!requests || requests.length === 0) {
          list.innerHTML = '<p class="text-slate-500 dark:text-slate-400 text-sm">No pending requests.</p>';
          return;
        }
        list.innerHTML = requests
          .map(
            (r) => `
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div class="flex items-center gap-3 min-w-0">
              <div class="size-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden">
                ${r.fromAvatar ? `<img class="w-full h-full object-cover" src="${escape(r.fromAvatar)}" alt=""/>` : '<span class="material-symbols-outlined text-slate-400 w-full h-full flex items-center justify-center text-xl">person</span>'}
              </div>
              <div class="min-w-0">
                <p class="font-medium text-slate-900 dark:text-slate-100 truncate">${escape(r.fromName)}</p>
                ${r.fromEmail ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate">${escape(r.fromEmail)}</p>` : ""}
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button type="button" class="accept-friend-request size-9 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center transition-colors" data-request-id="${escape(r.id)}" title="Accept"><span class="material-symbols-outlined text-lg">check</span></button>
              <button type="button" class="decline-friend-request size-9 rounded-xl bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors" data-request-id="${escape(r.id)}" title="Decline"><span class="material-symbols-outlined text-lg">close</span></button>
            </div>
          </div>`
          )
          .join("");
        list.querySelectorAll(".accept-friend-request").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-request-id");
            if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && id) {
              SupabaseService.acceptFriendRequest(id)
                .then(() => renderProfile())
                .catch((err) => alert(err.message || "Failed to accept"));
            }
          });
        });
        list.querySelectorAll(".decline-friend-request").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-request-id");
            if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && id) {
              SupabaseService.declineFriendRequest(id)
                .then(() => renderProfile())
                .catch((err) => alert(err.message || "Failed to decline"));
            }
          });
        });
      }

      if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && user.profileId) {
        SupabaseService.getFriendRequestsReceived(user.profileId).then(renderFriendRequests);
      } else {
        renderFriendRequests([]);
      }

      main.querySelector("#send-friend-request-btn").addEventListener("click", () => {
        const input = main.querySelector("#friend-email-input");
        const email = input && input.value.trim();
        if (!email) {
          alert("Enter your friend's email.");
          return;
        }
        if (typeof SupabaseService === "undefined" || !SupabaseService.isConfigured()) {
          alert("Friend requests require Supabase. Configure your project to use them.");
          return;
        }
        if (!user.profileId) {
          alert("Save your profile first (Edit profile → Save) so we can send requests.");
          return;
        }
        SupabaseService.getProfileByEmail(email)
          .then((target) => {
            if (!target) {
              alert("No user found with that email. They need to sign up and save their profile first.");
              return;
            }
            if (target.id === user.profileId) {
              alert("You cannot send a request to yourself.");
              return;
            }
            return SupabaseService.sendFriendRequest(user.profileId, target.id)
              .then(() => {
                if (input) input.value = "";
                alert("Friend request sent.");
              });
          })
          .catch((err) => alert(err.message || "Failed to send request"));
      });

      main.querySelector("#edit-profile-btn").addEventListener("click", () => {
        const form = main.querySelector("#profile-edit-form");
        main.querySelector("#edit-first-name").value = user.firstName || "";
        main.querySelector("#edit-last-name").value = user.lastName || "";
        main.querySelector("#edit-age").value = user.age !== null && user.age !== "" ? user.age : "";
        main.querySelector("#edit-city").value = user.city || "";
        main.querySelector("#edit-state").value = user.state || "";
        main.querySelector("#edit-location").value = user.location || "";
        main.querySelector("#edit-bio").value = user.bio || "";
        main.querySelector("#edit-email").value = user.email || "";
        main.querySelector("#edit-player-type").value = user.playerType || "Intermediate";
        main.querySelector("#edit-avatar").value = user.avatar || "";
        const avatarPreview = main.querySelector("#edit-avatar-preview");
        const avatarInput = main.querySelector("#edit-avatar");
        if (avatarPreview) {
          const url = user.avatar || "";
          if (url) {
            avatarPreview.innerHTML = "";
            const img = document.createElement("img");
            img.className = "w-full h-full object-cover";
            img.alt = "";
            img.src = url;
            avatarPreview.appendChild(img);
          } else {
            avatarPreview.innerHTML = '<span class="material-symbols-outlined text-slate-400">person</span>';
          }
        }
        const grid = main.querySelector("#edit-avatar-grid");
        if (grid && typeof AVATAR_OPTIONS !== "undefined") {
          grid.innerHTML = AVATAR_OPTIONS.map(
            (url) =>
              `<button type="button" class="avatar-option size-12 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-600 hover:border-primary focus:border-primary shrink-0" data-avatar="${url.replace(/"/g, "&quot;")}"><img class="w-full h-full object-cover" src="${url}" alt=""/></button>`
          ).join("");
          grid.querySelectorAll(".avatar-option").forEach((btn) => {
            btn.addEventListener("click", () => {
              main.querySelector("#edit-avatar").value = btn.getAttribute("data-avatar") || "";
              main
                .querySelectorAll("#edit-avatar-grid .avatar-option")
                .forEach((b) => b.classList.remove("border-primary"));
              btn.classList.add("border-primary");
              const preview = main.querySelector("#edit-avatar-preview");
              if (preview) {
                const u = btn.getAttribute("data-avatar") || "";
                if (u) {
                  preview.innerHTML = "";
                  const img = document.createElement("img");
                  img.className = "w-full h-full object-cover";
                  img.alt = "";
                  img.src = u;
                  preview.appendChild(img);
                } else {
                  preview.innerHTML = '<span class="material-symbols-outlined text-slate-400">person</span>';
                }
              }
            });
          });
        }
        const uploadInput = main.querySelector("#edit-avatar-upload");
        const uploadBtn = main.querySelector("#edit-avatar-upload-btn");
        if (uploadBtn && uploadInput) {
          uploadBtn.addEventListener("click", () => uploadInput.click());
          uploadInput.addEventListener("change", function () {
            const file = this.files && this.files[0];
            if (!file) return;
            resizeImageForAvatar(file)
              .then(function (blob) {
                const previewEl = main.querySelector("#edit-avatar-preview");
                const url = URL.createObjectURL(blob);
                if (previewEl) {
                  previewEl.innerHTML = "";
                  const img = document.createElement("img");
                  img.className = "w-full h-full object-cover";
                  img.alt = "";
                  img.src = url;
                  previewEl.appendChild(img);
                }
                if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && user.profileId) {
                  return SupabaseService.uploadProfilePhoto(user.profileId, blob).then(function (photoUrl) {
                    URL.revokeObjectURL(url);
                    main.querySelector("#edit-avatar").value = photoUrl;
                    if (previewEl && previewEl.querySelector("img")) previewEl.querySelector("img").src = photoUrl;
                  });
                }
                const reader = new FileReader();
                reader.onload = function () {
                  main.querySelector("#edit-avatar").value = reader.result || "";
                  URL.revokeObjectURL(url);
                };
                reader.readAsDataURL(blob);
              })
              .catch(function (err) {
                alert(err.message || "Failed to process image");
              });
            this.value = "";
          });
        }
        if (avatarInput) {
          avatarInput.addEventListener("input", function () {
            const preview = main.querySelector("#edit-avatar-preview");
            const u = (this.value || "").trim();
            if (!preview) return;
            if (u) {
              preview.innerHTML = "";
              const img = document.createElement("img");
              img.className = "w-full h-full object-cover";
              img.alt = "";
              img.src = u;
              img.onerror = function () {
                preview.innerHTML = '<span class="material-symbols-outlined text-slate-400">person</span>';
              };
              preview.appendChild(img);
            } else {
              preview.innerHTML = '<span class="material-symbols-outlined text-slate-400">person</span>';
            }
          });
        }
        form.classList.remove("hidden");
      });
      main.querySelector("#profile-save-btn").addEventListener("click", () => {
        const firstName = main.querySelector("#edit-first-name").value.trim();
        const lastName = main.querySelector("#edit-last-name").value.trim();
        const ageRaw = main.querySelector("#edit-age").value.trim();
        const age = ageRaw === "" ? null : ageRaw;
        const city = main.querySelector("#edit-city").value.trim();
        const state = main.querySelector("#edit-state").value.trim();
        const location = main.querySelector("#edit-location").value.trim();
        const locationDisplay = location || (city && state ? city + ", " + state : city || state);
        const bio = main.querySelector("#edit-bio").value.trim();
        const email = main.querySelector("#edit-email").value.trim();
        const playerType = main.querySelector("#edit-player-type").value || "Intermediate";
        const avatar = main.querySelector("#edit-avatar").value.trim();
        const name = [firstName, lastName].filter(Boolean).join(" ") || user.name;
        if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
          const payload = {
            firstName,
            lastName,
            age,
            location: locationDisplay,
            city,
            state,
            bio,
            playerType,
            avatar,
            name: name || undefined,
          };
          if (user.profileId) {
            SupabaseService.updateProfile({ id: user.profileId, ...payload })
              .then(function (updated) {
                if (updated) currentUserProfile = updated;
                main.querySelector("#profile-edit-form").classList.add("hidden");
                renderProfile();
              })
              .catch(function (err) {
                alert(err.message || "Failed to save to server.");
                main.querySelector("#profile-edit-form").classList.add("hidden");
                renderProfile();
              });
          } else {
            SupabaseService.getOrCreateProfileByEmail(user.email || email, {
              name: name || user.name,
              firstName,
              lastName,
              age,
              location: locationDisplay || user.location,
              city,
              state,
              bio,
              playerType,
              avatar: avatar || user.avatar,
              email: email || user.email,
            })
              .then(function (profile) {
                if (profile) currentUserProfile = profile;
                return profile && profile.id ? SupabaseService.updateProfile({ id: profile.id, ...payload }) : null;
              })
              .then(function (updated) {
                if (updated) currentUserProfile = updated;
                main.querySelector("#profile-edit-form").classList.add("hidden");
                renderProfile();
              })
              .catch(function (err) {
                alert(err.message || "Failed to save to server.");
                main.querySelector("#profile-edit-form").classList.add("hidden");
                renderProfile();
              });
          }
        } else {
          saveUserProfile({
            name: name || user.name,
            firstName,
            lastName,
            age,
            city,
            state,
            location: locationDisplay,
            bio,
            email: email || user.email,
            playerType,
            avatar: avatar || user.avatar,
            profileId: user.profileId,
          });
          main.querySelector("#profile-edit-form").classList.add("hidden");
          renderProfile();
        }
      });
      main.querySelector("#profile-cancel-btn").addEventListener("click", () => {
        main.querySelector("#profile-edit-form").classList.add("hidden");
      });
      main.querySelector("#logout-btn").addEventListener("click", () => {
        currentUserProfile = null;
        profileLoadAttempted = false;
        lastProfileLoadError = null;
        if (typeof AuthService !== "undefined") AuthService.logOut();
        else localStorage.removeItem("pickleball_logged_in");
        renderProfile();
      });
      return;
    }

    main.innerHTML = `
    <header class="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between">
      <h2 class="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Profile</h2>
    </header>
    <div class="p-4">
      <div class="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden rounded-xl min-h-[400px] shadow-lg relative" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAW1r7IlBstEUqS9Z8tsUh6fcIzsU1b8U2a4jVGI5eDbAiLfXpPBj_vuiBwlHGenLksM_3Z6zyoQtYiHhCy27rlhnPha8RRhYduMkj2kRrdGAUDtJ_pq4yZZ9ERzr9ahLoh0qmCiHhoRRkbm8xszBFn-IOxfRnS-FkSND_THg_cmadSBdRG6K_rrC0l30r8OjtXJFevKZaRFJH8_nkOM5EIMOKS1f-7SRnuyOXaqxu6_4CPDK0cSYtPgRhH3jYB6GVil1u7xj82u4Q');">
        <div class="absolute inset-0 bg-gradient-to-t from-background-dark/80 to-transparent"></div>
        <div class="relative p-6">
          <span class="inline-block px-3 py-1 bg-primary text-background-dark text-xs font-bold rounded-full mb-3 uppercase tracking-wider">Start Playing</span>
          <h1 class="text-white tracking-tight text-3xl font-bold leading-tight">Your next match is just a tap away.</h1>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-2 px-4 pt-6 pb-4">
      <h2 class="text-slate-900 dark:text-slate-100 tracking-tight text-[28px] font-bold leading-tight text-center">Join the Community</h2>
      <p class="text-slate-600 dark:text-slate-400 text-base leading-relaxed text-center px-4">Connect with players near you, find local courts, and track your progress.</p>
    </div>
    <div id="auth-quick-btns" class="flex flex-col gap-3 px-4 pb-4">
      <div class="flex justify-center gap-4 mb-2">
        <button type="button" class="social-auth-btn size-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" title="Sign in with Google" aria-label="Sign in with Google">
          <svg class="size-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        </button>
        <button type="button" class="social-auth-btn size-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" title="Sign in with Apple" aria-label="Sign in with Apple">
          <svg class="size-6 text-slate-800 dark:text-slate-200" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        </button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 text-center">or</p>
      <button id="create-account-btn" class="w-full h-14 bg-primary text-background-dark font-bold text-lg rounded-xl shadow-md active:scale-[0.98] transition-transform">Create Account</button>
      <button id="login-btn" class="w-full h-14 bg-primary/20 dark:bg-primary/10 text-slate-900 dark:text-primary font-bold text-lg rounded-xl border-2 border-primary/30 active:scale-[0.98] transition-transform">Log In</button>
    </div>
    <div id="auth-phone-section" class="px-4 pb-4 hidden">
      <p class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Log in or sign up with phone (USA)</p>
      <div class="flex gap-2 mb-2">
        <span class="flex items-center justify-center w-14 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">+1</span>
        <input id="auth-phone-input" class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" placeholder="512 555 1234" type="tel" inputmode="numeric" maxlength="14"/>
      </div>
      <button id="auth-send-code-btn" type="button" class="w-full h-12 bg-primary text-slate-900 font-bold rounded-xl mb-2">Send code</button>
      <div id="auth-verify-row" class="hidden">
        <input id="auth-code-input" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 mb-2" placeholder="Enter 6-digit code" type="text" maxlength="6" inputmode="numeric"/>
        <button id="auth-verify-btn" type="button" class="w-full h-12 bg-primary text-slate-900 font-bold rounded-xl">Verify & continue</button>
      </div>
    </div>
    <div id="auth-email-section" class="px-4 pb-4 hidden" data-auth-mode="signin">
      <p id="auth-email-heading" class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Log in with email</p>
      <input id="auth-email-input" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 mb-2" placeholder="Email" type="email"/>
      <input id="auth-password-input" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 mb-2" placeholder="Password" type="password"/>
      <button id="auth-email-submit-btn" type="button" class="w-full h-12 bg-primary text-slate-900 font-bold rounded-xl mb-2">Log in</button>
      <button type="button" id="auth-use-phone-link" class="w-full text-sm text-primary font-semibold">Use phone instead</button>
    </div>
    <p class="text-xs text-slate-400 dark:text-slate-500 text-center mt-2 px-8 pb-12">By continuing, you agree to our Terms of Service and Privacy Policy.</p>`;
    const useFirebaseAuth =
      typeof FirebaseAuthService !== "undefined" &&
      FirebaseAuthService.isConfigured &&
      FirebaseAuthService.isConfigured();
    const emailSection = main.querySelector("#auth-email-section");
    const phoneSection = main.querySelector("#auth-phone-section");
    const authEmailHeading = main.querySelector("#auth-email-heading");
    const authEmailSubmitBtn = main.querySelector("#auth-email-submit-btn");

    main.querySelectorAll(".social-auth-btn").forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        if (idx === 0 && useFirebaseAuth) {
          FirebaseAuthService.signInWithGoogle()
            .then(function (res) {
              if (res && res.redirect) return; // leaving page for redirect
              syncLoggedInUserToSupabase().then(renderProfile, renderProfile);
            })
            .catch(function (err) {
              alert(err && err.message ? err.message : "Google sign-in failed.");
            });
        } else if (idx !== 0) {
          alert("Apple sign-in coming soon. Use Google or email.");
        } else {
          alert("Social sign-in coming soon. Use phone or email.");
        }
      });
    });
    main.querySelector("#create-account-btn").addEventListener("click", () => {
      document.getElementById("auth-quick-btns").classList.add("hidden");
      document.getElementById("auth-phone-section").classList.add("hidden");
      if (useFirebaseAuth) {
        if (emailSection) {
          emailSection.dataset.authMode = "signup";
          emailSection.classList.remove("hidden");
        }
        if (authEmailHeading) authEmailHeading.textContent = "Create account with email";
        if (authEmailSubmitBtn) authEmailSubmitBtn.textContent = "Create account";
      } else {
        document.getElementById("auth-phone-section").classList.remove("hidden");
        if (typeof AuthService === "undefined") {
          document.getElementById("auth-phone-section").classList.add("hidden");
          localStorage.setItem("pickleball_logged_in", "true");
          renderProfile();
        }
      }
    });
    main.querySelector("#login-btn").addEventListener("click", () => {
      document.getElementById("auth-quick-btns").classList.add("hidden");
      document.getElementById("auth-phone-section").classList.add("hidden");
      if (useFirebaseAuth) {
        if (emailSection) {
          emailSection.dataset.authMode = "signin";
          emailSection.classList.remove("hidden");
        }
        if (authEmailHeading) authEmailHeading.textContent = "Log in with email";
        if (authEmailSubmitBtn) authEmailSubmitBtn.textContent = "Log in";
      } else {
        document.getElementById("auth-phone-section").classList.remove("hidden");
        if (typeof AuthService === "undefined") {
          document.getElementById("auth-phone-section").classList.add("hidden");
          if (emailSection) emailSection.classList.remove("hidden");
        }
      }
    });
    if (authEmailSubmitBtn) {
      authEmailSubmitBtn.addEventListener("click", () => {
        const email =
          (main.querySelector("#auth-email-input") && main.querySelector("#auth-email-input").value.trim()) || "";
        const password =
          (main.querySelector("#auth-password-input") && main.querySelector("#auth-password-input").value) || "";
        if (!email) {
          alert("Enter your email.");
          return;
        }
        if (useFirebaseAuth) {
          if (!password) {
            alert("Enter your password.");
            return;
          }
          const mode = (emailSection && emailSection.dataset.authMode) || "signin";
          authEmailSubmitBtn.disabled = true;
          const promise =
            mode === "signup"
              ? FirebaseAuthService.signUpWithEmail(email, password)
              : FirebaseAuthService.signInWithEmail(email, password);
          promise
            .then(function () {
              syncLoggedInUserToSupabase().then(renderProfile, renderProfile);
            })
            .catch((err) => alert(err.message || "Failed."))
            .finally(() => {
              authEmailSubmitBtn.disabled = false;
            });
        } else {
          localStorage.setItem("pickleball_logged_in", "true");
          if (email) localStorage.setItem("pickleball_user_email", email);
          renderProfile();
        }
      });
    }
    const addEmailLink = () => {
      const wrap = document.createElement("div");
      wrap.className = "text-center mt-2";
      wrap.innerHTML =
        '<button type="button" id="auth-use-email-link" class="text-sm text-primary font-semibold">Use email instead</button>';
      if (phoneSection && !phoneSection.querySelector("#auth-use-email-link")) {
        phoneSection.appendChild(wrap);
        wrap.querySelector("#auth-use-email-link").addEventListener("click", () => {
          phoneSection.classList.add("hidden");
          if (emailSection) emailSection.classList.remove("hidden");
        });
      }
    };
    addEmailLink();
    if (emailSection && main.querySelector("#auth-use-phone-link")) {
      main.querySelector("#auth-use-phone-link").addEventListener("click", () => {
        emailSection.classList.add("hidden");
        if (phoneSection) phoneSection.classList.remove("hidden");
      });
    }
    const sendCodeBtn = main.querySelector("#auth-send-code-btn");
    const verifyRow = main.querySelector("#auth-verify-row");
    const phoneInput = main.querySelector("#auth-phone-input");
    const codeInput = main.querySelector("#auth-code-input");
    const verifyBtn = main.querySelector("#auth-verify-btn");
    let lastSentPhone = "";
    function normalizeUSPhone(val) {
      const raw = String(val).trim().replace(/\D/g, "");
      if (raw.length === 10) return "+1" + raw;
      if (raw.length === 11 && raw.charAt(0) === "1") return "+" + raw;
      return raw.length >= 10 ? "+1" + raw.slice(-10) : "";
    }
    if (sendCodeBtn && phoneInput && typeof AuthService !== "undefined") {
      sendCodeBtn.addEventListener("click", () => {
        lastSentPhone = normalizeUSPhone(phoneInput.value);
        if (!lastSentPhone) {
          alert("Enter a valid US phone number (10 digits).");
          return;
        }
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = "Sending…";
        AuthService.sendVerificationCode(lastSentPhone)
          .then(() => {
            sendCodeBtn.textContent = "Code sent";
            verifyRow.classList.remove("hidden");
            codeInput.focus();
          })
          .catch((err) => {
            alert(err.message || "Failed to send code.");
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Send code";
          })
          .finally(() => {
            sendCodeBtn.disabled = false;
          });
      });
    }
    if (verifyBtn && codeInput && phoneInput && typeof AuthService !== "undefined") {
      verifyBtn.addEventListener("click", () => {
        const code = codeInput.value.trim();
        const phone = lastSentPhone || normalizeUSPhone(phoneInput.value);
        if (!code) {
          alert("Enter the verification code.");
          return;
        }
        verifyBtn.disabled = true;
        AuthService.verifyCode(phone, code)
          .then(() => {
            localStorage.setItem("pickleball_user_phone", phone);
            renderProfile();
          })
          .catch((err) => {
            alert(err.message || "Invalid code.");
          })
          .finally(() => {
            verifyBtn.disabled = false;
          });
      });
    }
  }

  function renderChatLoginGate() {
    setActiveNav("chat");
    showNav(true);
    main.innerHTML = `
    <div class="absolute inset-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-xl z-10 flex flex-col items-center justify-center p-6">
      <div class="max-w-sm w-full text-center space-y-6">
        <div class="size-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto border-2 border-primary/30">
          <span class="material-symbols-outlined text-4xl text-primary">chat_bubble</span>
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Messages</h2>
          <p class="text-slate-600 dark:text-slate-400">To use the chat you need to log in.</p>
        </div>
        <a href="#profile" class="block w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-4 rounded-xl shadow-lg text-center">Log in</a>
      </div>
    </div>`;
  }

  function renderChatList() {
    setActiveNav("chat");
    showNav(true);

    function applyChats(chatsList) {
      const chats = chatsList || MOCK.chats || [];
      const list = chats
        .map(
          (c) => `
      <a href="#chat/${c.id}" class="flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
        <div class="relative">
          <div class="size-14 rounded-lg ${c.active ? "bg-primary/10" : "bg-slate-200 dark:bg-slate-800"} flex items-center justify-center overflow-hidden">
            <img class="object-cover size-full" alt="" src="${c.avatar}"/>
          </div>
          ${c.active ? '<div class="absolute -bottom-1 -right-1 size-4 bg-primary border-2 border-background-light dark:border-background-dark rounded-full"></div>' : ""}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline">
            <h3 class="font-bold text-slate-900 dark:text-slate-100 truncate">${c.title}</h3>
            <span class="text-[10px] font-semibold ${c.active ? "text-primary" : "text-slate-400"} uppercase">${c.time}</span>
          </div>
          <div class="flex justify-between items-center mt-0.5">
            <p class="text-sm text-slate-600 dark:text-slate-400 truncate pr-4 font-medium">${c.lastMessage}</p>
            ${c.unread ? `<span class="bg-primary text-background-dark text-[10px] font-black h-5 min-w-5 flex items-center justify-center rounded-full px-1 shadow-sm">${c.unread}</span>` : c.read ? '<span class="material-symbols-outlined text-sm text-primary">done_all</span>' : ""}
          </div>
        </div>
      </a>`
        )
        .join("");

      main.innerHTML = `
    <header class="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 pt-6 pb-2">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary overflow-hidden border border-primary/30">
            <span class="material-symbols-outlined text-2xl">account_circle</span>
          </div>
          <h1 class="text-xl font-bold tracking-tight">Messages</h1>
        </div>
        <a href="#players" class="size-10 rounded-full bg-primary flex items-center justify-center text-background-dark shadow-lg shadow-primary/20" title="New message – pick a player">
          <span class="material-symbols-outlined text-xl">edit</span>
        </a>
      </div>
      <div class="relative group mb-4">
        <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
          <span class="material-symbols-outlined text-xl">search</span>
        </div>
        <input class="w-full bg-white dark:bg-background-dark/50 border-none rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/50 placeholder:text-slate-400 shadow-sm" placeholder="Search conversations..." type="text"/>
      </div>
      <div class="flex border-b border-slate-200 dark:border-slate-800">
        <button type="button" class="chat-tab flex-1 py-3 text-sm font-semibold border-b-2 border-primary text-slate-900 dark:text-slate-100" data-tab="events">Event Chats</button>
        <button type="button" class="chat-tab flex-1 py-3 text-sm font-medium border-b-2 border-transparent text-slate-400" data-tab="dm">Direct Messages</button>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      ${list}
    </div>`;
      main.querySelectorAll(".chat-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          main.querySelectorAll(".chat-tab").forEach((t) => {
            t.classList.remove("border-primary", "text-slate-900", "dark:text-slate-100", "font-semibold");
            t.classList.add("border-transparent", "text-slate-400", "font-medium");
          });
          tab.classList.add("border-primary", "text-slate-900", "dark:text-slate-100", "font-semibold");
          tab.classList.remove("border-transparent", "text-slate-400", "font-medium");
        });
      });
    }

    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
      SupabaseService.getChats()
        .then((data) => applyChats(data != null ? data : MOCK.chats))
        .catch(() => applyChats(MOCK.chats));
    } else {
      applyChats(MOCK.chats);
    }
  }

  function messageToHtml(m) {
    if (m.me) {
      return `
        <div class="flex items-end gap-3 justify-end ml-auto max-w-[85%]">
          <div class="flex flex-col gap-1 items-end">
            <div class="flex items-center gap-2">
              <span class="text-slate-400 text-[10px]">${m.time || ""}</span>
              <span class="text-primary text-[12px] font-bold">Me</span>
            </div>
            <div class="text-sm leading-relaxed rounded-2xl rounded-br-none px-4 py-3 bg-primary text-slate-900 shadow-lg shadow-primary/20">${escapeHtml(m.text)}</div>
          </div>
          <div class="w-9 h-9 rounded-full bg-cover bg-center border-2 border-primary shrink-0" style="background-image:url('${(m.authorAvatar || "").replace(/'/g, "\\'")}')"></div>
        </div>`;
    }
    return `
        <div class="flex items-end gap-3 max-w-[85%]">
          <div class="w-9 h-9 rounded-full bg-cover bg-center border-2 border-primary/20 shrink-0" style="background-image:url('${(m.authorAvatar || "").replace(/'/g, "\\'")}')"></div>
          <div class="flex flex-col gap-1 items-start">
            <div class="flex items-center gap-2">
              <span class="text-primary text-[12px] font-bold">${escapeHtml(m.author || "")}</span>
              <span class="text-slate-400 text-[10px]">${m.time || ""}</span>
            </div>
            ${m.image ? `<div class="overflow-hidden rounded-2xl rounded-bl-none border-4 border-white dark:border-slate-800 shadow-sm"><img class="w-full h-48 object-cover" alt="" src="${m.image}"/></div>` : ""}
            <div class="text-sm leading-relaxed rounded-2xl rounded-bl-none px-4 py-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm border border-primary/5">${escapeHtml(m.text)}</div>
          </div>
        </div>`;
  }
  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function getDMChatId(otherProfileId) {
    const me = getLoggedInUser();
    const myId = me && me.profileId ? String(me.profileId) : "me";
    const other = String(otherProfileId || "");
    if (!other) return null;
    return "dm-" + [myId, other].sort().join("-");
  }

  function renderDM(otherProfileId) {
    showNav(false);
    const otherId = String(otherProfileId || "").trim();
    if (!otherId || otherId === "undefined") {
      main.innerHTML =
        "<p class='p-4'>Invalid conversation.</p><a href='#chat' class='p-4 text-primary font-bold'>← Back to Messages</a>";
      return;
    }
    const chatId = getDMChatId(otherId);
    if (!chatId) {
      main.innerHTML =
        "<p class='p-4'>Unable to start conversation.</p><a href='#chat' class='p-4 text-primary font-bold'>← Back to Messages</a>";
      return;
    }
    main.innerHTML =
      "<div class='p-6 flex flex-col items-center justify-center gap-3'><div class='animate-pulse rounded-full bg-primary/20 w-12 h-12'></div><p class='text-slate-500 dark:text-slate-400'>Opening conversation...</p></div>";
    let otherName = "Unknown";
    let _otherAvatar = "";
    function renderWithOther(p) {
      if (p) {
        otherName = p.name || otherName;
        _otherAvatar = p.avatar || "";
      }
      const esc = (s) =>
        s == null
          ? ""
          : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      let messages = [];
      let unsubLive = null;
      function renderChatBody(msgs) {
        const msgsHtml = (msgs || []).map((m) => messageToHtml(m)).join("");
        const container = main.querySelector(".chat-messages-container");
        if (container) container.innerHTML = msgsHtml;
      }
      main.innerHTML = `
    <header class="sticky top-0 z-10 flex flex-col bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-primary/10">
      <div class="flex items-center p-4 justify-between gap-3">
        <a href="#chat" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">arrow_back</span>
        </a>
        <div class="flex-1 min-w-0">
          <h2 class="text-slate-900 dark:text-white text-lg font-bold leading-tight truncate">${esc(otherName)}</h2>
          <a href="#profile/${esc(otherId)}" class="text-primary text-sm font-semibold">View profile</a>
        </div>
        <a href="#profile/${esc(otherId)}" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">person</span>
        </a>
      </div>
    </header>
    <main class="flex-1 overflow-y-auto p-4 space-y-6">
      <div class="flex justify-center my-4">
        <span class="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Direct message</span>
      </div>
      <div class="chat-messages-container"></div>
    </main>
    <footer class="p-4 bg-background-light dark:bg-background-dark border-t border-primary/10">
      <div class="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-full px-4 py-2 shadow-inner border border-primary/5">
        <button type="button" class="p-1 text-slate-400 hover:text-primary transition-colors"><span class="material-symbols-outlined">add_circle</span></button>
        <button type="button" class="p-1 text-slate-400 hover:text-primary transition-colors"><span class="material-symbols-outlined">mood</span></button>
        <input id="chat-input" class="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400" placeholder="Type a message..." type="text"/>
        <button type="button" id="chat-send-btn" class="size-9 bg-primary rounded-full text-slate-900 shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center">
          <span class="material-symbols-outlined font-bold">send</span>
        </button>
      </div>
    </footer>`;
      if (typeof ChatService !== "undefined" && ChatService.isConfigured && ChatService.isConfigured()) {
        unsubLive = ChatService.subscribeToChat(
          chatId,
          (newMsg) => {
            messages.push(newMsg);
            renderChatBody(messages);
          },
          (initialMsgs) => {
            messages = initialMsgs || [];
            renderChatBody(messages);
          }
        );
      } else if (typeof ChatService !== "undefined") {
        ChatService.getMessages(chatId)
          .then((msgs) => {
            messages = msgs || [];
            renderChatBody(messages);
            unsubLive = ChatService.subscribeToChat(chatId, (newMsg) => {
              messages.push(newMsg);
              renderChatBody(messages);
            });
          })
          .catch(() => {
            messages = (MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
            renderChatBody(messages);
          });
      } else {
        messages = (MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
        renderChatBody(messages);
      }
      function sendDMMessage() {
        const input = main.querySelector("#chat-input");
        const text = input && input.value.trim();
        if (!text) return;
        if (typeof ChatService !== "undefined" && ChatService.sendMessage) {
          ChatService.sendMessage(chatId, text, {
            authorName: "Me",
            authorAvatar: (MOCK.user && MOCK.user.avatar) || "",
          })
            .then(() => {
              input.value = "";
            })
            .catch(() => {
              input.value = text;
              alert("Failed to send.");
            });
        } else {
          input.value = "";
          const newMsg = {
            id: "mock-" + Date.now(),
            author: "Me",
            authorAvatar: (MOCK.user && MOCK.user.avatar) || "",
            time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            text: text,
            me: true,
          };
          messages.push(newMsg);
          if (typeof MOCK !== "undefined") {
            if (!MOCK.chatMessages) MOCK.chatMessages = {};
            if (!MOCK.chatMessages[chatId]) MOCK.chatMessages[chatId] = [];
            MOCK.chatMessages[chatId].push(newMsg);
          }
          renderChatBody(messages);
        }
      }
      main.querySelector("#chat-send-btn").addEventListener("click", sendDMMessage);
      const chatInput = main.querySelector("#chat-input");
      if (chatInput)
        chatInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendDMMessage();
          }
        });
      window.addEventListener("hashchange", function onLeave() {
        if (unsubLive) unsubLive();
        window.removeEventListener("hashchange", onLeave);
      });
    }
    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && SupabaseService.getProfileById) {
      SupabaseService.getProfileById(otherId)
        .then((profile) => {
          const p = profile
            ? {
                id: profile.id,
                name: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" "),
                avatar: profile.avatar,
              }
            : null;
          renderWithOther(p);
        })
        .catch(() => renderWithOther(null));
    } else {
      const player = (MOCK.players || []).find((x) => String(x.id) === String(otherId));
      renderWithOther(player ? { id: player.id, name: player.name, avatar: player.avatar } : null);
    }
  }

  function renderEventChat(chatId) {
    showNav(false);
    const isEventChat = chatId && String(chatId).startsWith("event-");
    const eventId = isEventChat ? String(chatId).slice(6) : null;
    const chat = MOCK.chats.find((c) => c.id === chatId);
    const title = isEventChat
      ? (typeof MOCK !== "undefined" &&
          MOCK.eventDetails &&
          MOCK.eventDetails[eventId] &&
          MOCK.eventDetails[eventId].title) ||
        "Event chat"
      : chat && chat.title;
    const linkEventId = isEventChat ? eventId : chat && chat.eventId;
    if (!chat && !isEventChat) {
      main.innerHTML =
        "<p class='p-4'>Chat not found.</p><a href='#chat' class='p-4 text-primary font-bold'>← Back to Messages</a>";
      return;
    }

    let messages = [];
    let unsubLive = null;

    function renderChatBody(msgs) {
      const msgsHtml = (msgs || []).map((m) => messageToHtml(m)).join("");
      const container = main.querySelector(".chat-messages-container");
      if (container) container.innerHTML = msgsHtml;
    }

    const esc = (s) =>
      s == null
        ? ""
        : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    main.innerHTML = `
    <header class="sticky top-0 z-10 flex flex-col bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-primary/10">
      <div class="flex items-center p-4 justify-between gap-3">
        <a href="#chat" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">arrow_back</span>
        </a>
        <div class="flex-1 min-w-0">
          <h2 class="text-slate-900 dark:text-white text-lg font-bold leading-tight truncate">${esc(title) || "Event chat"}</h2>
          <p class="text-primary text-sm font-semibold">Event chat — everyone sees messages</p>
        </div>
        <a href="#event/${esc(linkEventId) || "1"}" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">info</span>
        </a>
      </div>
    </header>
    <main class="flex-1 overflow-y-auto p-4 space-y-6">
      <div class="flex justify-center my-4">
        <span class="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</span>
      </div>
      <div class="chat-messages-container"></div>
    </main>
    <footer class="p-4 bg-background-light dark:bg-background-dark border-t border-primary/10">
      <div class="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-full px-4 py-2 shadow-inner border border-primary/5">
        <button type="button" class="p-1 text-slate-400 hover:text-primary transition-colors"><span class="material-symbols-outlined">add_circle</span></button>
        <button type="button" class="p-1 text-slate-400 hover:text-primary transition-colors"><span class="material-symbols-outlined">mood</span></button>
        <input id="chat-input" class="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400" placeholder="Type a message..." type="text"/>
        <button type="button" id="chat-send-btn" class="size-9 bg-primary rounded-full text-slate-900 shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center">
          <span class="material-symbols-outlined font-bold">send</span>
        </button>
      </div>
    </footer>`;

    if (typeof ChatService !== "undefined" && ChatService.isConfigured && ChatService.isConfigured()) {
      unsubLive = ChatService.subscribeToChat(
        chatId,
        (newMsg) => {
          messages.push(newMsg);
          renderChatBody(messages);
        },
        (initialMsgs) => {
          messages = initialMsgs || [];
          renderChatBody(messages);
        }
      );
    } else if (typeof ChatService !== "undefined") {
      ChatService.getMessages(chatId)
        .then((msgs) => {
          messages = msgs || [];
          renderChatBody(messages);
          unsubLive = ChatService.subscribeToChat(chatId, (newMsg) => {
            messages.push(newMsg);
            renderChatBody(messages);
          });
        })
        .catch(() => {
          messages = (MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
          renderChatBody(messages);
        });
    } else {
      messages = (MOCK.chatMessages && MOCK.chatMessages[chatId]) || [];
      renderChatBody(messages);
    }

    main.querySelector("#chat-send-btn").addEventListener("click", () => {
      const input = main.querySelector("#chat-input");
      const text = input && input.value.trim();
      if (!text) return;
      if (typeof ChatService !== "undefined" && ChatService.sendMessage) {
        ChatService.sendMessage(chatId, text, { authorName: "Me", authorAvatar: (MOCK.user && MOCK.user.avatar) || "" })
          .then(() => {
            input.value = "";
          })
          .catch(() => {
            input.value = text;
            alert("Failed to send.");
          });
      } else {
        input.value = "";
        messages.push({
          id: "mock-" + Date.now(),
          author: "Me",
          authorAvatar: (MOCK.user && MOCK.user.avatar) || "",
          time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          text: text,
          me: true,
        });
        renderChatBody(messages);
      }
    });

    window.addEventListener("hashchange", function onLeave() {
      if (unsubLive) unsubLive();
      window.removeEventListener("hashchange", onLeave);
    });
  }

  function renderEventDetails(eventId) {
    showNav(false);

    function renderWithEvent(e) {
      if (!e) {
        main.innerHTML =
          "<p class='p-4'>Event not found.</p><a href='#home' class='p-4 text-primary font-bold'>← Back to Home</a>";
        return;
      }

      const defaultAvatar = "https://ui-avatars.com/api/?name=P&background=94e22e&color=1a1a1a&size=128";
      const playerAvatars = (e.playerAvatars || [])
        .map((url) => {
          const src = url && url.trim() ? url : defaultAvatar;
          return `<div class="inline-block h-12 w-12 rounded-full ring-2 ring-background-light dark:ring-background-dark bg-cover bg-center shrink-0" style="background-image:url('${src.replace(/'/g, "&#39;")}')"></div>`;
        })
        .join("");

      main.innerHTML = `
    <header class="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 justify-between border-b border-primary/10">
      <a href="#home" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </a>
      <h2 class="text-lg font-bold flex-1 text-center pr-10">Event Details</h2>
    </header>
    <div class="flex flex-col gap-6 pb-44 overflow-y-auto">
      <div class="px-4 pt-4">
        <div class="w-full bg-center bg-no-repeat bg-cover rounded-xl min-h-[220px] shadow-lg" style="background-image:url('${e.image}');"></div>
      </div>
      <div class="px-4">
        <h1 class="text-3xl font-bold leading-tight mb-2">${e.title}</h1>
        <div class="flex flex-wrap gap-2 mt-4">
          <span class="px-3 py-1 bg-primary/20 text-slate-900 dark:text-primary font-semibold text-xs rounded-full uppercase tracking-wider">${e.level}</span>
          <span class="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-full uppercase tracking-wider">${e.playerCount} Players</span>
        </div>
      </div>
      <div class="px-4">
        <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-primary/5">
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 rounded-full bg-cover bg-center ring-2 ring-primary shrink-0" style="background-image:url('${e.hostAvatar}')"></div>
            <div>
              <p class="text-base font-bold">${e.hostName}</p>
              <p class="text-slate-500 dark:text-slate-400 text-sm">${e.hostSub}</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-primary">chevron_right</span>
        </div>
      </div>
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Location</h3>
        <div class="relative overflow-hidden rounded-2xl border border-primary/10 shadow-sm">
          <div class="w-full h-32 bg-cover bg-center" style="background-image:url('${e.mapImage}');"></div>
          <div class="p-3 bg-white dark:bg-slate-800 flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">location_on</span>
            <p class="text-sm font-medium">${e.locationName}</p>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button type="button" class="event-share-btn flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold text-sm">
            <span class="material-symbols-outlined text-lg">share</span> Share
          </button>
          <button type="button" class="event-calendar-btn flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold text-sm">
            <span class="material-symbols-outlined text-lg">event</span> Add to Calendar
          </button>
          <button type="button" class="event-directions-btn flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold text-sm">
            <span class="material-symbols-outlined text-lg">directions</span> Directions
          </button>
        </div>
      </div>
      <div class="px-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-primary/5">
            <span class="material-symbols-outlined text-primary mb-2">calendar_today</span>
            <p class="text-xs text-slate-500 font-medium">Date</p>
            <p class="text-sm font-bold">${e.date}</p>
          </div>
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-primary/5">
            <span class="material-symbols-outlined text-primary mb-2">schedule</span>
            <p class="text-xs text-slate-500 font-medium">Time</p>
            <p class="text-sm font-bold">${e.time}</p>
          </div>
        </div>
      </div>
      ${
        e.playerAvatars && e.playerAvatars.length
          ? `
      <div class="px-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest">Players (${e.playerCount})</h3>
          <a href="#players" class="text-primary text-sm font-bold">View all</a>
        </div>
        <div class="flex -space-x-3 overflow-hidden">${playerAvatars}</div>
      </div>`
          : ""
      }
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Description</h3>
        <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${e.description}</p>
      </div>
      ${
        e.chatPreview
          ? `
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Event Chat</h3>
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-primary/10 shadow-sm space-y-3">
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
            <div class="bg-slate-100 dark:bg-slate-900/50 p-2 px-3 rounded-tr-lg rounded-br-lg rounded-bl-lg">
              <p class="text-xs font-bold text-primary mb-1">${e.chatPreview.name}</p>
              <p class="text-sm">${e.chatPreview.text}</p>
            </div>
          </div>
          <a href="#chat/event-${eventId}" class="block w-full py-2 text-sm font-bold text-slate-500 border-t border-slate-100 dark:border-slate-700 mt-2 text-center">Open Chat (${e.chatCount} messages)</a>
        </div>
      </div>`
          : ""
      }
    </div>
    <div class="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-8 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-primary/10 flex gap-3">
      <a href="#chat/event-${eventId}" class="flex-1 flex items-center justify-center gap-2 py-4 px-6 border-2 border-primary text-slate-900 dark:text-white font-bold rounded-xl hover:bg-primary/5 transition-colors">
        <span class="material-symbols-outlined text-[20px]">chat_bubble</span>
        Message Host
      </a>
      <button id="join-event-btn" class="flex-[2] py-4 px-6 bg-primary text-slate-900 font-bold rounded-xl shadow-[0_4px_20px_-4px_rgba(128,242,13,0.5)] active:scale-95 transition-all">
        Join Event
      </button>
    </div>`;
      main.querySelector("#join-event-btn").addEventListener("click", () => {
        const user = getLoggedInUser();
        if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
          SupabaseService.joinEvent(eventId, user)
            .then(() => {
              if (SupabaseService.getEventCreatorProfile) {
                SupabaseService.getEventCreatorProfile(eventId).then((creator) => {
                  const url =
                    typeof CONFIG !== "undefined" && CONFIG.onesignal && CONFIG.onesignal.notifyEventCreatorUrl
                      ? CONFIG.onesignal.notifyEventCreatorUrl
                      : "";
                  if (creator && creator.email && url) {
                    fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        creatorExternalId: creator.email,
                        eventTitle: (e && e.title) || "Your event",
                        joinerName: user.name || "Someone",
                      }),
                    }).catch(() => {});
                  }
                });
              }
              alert("You joined the event!");
              window.location.hash = "home";
            })
            .catch((err) => {
              console.warn("Join event failed:", err);
              alert("Could not join event. Please try again.");
            });
        } else {
          alert("You joined the event!");
          window.location.hash = "home";
        }
      });

      function shareEvent(ev) {
        const url = window.location.origin + window.location.pathname + "#event/" + ev.id;
        const text = ev.title + " – " + ev.date + " " + ev.time + " at " + ev.locationName;
        if (navigator.share) {
          navigator.share({ title: ev.title, text, url }).catch(() => {
            navigator.clipboard
              ?.writeText(url)
              .then(() => alert("Link copied!"))
              .catch(() => alert(url));
          });
        } else {
          navigator.clipboard
            ?.writeText(url)
            .then(() => alert("Link copied!"))
            .catch(() => alert(url));
        }
      }

      function addToCalendar(ev) {
        const [startTime, endTime] = (ev.time || "").split("-").map((t) => t.trim());
        const dateStr = (ev.date || "").replace(/(\w+),?\s+(\w+)\s+(\d+)/, "$2 $3");
        const year = new Date().getFullYear();
        const start = new Date(dateStr + " " + year + " " + (startTime || "12:00 PM"));
        const end = endTime
          ? new Date(dateStr + " " + year + " " + endTime)
          : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const format = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "BEGIN:VEVENT",
          "SUMMARY:" + (ev.title || "Pickleball Event").replace(/,/g, "\\,"),
          "DTSTART:" + format(start),
          "DTEND:" + format(end),
          "LOCATION:" + (ev.locationName || "").replace(/,/g, "\\,"),
          "DESCRIPTION:" + (ev.description || "").replace(/,/g, "\\,").replace(/\n/g, "\\n"),
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");
        const blob = new Blob([ics], { type: "text/calendar" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "event-" + (ev.id || "pickleball") + ".ics";
        a.click();
        URL.revokeObjectURL(a.href);
        alert("Calendar event downloaded. Open the file to add to your calendar.");
      }

      function openDirections(ev) {
        const q = encodeURIComponent(ev.locationName || "");
        const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const url = isApple ? "https://maps.apple.com/?q=" + q : "https://www.google.com/maps/search/?api=1&query=" + q;
        window.open(url, "_blank");
      }

      main.querySelector(".event-share-btn").addEventListener("click", () => shareEvent(e));
      main.querySelector(".event-calendar-btn").addEventListener("click", () => addToCalendar(e));
      main.querySelector(".event-directions-btn").addEventListener("click", () => openDirections(e));
    }

    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
      SupabaseService.getEventDetail(eventId)
        .then((data) => renderWithEvent(data || MOCK.eventDetails[eventId]))
        .catch(() => renderWithEvent(MOCK.eventDetails[eventId]));
    } else {
      renderWithEvent(MOCK.eventDetails[eventId]);
    }
  }

  function renderAddEvent() {
    showNav(false);
    main.innerHTML = `
    <header class="px-6 pt-8 pb-6 bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/5">
      <div class="flex items-center justify-between mb-2">
        <a href="#home" class="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          <span class="material-symbols-outlined text-slate-900 dark:text-slate-100">arrow_back</span>
        </a>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Host an Event</h1>
        <div class="w-10"></div>
      </div>
      <p class="text-slate-600 dark:text-slate-400 text-sm">Create a game and invite your community.</p>
    </header>
    <main class="px-6 space-y-5 pb-32">
      <section class="space-y-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Event Name</label>
        <input class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-4 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-slate-100 shadow-sm" placeholder="e.g. Morning Smash Session" type="text"/>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-semibold ml-1">Date</label>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">calendar_today</span>
            <input class="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 pl-12 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 shadow-sm" type="date"/>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-semibold ml-1">Time</label>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">schedule</span>
            <input class="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 pl-12 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 shadow-sm" type="time"/>
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-semibold ml-1">Location</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">location_on</span>
          <input class="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 pl-12 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 shadow-sm" placeholder="Search court or address" type="text"/>
        </div>
        <div class="mt-2 h-32 w-full rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-semibold ml-1">Players Needed</label>
          <div class="flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm">
            <button type="button" id="players-minus" class="w-10 h-10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">remove_circle_outline</span></button>
            <input id="players-count" class="w-full bg-transparent border-none text-center focus:ring-0 font-bold" type="number" value="4" min="2" max="20"/>
            <button type="button" id="players-plus" class="w-10 h-10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">add_circle_outline</span></button>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-semibold ml-1">Game Format</label>
          <select class="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 shadow-sm">
            <option>Doubles</option>
            <option>Singles</option>
            <option>Open Play</option>
          </select>
        </div>
      </div>
      <div class="space-y-3">
        <label class="text-sm font-semibold ml-1">Target Skill Level</label>
        <div class="grid grid-cols-3 gap-3" id="skill-level-btns">
          <button type="button" data-skill="beginner" class="skill-btn py-3 rounded-xl border-2 border-primary bg-primary/10 text-slate-900 dark:text-white font-medium text-sm">Beginner</button>
          <button type="button" data-skill="intermediate" class="skill-btn py-3 rounded-xl border-2 border-transparent bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium text-sm">Intermediate</button>
          <button type="button" data-skill="advanced" class="skill-btn py-3 rounded-xl border-2 border-transparent bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium text-sm">Advanced</button>
        </div>
      </div>
      <div class="pt-2">
        <button id="create-event-btn" type="button" class="w-full bg-primary hover:opacity-95 active:scale-[0.98] transition-all text-slate-900 font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 border-0">
          <span class="material-symbols-outlined text-2xl">sports_tennis</span>
          <span>Create Event</span>
        </button>
      </div>
    </main>
    <nav class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-8 py-4">
      <div class="flex justify-between items-center max-w-md mx-auto">
        <a href="#home" class="flex flex-col items-center gap-1 text-slate-400"><span class="material-symbols-outlined">explore</span></a>
        <a href="#home" class="flex flex-col items-center gap-1 text-slate-400"><span class="material-symbols-outlined">calendar_today</span></a>
        <a href="#add-event" class="relative -mt-10">
          <span class="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40 text-slate-900 inline-flex"><span class="material-symbols-outlined text-3xl">add</span></span>
        </a>
        <a href="#chat" class="flex flex-col items-center gap-1 text-slate-400"><span class="material-symbols-outlined">chat_bubble_outline</span></a>
        <a href="#profile" class="flex flex-col items-center gap-1 text-slate-400"><span class="material-symbols-outlined">person_outline</span></a>
      </div>
    </nav>`;
    const playersInput = main.querySelector("#players-count");
    const eventNameInput = main.querySelector("main input[placeholder='Morning Smash Session']");
    const dateInput = main.querySelector("main input[type='date']");
    const timeInput = main.querySelector("main input[type='time']");
    const venueInput = main.querySelector("main input[placeholder='Search court or address']");
    const formatSelect = main.querySelector("main select");
    main.querySelector("#players-minus").addEventListener("click", () => {
      const v = Math.max(2, parseInt(playersInput.value, 10) - 1);
      playersInput.value = v;
    });
    main.querySelector("#players-plus").addEventListener("click", () => {
      const v = Math.min(20, parseInt(playersInput.value, 10) + 1);
      playersInput.value = v;
    });
    main.querySelector("#create-event-btn").addEventListener("click", () => {
      const title = (eventNameInput && eventNameInput.value.trim()) || "New Event";
      const date = (dateInput && dateInput.value) || "";
      const time = (timeInput && timeInput.value) || "";
      const venue = (venueInput && venueInput.value.trim()) || "TBD";
      const playerCount = parseInt(playersInput.value, 10) || 4;
      const format = (formatSelect && formatSelect.value) || "Doubles";
      const skillBtn = main.querySelector(".skill-btn.border-primary, .skill-btn[data-skill]");
      const level =
        skillBtn && skillBtn.dataset.skill
          ? skillBtn.dataset.skill.charAt(0).toUpperCase() + skillBtn.dataset.skill.slice(1)
          : "Intermediate";
      if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && SupabaseService.createEvent) {
        main.querySelector("#create-event-btn").disabled = true;
        const user = getLoggedInUser();
        SupabaseService.createEvent({
          title,
          date,
          time,
          venue,
          locationName: venue,
          playerCount,
          format,
          level,
          createdBy: user.profileId,
          creatorName: user.name,
          creatorAvatar: user.avatar,
        })
          .then(() => {
            alert("Event created!");
            window.location.hash = "home";
          })
          .catch((err) => {
            alert(err.message || "Failed to create event.");
            main.querySelector("#create-event-btn").disabled = false;
          });
      } else {
        alert("Event created! (Supabase not configured — not saved to server.)");
        window.location.hash = "home";
      }
    });
    main.querySelectorAll(".skill-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        main.querySelectorAll(".skill-btn").forEach((b) => {
          b.classList.remove("border-primary", "bg-primary/10", "text-slate-900", "dark:text-white");
          b.classList.add(
            "border-transparent",
            "bg-white",
            "dark:bg-slate-800",
            "text-slate-500",
            "dark:text-slate-400"
          );
        });
        btn.classList.remove(
          "border-transparent",
          "bg-white",
          "dark:bg-slate-800",
          "text-slate-500",
          "dark:text-slate-400"
        );
        btn.classList.add("border-primary", "bg-primary/10", "text-slate-900", "dark:text-white");
      });
    });
  }

  function renderCourts() {
    setActiveNav("home");
    showNav(true);
    const user = getLoggedInUser();

    function applyCourts(courtsList) {
      const courts = (courtsList || []).slice();
      lastCourtsList = courts;
      const pos =
        lastUserPosition ||
        (typeof CONFIG !== "undefined" && CONFIG.geolocation && CONFIG.geolocation.defaultCenter
          ? CONFIG.geolocation.defaultCenter
          : null);
      if (typeof GeolocationService !== "undefined" && pos && pos.lat != null && pos.lng != null) {
        GeolocationService.sortEventsByDistance(courts, pos.lat, pos.lng);
      }
      const cardsEl = document.getElementById("courts-cards");
      if (cardsEl) cardsEl.innerHTML = buildCourtsCardsHtml(courts);
    }

    function buildCourtsCardsHtml(courtsList) {
      return (courtsList || [])
        .map((c) => {
          const distDisplay =
            typeof GeolocationService !== "undefined" && c._distanceMiles != null
              ? GeolocationService.formatDistance(c._distanceMiles)
              : c.distance || "";
          return `
    <a href="#court/${escapeHtml(c.id)}" class="group block bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 hover:border-primary/30 transition-colors">
      <div class="relative h-36 w-full">
        <img class="w-full h-full object-cover" alt="" src="${escapeHtml(c.image || "")}"/>
        <div class="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-white text-xs font-bold flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">near_me</span>${escapeHtml(distDisplay)}
        </div>
      </div>
      <div class="p-4">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">${escapeHtml(c.name)}</h3>
        <p class="text-slate-500 dark:text-slate-400 text-sm mb-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-base">location_on</span>${escapeHtml(c.address)}
        </p>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 dark:text-slate-500 text-xs">
          <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">sports_tennis</span>${escapeHtml(c.courts)} courts</span>
          <span class="flex items-center gap-1">${escapeHtml(c.surface)}</span>
          <span class="flex items-center gap-1">${c.lights ? "Lights" : "No lights"}</span>
        </div>
      </div>
    </a>`;
        })
        .join("");
    }

    main.innerHTML = `
    <header class="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md pt-6 px-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/30">
            <img class="w-full h-full object-cover" alt="" src="${user.avatar}"/>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Find courts</p>
            <h2 class="text-lg font-bold leading-none">${user.name}</h2>
          </div>
        </div>
      </div>
      <div class="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <a href="#home" class="flex flex-col items-center justify-center pb-3 text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500">Events</a>
        <a href="#home" class="flex flex-col items-center justify-center pb-3 text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500">Tournaments</a>
        <a href="#courts" class="relative flex flex-col items-center justify-center pb-3 text-sm font-bold text-slate-900 dark:text-white">
          <span>Courts</span>
          <div class="absolute bottom-0 w-full h-[3px] bg-primary rounded-t-full"></div>
        </a>
      </div>
    </header>
    <div id="courts-cards" class="flex-1 p-4 space-y-4 pb-24">
      ${buildCourtsCardsHtml(MOCK.courts || [])}
    </div>`;
    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
      SupabaseService.getCourts()
        .then((data) => applyCourts(data && data.length ? data : MOCK.courts || []))
        .catch(() => applyCourts(MOCK.courts || []));
    } else if (typeof OSMCourtsService !== "undefined" && typeof GeolocationService !== "undefined") {
      GeolocationService.getCurrentPosition()
        .then((pos) => OSMCourtsService.getNearbyCourts(pos.lat, pos.lng))
        .then((osmCourts) => applyCourts(osmCourts && osmCourts.length ? osmCourts : MOCK.courts))
        .catch(() => applyCourts(MOCK.courts));
    } else {
      applyCourts(MOCK.courts || []);
    }
  }

  function renderCourtDetail(courtId) {
    showNav(false);

    function renderWithCourt(court) {
      if (!court) {
        main.innerHTML =
          "<p class='p-4'>Court not found.</p><a href='#courts' class='p-4 text-primary font-bold'>← Back to Courts</a>";
        return;
      }

      main.innerHTML = `
    <header class="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 justify-between border-b border-primary/10">
      <a href="#courts" class="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </a>
      <h2 class="text-lg font-bold flex-1 text-center pr-10">Court Details</h2>
    </header>
    <div class="flex flex-col gap-6 pb-24 overflow-y-auto">
      <div class="px-4 pt-4">
        <div class="w-full bg-center bg-no-repeat bg-cover rounded-xl min-h-[200px] shadow-lg" style="background-image:url('${court.image}');"></div>
      </div>
      <div class="px-4">
        <h1 class="text-2xl font-bold leading-tight mb-2">${court.name}</h1>
        <div class="flex flex-wrap gap-2 mt-3">
          <span class="px-3 py-1 bg-primary/20 text-slate-900 dark:text-primary font-semibold text-xs rounded-full">${court.courts} courts</span>
          <span class="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-full">${court.surface}</span>
          <span class="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-full">${court.lights ? "Lighted" : "No lights"}</span>
        </div>
      </div>
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Address</h3>
        <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-primary/5 flex items-center gap-3">
          <span class="material-symbols-outlined text-primary">location_on</span>
          <p class="text-sm font-medium">${court.address}</p>
        </div>
        <div class="flex gap-2 mt-3">
          <button type="button" class="court-share-btn flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold text-sm">
            <span class="material-symbols-outlined text-lg">share</span> Share
          </button>
          <button type="button" class="court-directions-btn flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold text-sm">
            <span class="material-symbols-outlined text-lg">directions</span> Directions
          </button>
        </div>
      </div>
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Amenities</h3>
        <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${court.amenities || "—"}</p>
      </div>
      ${
        court.rating != null || court.phone || court.website
          ? `
      <div class="px-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Details</h3>
        <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-primary/5 space-y-2">
          ${court.rating != null ? `<p class="text-sm text-slate-700 dark:text-slate-300">★ ${Number(court.rating).toFixed(1)}${court.rating_count != null ? " (" + court.rating_count + " reviews)" : ""}</p>` : ""}
          ${court.phone ? `<p class="text-sm"><a href="tel:${court.phone.replace(/\s/g, "")}" class="text-primary font-medium">${court.phone}</a></p>` : ""}
          ${court.website ? `<p class="text-sm"><a href="${court.website}" target="_blank" rel="noopener" class="text-primary font-medium break-all">Website</a></p>` : ""}
        </div>
      </div>
      `
          : ""
      }
      <div class="px-4">
        <a href="#event/1" class="block w-full py-4 bg-primary text-slate-900 font-bold rounded-xl text-center shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">Find events at this court</a>
      </div>
    </div>`;
      function shareCourt(c) {
        const url = window.location.origin + window.location.pathname + "#court/" + c.id;
        const text = c.name + " – " + c.address;
        if (navigator.share) {
          navigator.share({ title: c.name, text, url }).catch(() => {
            navigator.clipboard
              ?.writeText(url)
              .then(() => alert("Link copied!"))
              .catch(() => alert(url));
          });
        } else {
          navigator.clipboard
            ?.writeText(url)
            .then(() => alert("Link copied!"))
            .catch(() => alert(url));
        }
      }
      function openCourtDirections(addr) {
        const q = encodeURIComponent(addr || "");
        const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const url = isApple ? "https://maps.apple.com/?q=" + q : "https://www.google.com/maps/search/?api=1&query=" + q;
        window.open(url, "_blank");
      }
      main.querySelector(".court-share-btn").addEventListener("click", () => shareCourt(court));
      main.querySelector(".court-directions-btn").addEventListener("click", () => openCourtDirections(court.address));
    }

    function findCourt(id) {
      return (
        (lastCourtsList && lastCourtsList.find((c) => String(c.id) === String(id))) ||
        (MOCK.courts && MOCK.courts.find((c) => String(c.id) === String(id))) ||
        null
      );
    }
    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured()) {
      SupabaseService.getCourt(courtId)
        .then((data) => renderWithCourt(data || findCourt(courtId)))
        .catch(() => renderWithCourt(findCourt(courtId)));
    } else {
      renderWithCourt(findCourt(courtId));
    }
  }

  function renderPlayers() {
    setActiveNav("players");
    showNav(true);
    let players = MOCK.players || [];

    function buildPlayerCards(list) {
      return (list || [])
        .map(
          (p) => `
    <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700">
      <div class="p-4 flex gap-4">
        <div class="relative flex-shrink-0">
          <div class="w-20 h-20 rounded-full bg-cover bg-center border-2 border-primary" style="background-image:url('${p.avatar}')"></div>
          <div class="absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 ${p.online ? "bg-green-500" : "bg-slate-300"}"></div>
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-bold">${p.name}, ${p.age}</h3>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">${p.city}</p>
            </div>
            <span class="px-2 py-1 ${p.levelPrimary ? "bg-primary/20 text-slate-900 dark:text-primary" : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100"} text-[10px] font-bold rounded uppercase">${p.level}</span>
          </div>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400 italic">"${p.tagline}"</p>
        </div>
      </div>
      <div class="px-4 pb-4 flex gap-2 flex-wrap">
        <button type="button" class="player-message flex-1 min-w-0 bg-primary hover:opacity-90 text-slate-900 font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-1" data-player-id="${escapeHtml(String(p.id))}">
          <span class="material-symbols-outlined text-lg">chat_bubble</span>
          Message
        </button>
        <button type="button" class="player-view-profile flex-1 min-w-0 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold py-2 rounded-xl text-sm" data-player-id="${escapeHtml(p.id)}">View Profile</button>
        <button type="button" class="player-add-friend flex-1 min-w-0 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-1">
          <span class="material-symbols-outlined text-lg">person_add</span>
          Add Friend
        </button>
      </div>
    </div>`
        )
        .join("");
    }

    main.innerHTML = `
    <header class="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 pt-6 pb-2">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-3xl">sports_tennis</span>
          <h1 class="text-xl font-bold tracking-tight">Players</h1>
        </div>
        <button type="button" id="players-notifications-btn" class="p-2 rounded-full bg-primary/10 text-slate-900 dark:text-slate-100">
          <span class="material-symbols-outlined">notifications</span>
        </button>
      </div>
      <div class="relative group mb-4">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span class="material-symbols-outlined text-slate-400">search</span>
        </div>
        <input class="block w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary text-sm shadow-sm" placeholder="Search by name, city, or club..." type="text"/>
      </div>
      <div class="flex gap-2 py-4 overflow-x-auto no-scrollbar">
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-primary text-slate-900 text-sm font-semibold whitespace-nowrap" data-filter="all">All Players</button>
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap hover:bg-primary/10" data-filter="area">My area</button>
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap hover:bg-primary/10" data-filter="Beginner">Beginner</button>
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap hover:bg-primary/10" data-filter="Intermediate">Intermediate</button>
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap hover:bg-primary/10" data-filter="Advanced">Advanced</button>
        <button type="button" class="player-filter px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap hover:bg-primary/10" data-filter="Pro">Pro</button>
      </div>
    </header>
    <div id="players-cards" class="px-4 space-y-4">
      ${buildPlayerCards(players)}
    </div>`;
    function loadPlayersFromSupabase() {
      const container = main.querySelector("#players-cards");
      if (container)
        container.innerHTML = "<div class='py-8 text-center text-slate-500 dark:text-slate-400'>Loading players…</div>";
      const u = getLoggedInUser();
      let ensureSync = Promise.resolve();
      if (u.email && SupabaseService.getOrCreateProfileByEmail) {
        ensureSync = SupabaseService.getOrCreateProfileByEmail(u.email, {
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar,
          location: u.location,
          city: u.city,
          state: u.state,
          bio: u.bio,
          playerType: u.playerType,
        }).then(function (profile) {
          if (profile) currentUserProfile = profile;
        });
      }
      ensureSync
        .then(function () {
          const meId = getLoggedInUser().profileId;
          return typeof SupabaseService.findPeople === "function"
            ? SupabaseService.findPeople({ excludeProfileId: meId || undefined })
            : SupabaseService.getProfiles().then(function (list) {
                return (list || []).filter(function (p) { return !meId || String(p.id) !== String(meId); });
              });
        })
        .then(function (list) {
          applyPlayersList(list || []);
        })
        .catch(function () {
          applyPlayersList(MOCK.players || []);
        });
    }
    function applyPlayersList(list) {
      if (Array.isArray(list)) players = list;
      const container = main.querySelector("#players-cards");
      if (container) {
        if (players.length === 0) {
          const fromSupabase =
            typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && SupabaseService.getProfiles;
          container.innerHTML =
            (fromSupabase
              ? `
            <div class="py-12 px-4 text-center">
              <p class="text-slate-500 dark:text-slate-400 font-medium">No other players yet</p>
              <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">Save your profile (with city/location). Other accounts must open the app once to appear here.</p>
              <button type="button" id="players-retry-btn" class="mt-4 px-4 py-2 bg-primary text-slate-900 font-bold rounded-xl">Retry</button>
            </div>`
              : `
            <div class="py-12 px-4 text-center">
              <p class="text-slate-500 dark:text-slate-400 font-medium">No players yet</p>
              <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">Create an account or ask others to join — they'll show up here.</p>
            </div>`) + "";
          if (fromSupabase) {
            setTimeout(function () {
              const retryBtn = main.querySelector("#players-retry-btn");
              if (retryBtn) retryBtn.addEventListener("click", loadPlayersFromSupabase);
            }, 0);
          }
        } else {
          container.innerHTML = buildPlayerCards(players);
          wirePlayerCardActions();
        }
      }
    }
    function wirePlayerCardActions() {
      main.querySelectorAll(".player-message").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const playerId = btn.getAttribute("data-player-id");
          if (playerId) window.location.hash = "#chat/dm-" + playerId;
        });
      });
      main.querySelectorAll(".player-add-friend").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          alert("Friend request sent!");
        });
      });
      main.querySelectorAll(".player-view-profile").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const playerId = btn.getAttribute("data-player-id");
          window.location.hash = playerId ? "#profile/" + playerId : "#profile";
        });
      });
    }
    wirePlayerCardActions();
    if (typeof SupabaseService !== "undefined" && SupabaseService.isConfigured() && SupabaseService.getProfiles) {
      loadPlayersFromSupabase();
    }
    main.querySelector("#players-notifications-btn").addEventListener("click", handleNotificationsClick);
    const currentUser = getLoggedInUser();
    function normalizeCity(s) {
      return (s || "").toString().toLowerCase().trim();
    }
    function runFindPeople(filters, updateUI) {
      const meId = getLoggedInUser().profileId;
      const opts = { excludeProfileId: meId || undefined };
      if (filters.city) opts.city = filters.city;
      if (filters.playerType) opts.playerType = filters.playerType;
      if (filters.searchText) opts.searchText = filters.searchText;
      const container = main.querySelector("#players-cards");
      if (container) container.innerHTML = "<div class='py-8 text-center text-slate-500 dark:text-slate-400'>Finding players…</div>";
      const promise =
        typeof SupabaseService.findPeople === "function" && SupabaseService.isConfigured()
          ? SupabaseService.findPeople(opts)
          : Promise.resolve(players || []).then(function (list) {
              let filtered = list;
              if (filters.city) {
                const myCity = normalizeCity(filters.city);
                filtered = filtered.filter(function (p) {
                  const pCity = normalizeCity(p.city) || normalizeCity((p.city || "").split(",")[0]);
                  return pCity && pCity === myCity;
                });
              }
              if (filters.playerType) {
                filtered = filtered.filter(function (p) { return (p.level || "").toLowerCase() === (filters.playerType || "").toLowerCase(); });
              }
              if (filters.searchText) {
                const term = (filters.searchText || "").toLowerCase();
                filtered = filtered.filter(function (p) {
                  const name = (p.name || "").toLowerCase();
                  const cityStr = (p.city || "").toLowerCase();
                  const stateStr = (p.state || "").toLowerCase();
                  const bio = (p.tagline || "").toLowerCase();
                  return name.indexOf(term) !== -1 || cityStr.indexOf(term) !== -1 || stateStr.indexOf(term) !== -1 || bio.indexOf(term) !== -1;
                });
              }
              return filtered;
            });
      promise.then(function (list) {
        if (typeof updateUI === "function") updateUI(list);
        else {
          const cont = main.querySelector("#players-cards");
          if (cont) {
            cont.innerHTML = (list && list.length)
              ? buildPlayerCards(list)
              : "<div class=\"py-8 text-center text-slate-500 dark:text-slate-400 text-sm\">No players match this filter. Set your city in Profile to find players in your area.</div>";
            if (list && list.length) wirePlayerCardActions();
          }
        }
      });
    }
    main.querySelectorAll(".player-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        main.querySelectorAll(".player-filter").forEach((b) => {
          b.classList.remove("bg-primary", "text-slate-900", "font-semibold");
          b.classList.add("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "font-medium");
        });
        btn.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "font-medium");
        btn.classList.add("bg-primary", "text-slate-900", "font-semibold");
        const filter = btn.getAttribute("data-filter") || btn.textContent.trim();
        if (filter === "area") {
          const myCity = normalizeCity(currentUser.city) || normalizeCity((currentUser.location || "").split(",")[0]);
          runFindPeople(myCity ? { city: myCity } : {}, function (list) {
            players = list || [];
            applyPlayersList(players);
          });
        } else if (filter === "Beginner" || filter === "Intermediate" || filter === "Advanced" || filter === "Pro") {
          runFindPeople({ playerType: filter }, function (list) {
            const container = main.querySelector("#players-cards");
            if (container) {
              container.innerHTML = (list && list.length) ? buildPlayerCards(list) : "<div class=\"py-8 text-center text-slate-500 dark:text-slate-400 text-sm\">No players match this filter.</div>";
              if (list && list.length) wirePlayerCardActions();
            }
          });
        } else {
          runFindPeople({}, function (list) {
            players = list || [];
            applyPlayersList(players);
          });
        }
      });
    });
    var playersSearchInput = main.querySelector("input[placeholder*='Search by name']");
    if (playersSearchInput) {
      var searchTimeout = null;
      playersSearchInput.addEventListener("input", function () {
        var value = (playersSearchInput.value || "").trim();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          runFindPeople(value ? { searchText: value } : {}, function (list) {
            const container = main.querySelector("#players-cards");
            if (container) {
              container.innerHTML = (list && list.length) ? buildPlayerCards(list) : "<div class=\"py-8 text-center text-slate-500 dark:text-slate-400 text-sm\">No players match your search.</div>";
              if (list && list.length) wirePlayerCardActions();
            }
          });
        }, 300);
      });
    }
  }

  function render() {
    const { page, id } = getRoute();
    updateChatNavVisibility();
    if (page === "chat" && !isLoggedIn()) {
      renderChatLoginGate();
      return;
    }
    if (page === "home") renderHome();
    else if (page === "profile" && id) renderOtherProfile(id);
    else if (page === "profile") renderProfile();
    else if (page === "chat" && id && id.startsWith("dm-")) renderDM(id.slice(3));
    else if (page === "chat" && id) renderEventChat(id);
    else if (page === "chat") renderChatList();
    else if (page === "event" && id) renderEventDetails(id);
    else if (page === "courts") renderCourts();
    else if (page === "court" && id) renderCourtDetail(id);
    else if (page === "add-event") renderAddEvent();
    else if (page === "players") renderPlayers();
    else {
      window.location.hash = "home";
      renderHome();
    }
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("load", () => {
    if (typeof OneSignalService !== "undefined" && OneSignalService.init) {
      OneSignalService.init();
      if (isLoggedIn() && OneSignalService.setExternalUserId && OneSignalService.isConfigured()) {
        const u = getLoggedInUser();
        OneSignalService.setExternalUserId(u.email || u.profileId || "").catch(function () {});
      }
    }
    if (typeof FirebaseAuthService !== "undefined" && FirebaseAuthService.init) {
      FirebaseAuthService.init(
        function (errOrNothing) {
          if (typeof errOrNothing === "string") alert(errOrNothing);
          if (window.location.hash === "#profile" && typeof renderProfile === "function") renderProfile();
          syncLoggedInUserToSupabase().then(function () {
            loadCurrentUserProfileFromSupabase().then(render);
          });
        },
        function (user) {
          if (user) {
            syncLoggedInUserToSupabase().then(function () {
              loadCurrentUserProfileFromSupabase().then(render);
            });
          } else {
            currentUserProfile = null;
            profileLoadAttempted = false;
            lastProfileLoadError = null;
            render();
          }
        }
      );
    } else if (isLoggedIn()) {
      loadCurrentUserProfileFromSupabase().then(render);
    }
    if (!window.location.hash) window.location.hash = "home";
    render();
  });
})();
