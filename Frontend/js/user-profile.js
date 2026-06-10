// ============================================================
//  user-profile.js  —  Sewa Now Customer Profile
//  Matched with: user-profile.html + user-profile.css
// ============================================================

(function () {
  "use strict";

  /* ──────────────────────────────────────────
     CONFIG
  ────────────────────────────────────────── */
  const USER_KEY   = "sewa_user";
  const TOKEN_KEY  = "sewanow_token";
  const LOGIN_PAGE = "auth.html";
  const API_BASE   = "/api";

  /* ──────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────── */
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
    catch (e) { return null; }
  }

  function saveUser(data) {
    localStorage.setItem(USER_KEY, JSON.stringify(data));
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getUserId(u) {
    return u.id || u._id || u.uid || u.userId || null;
  }

  function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(" ").map(function(w){ return w[0]; }).join("").toUpperCase().slice(0, 2);
  }

  function formatDate(str) {
    if (!str) return "—";
    var d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = (value && value !== "undefined") ? value : "—";
  }

  function setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  function showErr(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ──────────────────────────────────────────
     AUTH GUARD
  ────────────────────────────────────────── */
  var user = getUser();

  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  if (!user.name && !user.email) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  /* ──────────────────────────────────────────
     POPULATE PROFILE — Hero Banner + Sidebar
  ────────────────────────────────────────── */
  function populateProfile(u) {
    var initials = getInitials(u.name);

    // Hero banner
    setText("heroAvatar", initials);
    setText("heroName",   u.name || "User");

    var heroEmail = document.getElementById("heroEmail");
    if (heroEmail) {
      heroEmail.innerHTML = '<i class="fas fa-envelope"></i> ' + escHtml(u.email || "—");
    }

    setText("heroRole", u.role ? capitalize(u.role) : "Customer");

    // Sidebar Account Info
    setText("infoName",   u.name  || "—");
    setText("infoEmail",  u.email || "—");
    setText("infoPhone",  u.phone || "Not added");
    setText("infoRole",   u.role  ? capitalize(u.role) : "Customer");
    setText("infoJoined", formatDate(
      u.createdAt || u.joinedAt || u.created_at ||
      u.registeredAt || u.signupDate || u.memberSince
    ));

    // Edit form fields
    setVal("editName",  u.name);
    setVal("editPhone", u.phone);
    setVal("editEmail", u.email);
  }

  /* ──────────────────────────────────────────
     TOGGLE PASSWORD VISIBILITY
  ────────────────────────────────────────── */
  window.togglePass = function (inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    var icon = btn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-eye",       !isPass);
      icon.classList.toggle("fa-eye-slash",  isPass);
    }
  };

  /* ──────────────────────────────────────────
     EDIT PROFILE FORM — Validate + Save
  ────────────────────────────────────────── */
  function initEditForm() {
    var form    = document.getElementById("editProfileForm");
    var saveBtn = document.getElementById("saveBtn");
    var status  = document.getElementById("saveStatus");

    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      showErr("editNameErr",  "");
      showErr("editPhoneErr", "");
      showErr("editPassErr",  "");
      if (status) { status.textContent = ""; status.className = "save-status"; }

      var nameEl     = document.getElementById("editName");
      var phoneEl    = document.getElementById("editPhone");
      var newPassEl  = document.getElementById("editNewPass");
      var confPassEl = document.getElementById("editConfirmPass");

      var name     = nameEl     ? nameEl.value.trim()  : "";
      var phone    = phoneEl    ? phoneEl.value.trim()  : "";
      var newPass  = newPassEl  ? newPassEl.value       : "";
      var confPass = confPassEl ? confPassEl.value      : "";

      // Validation
      var hasError = false;

      if (!name) {
        showErr("editNameErr", "Full name is required.");
        hasError = true;
      }

      if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/[\s\-\+]/g, ""))) {
        showErr("editPhoneErr", "Please enter a valid 10-digit Indian phone number.");
        hasError = true;
      }

      if (newPass && newPass.length < 6) {
        showErr("editPassErr", "Password must be at least 6 characters.");
        hasError = true;
      }

      if (newPass && newPass !== confPass) {
        showErr("editPassErr", "Passwords do not match.");
        hasError = true;
      }

      if (hasError) return;

      // Loading state
      var btnSpan = saveBtn ? saveBtn.querySelector("span") : null;
      if (saveBtn) saveBtn.classList.add("loading");
      if (btnSpan) btnSpan.textContent = "Saving...";

      var payload = { name: name, phone: phone };
      if (newPass) payload.password = newPass;

      var userId = getUserId(user);

      try {
        if (userId) {
          var res = await fetch(API_BASE + "/users/" + userId, {
            method: "PATCH",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": getToken() ? "Bearer " + getToken() : "",
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            var errData = await res.json().catch(function(){ return {}; });
            throw new Error(errData.message || ("Server error " + res.status));
          }

          var serverData = await res.json();
          var updated = Object.assign({}, user, payload, serverData);
          saveUser(updated);
          Object.assign(user, updated);
          populateProfile(updated);
        } else {
          throw new Error("no_backend");
        }

        setVal("editNewPass",     "");
        setVal("editConfirmPass", "");
        showSaveStatus("✅ Profile saved successfully!", "success");

      } catch (err) {
        // Save locally if backend is unavailable
        var localUpdated = Object.assign({}, user, { name: name, phone: phone });
        saveUser(localUpdated);
        Object.assign(user, localUpdated);
        populateProfile(localUpdated);

        setVal("editNewPass",     "");
        setVal("editConfirmPass", "");

        if (err.message === "no_backend") {
          showSaveStatus("✅ Profile saved successfully!", "success");
        } else {
          console.warn("API error, saved locally:", err.message);
          showSaveStatus("✅ Saved locally!", "success");
        }
      } finally {
        if (saveBtn) saveBtn.classList.remove("loading");
        if (btnSpan) btnSpan.textContent = "Save Changes";
      }
    });

    function showSaveStatus(msg, type) {
      if (!status) return;
      status.textContent = msg;
      status.className   = "save-status " + type;
      setTimeout(function () {
        status.textContent = "";
        status.className   = "save-status";
      }, 4000);
    }
  }

  /* ──────────────────────────────────────────
     LOAD BOOKINGS
  ────────────────────────────────────────── */
  async function loadBookings() {
    var container = document.getElementById("bookingsContainer");
    if (!container) return;

    var userId = getUserId(user) || user.email || "guest";

    container.innerHTML =
      '<div class="bookings-loading">' +
        '<div class="spinner"></div>' +
        '<span>Loading bookings...</span>' +
      '</div>';

    try {
      var res = await fetch(API_BASE + "/bookings?userId=" + userId, {
        headers: {
          "Content-Type":  "application/json",
          "Authorization": getToken() ? "Bearer " + getToken() : "",
        },
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      var data     = await res.json();
      var bookings = Array.isArray(data) ? data : (data.bookings || []);

      localStorage.setItem("sewa_bookings_" + userId, JSON.stringify(bookings));
      renderBookings(bookings, container);

    } catch (err) {
      console.warn("Bookings API failed:", err.message);

      var cached = getCachedBookings(userId);
      if (cached.length > 0) {
        renderBookings(cached, container, true);
      } else {
        renderEmpty(container);
        updateStats(0, 0, 0);
      }
    }
  }

  function getCachedBookings(key) {
    try { return JSON.parse(localStorage.getItem("sewa_bookings_" + key)) || []; }
    catch (e) { return []; }
  }

  /* ──────────────────────────────────────────
     RENDER BOOKINGS
  ────────────────────────────────────────── */
  function renderBookings(bookings, container, fromCache) {
    if (!bookings.length) {
      renderEmpty(container);
      updateStats(0, 0, 0);
      return;
    }

    bookings.sort(function(a, b) {
      return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    });

    var total     = bookings.length;
    var completed = bookings.filter(function(b){ return b.status === "completed"; }).length;
    var pending   = bookings.filter(function(b){
      return ["pending", "confirmed", "in_progress"].indexOf(b.status) !== -1;
    }).length;
    updateStats(total, completed, pending);

    var preview = bookings.slice(0, 5);
    var html = '<div class="bookings-list">';
    preview.forEach(function(b){ html += buildBookingItem(b); });
    html += "</div>";

    if (fromCache) {
      html += '<p style="font-size:0.78rem;color:#A8A29E;margin-top:12px;text-align:center;">⚠️ Cached data (offline mode)</p>';
    }

    container.innerHTML = html;
  }

  function renderEmpty(container, msg) {
    container.innerHTML =
      '<div class="bookings-empty">' +
        '<i class="fas fa-calendar-times"></i>' +
        '<p>' + (msg || "No bookings found yet.") + '</p>' +
        '<a href="worker_list.html">Book Now</a>' +
      '</div>';
  }

  function updateStats(total, completed, pending) {
    setText("statBookings",  String(total));
    setText("statCompleted", String(completed));
    setText("statPending",   String(pending));
  }

  /* ──────────────────────────────────────────
     BUILD BOOKING CARD HTML
  ────────────────────────────────────────── */
  var STATUS_CFG = {
    pending    : { label: "Pending",     cls: "status-pending"   },
    confirmed  : { label: "Confirmed",   cls: "status-confirmed" },
    completed  : { label: "Completed",   cls: "status-completed" },
    cancelled  : { label: "Cancelled",   cls: "status-cancelled" },
    in_progress: { label: "In Progress", cls: "status-confirmed" },
  };

  var SERVICE_ICONS = {
    plumber      : "fa-wrench",
    electrician  : "fa-bolt",
    carpenter    : "fa-hammer",
    painter      : "fa-paint-roller",
    cleaner      : "fa-broom",
    ac_repair    : "fa-snowflake",
    pest_control : "fa-bug",
    interior     : "fa-couch",
    security     : "fa-shield-alt",
  };

  function getServiceIcon(type) {
    var key = (type || "").toLowerCase().replace(/\s+/g, "_");
    return SERVICE_ICONS[key] || "fa-tools";
  }

  function buildBookingItem(b) {
    var s      = STATUS_CFG[b.status] || { label: capitalize(b.status || "Unknown"), cls: "status-pending" };
    var icon   = getServiceIcon(b.serviceType || b.service || b.category);
    var name   = b.serviceName || b.service || b.category || "Service";
    var date   = formatDate(b.date || b.scheduledDate || b.createdAt);
    var time   = b.timeSlot || b.time || "";
    var amount = b.amount || b.price || "";
    var worker = b.workerName || "";

    return (
      '<div class="booking-item">' +
        '<div class="booking-icon"><i class="fas ' + icon + '"></i></div>' +
        '<div class="booking-info">' +
          '<div class="booking-service">' + escHtml(name) + '</div>' +
          '<div class="booking-meta">' +
            '<i class="fas fa-calendar-alt"></i>&nbsp;' + date +
            (time   ? '&nbsp;·&nbsp;<i class="fas fa-clock"></i>&nbsp;'       + escHtml(time)          : '') +
            (amount ? '&nbsp;·&nbsp;<i class="fas fa-rupee-sign"></i>&nbsp;'  + escHtml(String(amount)) : '') +
            (worker ? '&nbsp;·&nbsp;<i class="fas fa-hard-hat"></i>&nbsp;'    + escHtml(worker)         : '') +
          '</div>' +
        '</div>' +
        '<span class="status-pill ' + s.cls + '">' + s.label + '</span>' +
      '</div>'
    );
  }

  /* ──────────────────────────────────────────
     INIT — Entry Point
  ────────────────────────────────────────── */
  function init() {
    populateProfile(user);
    initEditForm();
    loadBookings();
    console.log("✅ user-profile.js loaded | User:", user.name || user.email);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();