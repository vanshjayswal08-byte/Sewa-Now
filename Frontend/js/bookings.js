// ============================================================
//  bookings.js  —  Sewa Now My Bookings Page
//  Reads bookings from Firebase Firestore (primary)
//  Falls back to localStorage if Firebase is unavailable
// ============================================================

(function () {
    "use strict";

    /* ── CONFIG ── */
    var USER_KEY   = "sewa_user";
    var TOKEN_KEY  = "sewanow_token";
    var LOGIN_PAGE = "auth.html";

    /* Firebase config — must match booking.html */
    var FIREBASE_CONFIG = {
        apiKey            : "AIzaSyAC2z-W41mpwXUSTOqZd_4vfBoPyl4cvmk",
        authDomain        : "sewa-now.firebaseapp.com",
        projectId         : "sewa-now",
        storageBucket     : "sewa-now.firebasestorage.app",
        messagingSenderId : "516011205450",
        appId             : "1:516011205450:web:025c0cbdf18ae136b257b3"
    };

    /* ── HELPERS ── */
    function getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
        catch (e) { return null; }
    }

    function formatDate(str) {
        if (!str) return "—";
        var d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

    function getWorkerInitials(name) {
        if (!name) return "W";
        return name.trim().split(" ").map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
    }

    /* ── AUTH GUARD ── */
    var user = getUser();
    if (!user || (!user.name && !user.email)) {
        window.location.href = LOGIN_PAGE;
        return;
    }

    /* Redirect workers to their own dashboard */
    if (user.role === "worker") {
        window.location.href = "dashboard.html";
        return;
    }

    /* ── STATE ── */
    var allBookings  = [];
    var activeFilter = "all";
    var searchQuery  = "";
    var sortOrder    = "newest";

    /* ── STATUS CONFIG ── */
    var STATUS_CFG = {
        pending     : { label: "Pending",     badgeCls: "badge-pending",     icon: "fa-clock"        },
        confirmed   : { label: "Confirmed",   badgeCls: "badge-confirmed",   icon: "fa-check-circle" },
        completed   : { label: "Completed",   badgeCls: "badge-completed",   icon: "fa-check-double" },
        cancelled   : { label: "Cancelled",   badgeCls: "badge-cancelled",   icon: "fa-times-circle" },
        in_progress : { label: "In Progress", badgeCls: "badge-in_progress", icon: "fa-spinner"      }
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
        security     : "fa-shield-alt"
    };

    function getServiceIcon(type) {
        var key = (type || "").toLowerCase().replace(/\s+/g, "_");
        return SERVICE_ICONS[key] || "fa-tools";
    }

    /* ── POPULATE HERO ── */
    function populateHero() {
        var greeting = document.getElementById("heroGreeting");
        if (greeting) {
            greeting.textContent = "Welcome back, " + (user.name || "there") + "! Here are all your bookings.";
        }
    }

    /* ── UPDATE SUMMARY PILLS ── */
    function updatePills(bookings) {
        var total     = bookings.length;
        var completed = bookings.filter(function (b) { return b.status === "completed"; }).length;
        var pending   = bookings.filter(function (b) {
            return ["pending", "confirmed", "in_progress"].indexOf(b.status) !== -1;
        }).length;
        var cancelled = bookings.filter(function (b) { return b.status === "cancelled"; }).length;

        function set(id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = String(val);
        }

        set("pillTotal",     total);
        set("pillCompleted", completed);
        set("pillPending",   pending);
        set("pillCancelled", cancelled);
    }

    /* ── GET ALL LOCAL BOOKINGS (fallback) ── */
    function getAllLocalBookings() {
        var email = user.email || "";
        var found = {};

        function addItems(raw) {
            if (!raw) return;
            try {
                var parsed = JSON.parse(raw);
                var items  = Array.isArray(parsed) ? parsed : [parsed];
                items.forEach(function (b) {
                    if (b && typeof b === "object") {
                        var key = b.id || b._id || b.bookingId || JSON.stringify(b);
                        found[key] = b;
                    }
                });
            } catch (e) {}
        }

        if (email) addItems(localStorage.getItem("sewa_bookings_" + email));
        addItems(localStorage.getItem("sewanow_bookings"));

        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (!k) continue;
            if (/^(sewa_booking_|booking_|sewanow_booking_)/i.test(k)) {
                addItems(localStorage.getItem(k));
            }
        }

        addItems(localStorage.getItem("last_booking"));
        addItems(localStorage.getItem("bookings"));

        /* Filter bookings that belong to this user */
        var list = Object.values(found).filter(function (b) {
            var bEmail = b.userEmail || b.email || b.customer_email || "";
            if (!bEmail) return true;
            if (email && bEmail.toLowerCase() === email.toLowerCase()) return true;
            return false;
        });

        return list;
    }

    /* ── LOAD BOOKINGS from Firebase Firestore ── */
    function loadBookings() {
        var container = document.getElementById("bookingsContainer");
        if (!container) return;

        showLoading(container);

        /* Dynamically load Firebase SDK and query Firestore */
        Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        ])
        .then(function (modules) {
            var firebaseApp = modules[0];
            var firestore   = modules[1];

            /* Reuse existing Firebase app if already initialized */
            var app;
            try {
                app = firebaseApp.getApp();
            } catch (e) {
                app = firebaseApp.initializeApp(FIREBASE_CONFIG);
            }

            var db = firestore.getFirestore(app);

            /* Query bookings where userEmail matches the logged-in user */
            var bookingsRef = firestore.collection(db, "bookings");
            var userEmail   = user.email || "";

            var q = firestore.query(
                bookingsRef,
                firestore.where("userEmail", "==", userEmail)
            );

            return firestore.getDocs(q);
        })
        .then(function (snapshot) {
            var firestoreBookings = [];

            snapshot.forEach(function (docSnap) {
                var data        = docSnap.data();
                data.id         = docSnap.id;
                data.bookingId  = docSnap.id;

                /* Normalize createdAt from Firestore Timestamp to ISO string */
                if (data.createdAt && typeof data.createdAt.toDate === "function") {
                    data.createdAt = data.createdAt.toDate().toISOString();
                }

                firestoreBookings.push(data);
            });

            /* Also merge any localStorage bookings not yet in Firestore */
            var localBookings = getAllLocalBookings();
            var merged        = mergeBookings(firestoreBookings, localBookings);

            allBookings = merged;
            updatePills(merged);
            renderFiltered();
        })
        .catch(function (err) {
            console.warn("Firebase load failed, falling back to localStorage:", err);

            var localBookings = getAllLocalBookings();
            if (localBookings.length > 0) {
                allBookings = localBookings;
                updatePills(localBookings);
                renderFiltered();
                showCacheNote(container);
            } else {
                showEmpty(container);
                updatePills([]);
            }
        });
    }

    /* ── MERGE Firebase + localStorage bookings (dedup by id) ── */
    function mergeBookings(firestoreList, localList) {
        var map = {};

        firestoreList.forEach(function (b) {
            var key = b.id || b._id || b.bookingId;
            if (key) map[key] = b;
        });

        localList.forEach(function (b) {
            var key = b.id || b._id || b.bookingId;
            /* Only add local booking if it doesn't already exist in Firestore */
            if (key && !map[key]) {
                map[key] = b;
            } else if (!key) {
                map["local_" + (b.createdAt || b.date || Math.random())] = b;
            }
        });

        return Object.values(map);
    }

    /* ── RENDER FILTERED LIST ── */
    function renderFiltered() {
        var container = document.getElementById("bookingsContainer");
        if (!container) return;

        var filtered = allBookings.slice();

        /* Apply status filter */
        if (activeFilter !== "all") {
            filtered = filtered.filter(function (b) {
                if (activeFilter === "pending") {
                    return ["pending", "confirmed", "in_progress"].indexOf(b.status) !== -1;
                }
                return b.status === activeFilter;
            });
        }

        /* Apply search filter */
        if (searchQuery.trim()) {
            var q = searchQuery.toLowerCase();
            filtered = filtered.filter(function (b) {
                var name   = (b.serviceName || b.service || b.category || b.service_type || b.serviceType || "").toLowerCase();
                var worker = (b.workerName  || b.worker_name || b.worker_email || "").toLowerCase();
                return name.includes(q) || worker.includes(q);
            });
        }

        /* Apply sort */
        filtered.sort(function (a, b) {
            var da = new Date(a.createdAt || a.date || a.created_at || 0);
            var db = new Date(b.createdAt || b.date || b.created_at || 0);
            return sortOrder === "oldest" ? da - db : db - da;
        });

        if (!filtered.length) {
            container.innerHTML =
                '<div class="no-results">' +
                    '<i class="fas fa-search"></i>' +
                    '<p>No bookings found for the selected filter.</p>' +
                '</div>';
            return;
        }

        var html = '<div class="bookings-list">';
        filtered.forEach(function (b, i) {
            html += buildBookingCard(b, i);
        });
        html += '</div>';
        container.innerHTML = html;

        /* Attach cancel button listeners */
        container.querySelectorAll(".btn-cancel-booking").forEach(function (btn) {
            btn.addEventListener("click", function () {
                cancelBooking(btn.dataset.id, btn);
            });
        });
    }

    /* ── BUILD BOOKING CARD ── */
    function buildBookingCard(b, index) {
        var s      = STATUS_CFG[b.status] || { label: capitalize(b.status || "Unknown"), badgeCls: "badge-pending", icon: "fa-question" };
        var icon   = getServiceIcon(b.service_type || b.serviceType || b.service || b.category);
        var name   = b.service_type || b.serviceType || b.serviceName || b.service || b.category || "Service";
        var date   = b.date || formatDate(b.createdAt || b.created_at);
        var time   = b.time_slot || b.timeSlot || b.time || "—";
        var addr   = b.address || b.location || "—";
        var worker = b.worker_name || b.workerName || b.worker_email || "";
        var bookId = b.bookingId || b.booking_id || b.id || b._id || ("BK" + (index + 1));
        var id     = b.id || b._id || b.bookingId || b.booking_id || "";

        var canCancel = ["pending", "confirmed"].indexOf(b.status) !== -1;

        var workerHtml = worker
            ? '<div class="booking-worker-info">' +
                  '<div class="worker-avatar-sm">' + getWorkerInitials(worker) + '</div>' +
                  '<span class="worker-name-sm">' + escHtml(worker) + '</span>' +
              '</div>'
            : '<div class="booking-worker-info"><span style="font-size:0.8rem;color:#A8A29E;">No worker assigned yet</span></div>';

        var actionsHtml =
            '<div class="booking-card-actions">' +
                (canCancel
                    ? '<button class="btn-action btn-action-cancel btn-cancel-booking" data-id="' + escHtml(String(id)) + '">' +
                          '<i class="fas fa-times"></i> Cancel' +
                      '</button>'
                    : '') +
                '<a href="worker_list.html" class="btn-action btn-action-view">' +
                    '<i class="fas fa-plus"></i> Book Again' +
                '</a>' +
            '</div>';

        return (
            '<div class="booking-card" style="animation-delay:' + (index * 0.05) + 's">' +
                '<div class="booking-card-header">' +
                    '<div class="booking-service-icon"><i class="fas ' + icon + '"></i></div>' +
                    '<div class="booking-card-title">' +
                        '<h3>' + escHtml(name) + '</h3>' +
                        '<span class="booking-card-id">#' + escHtml(String(bookId)) + '</span>' +
                    '</div>' +
                    '<span class="booking-status-badge ' + s.badgeCls + '">' +
                        '<i class="fas ' + s.icon + '"></i> ' + s.label +
                    '</span>' +
                '</div>' +
                '<div class="booking-card-details">' +
                    buildDetailItem("fa-calendar-alt",   "Date",    date) +
                    buildDetailItem("fa-clock",          "Time",    time) +
                    buildDetailItem("fa-map-marker-alt", "Address", addr) +
                '</div>' +
                '<div class="booking-card-footer">' +
                    workerHtml +
                    actionsHtml +
                '</div>' +
            '</div>'
        );
    }

    function buildDetailItem(icon, label, value) {
        return (
            '<div class="booking-detail-item">' +
                '<div class="detail-icon-wrap"><i class="fas ' + icon + '"></i></div>' +
                '<div class="detail-text">' +
                    '<span class="detail-label">' + label + '</span>' +
                    '<span class="detail-value">' + escHtml(String(value)) + '</span>' +
                '</div>' +
            '</div>'
        );
    }

    /* ── CANCEL BOOKING ── */
    function cancelBooking(bookingId, btn) {
        if (!bookingId) return;
        if (!confirm("Are you sure you want to cancel this booking?")) return;

        btn.disabled    = true;
        btn.textContent = "Cancelling...";

        /* Try to update status in Firestore */
        Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        ])
        .then(function (modules) {
            var firebaseApp = modules[0];
            var firestore   = modules[1];

            var app;
            try { app = firebaseApp.getApp(); }
            catch (e) { app = firebaseApp.initializeApp(FIREBASE_CONFIG); }

            var db      = firestore.getFirestore(app);
            var docRef  = firestore.doc(db, "bookings", bookingId);

            return firestore.updateDoc(docRef, { status: "cancelled" });
        })
        .then(function () {
            updateLocalCancelStatus(bookingId);
        })
        .catch(function (err) {
            console.warn("Firestore cancel failed, updating locally:", err);
            updateLocalCancelStatus(bookingId);
        });
    }

    function updateLocalCancelStatus(bookingId) {
        allBookings = allBookings.map(function (b) {
            if ((b.id || b._id || b.bookingId || b.booking_id) === bookingId) {
                return Object.assign({}, b, { status: "cancelled" });
            }
            return b;
        });
        updatePills(allBookings);
        renderFiltered();
    }

    /* ── UI HELPERS ── */
    function showLoading(container) {
        container.innerHTML =
            '<div class="bookings-loading">' +
                '<div class="b-spinner"></div>' +
                '<span>Loading your bookings...</span>' +
            '</div>';
    }

    function showEmpty(container) {
        container.innerHTML =
            '<div class="bookings-empty-state">' +
                '<i class="fas fa-calendar-times empty-icon"></i>' +
                '<h3>No Bookings Yet</h3>' +
                '<p>You have not booked any service yet. Find a worker and get started!</p>' +
                '<a href="worker_list.html">Find Workers</a>' +
            '</div>';
    }

    function showCacheNote(container) {
        var note       = document.createElement("p");
        note.style.cssText = "font-size:0.78rem;color:#A8A29E;text-align:center;margin-top:12px;";
        note.textContent   = "Showing locally saved bookings (offline mode)";
        container.appendChild(note);
    }

    /* ── FILTER BUTTONS ── */
    function initFilters() {
        var btns = document.querySelectorAll(".filter-btn");
        btns.forEach(function (btn) {
            btn.addEventListener("click", function () {
                btns.forEach(function (b) { b.classList.remove("active"); });
                btn.classList.add("active");
                activeFilter = btn.dataset.filter;
                renderFiltered();
            });
        });
    }

    /* ── SEARCH ── */
    function initSearch() {
        var input = document.getElementById("bookingSearch");
        if (!input) return;
        input.addEventListener("input", function () {
            searchQuery = input.value;
            renderFiltered();
        });
    }

    /* ── SORT ── */
    function initSort() {
        var select = document.getElementById("sortSelect");
        if (!select) return;
        select.addEventListener("change", function () {
            sortOrder = select.value;
            renderFiltered();
        });
    }

    /* ── INIT ── */
    function init() {
        populateHero();
        initFilters();
        initSearch();
        initSort();
        loadBookings();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();