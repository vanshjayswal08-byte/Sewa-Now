/* =====================================================
   SEWA NOW — booking.js
   Advanced Multi-Step Booking Form
   Steps: Details → Date/Time → Address → Review
   ===================================================== */

var BookingApp = (function () {

    /* ── State ── */
    var state = {
        currentStep : 1,
        totalSteps  : 4,
        worker      : null,
        form        : {
            name        : '',
            phone       : '',
            email       : '',
            serviceType : '',
            note        : '',
            date        : null,
            dateStr     : '',
            time        : '',
            addrLine1   : '',
            addrLine2   : '',
            city        : '',
            pin         : '',
            payment     : 'cash'
        }
    };

    /* ── Category → service chip options ── */
    var SERVICE_OPTIONS = {
        'plumber'     : ['Pipe Leakage', 'Drain Blockage', 'Water Heater', 'Bathroom Fitting', 'New Connection'],
        'electrician' : ['Wiring Work', 'Fan/Light Fitting', 'Inverter Setup', 'Short Circuit Fix', 'New Installation'],
        'carpenter'   : ['Furniture Repair', 'Door/Window Fitting', 'Wood Polishing', 'Almirah Work', 'Custom Furniture'],
        'painter'     : ['Interior Painting', 'Exterior Painting', 'Texture Work', 'Waterproofing', 'Wood Painting'],
        'cleaner'     : ['Home Deep Clean', 'Sofa/Carpet Clean', 'Kitchen Clean', 'Bathroom Sanitize', 'Post-Renovation'],
        'ac'          : ['AC Service', 'Gas Refilling', 'AC Installation', 'Cooling Issue', 'PCB Repair'],
        'ac repair'   : ['AC Service', 'Gas Refilling', 'AC Installation', 'Cooling Issue', 'PCB Repair'],
        'interior'    : ['Interior Design', 'False Ceiling', 'Modular Kitchen', 'Wallpaper Work', 'Space Planning'],
        'security'    : ['CCTV Install', 'Security Audit', 'Lock/Key Work', 'Alarm Setup', 'Night Patrolling'],
        'default'     : ['Standard Service', 'Emergency Service', 'Annual Maintenance', 'Consultation', 'Full Package']
    };

    var SERVICE_ICONS = {
        'Pipe Leakage'        : 'fa-tint-slash',
        'Drain Blockage'      : 'fa-ban',
        'Water Heater'        : 'fa-fire',
        'Bathroom Fitting'    : 'fa-bath',
        'New Connection'      : 'fa-plus',
        'Wiring Work'         : 'fa-plug',
        'Fan/Light Fitting'   : 'fa-lightbulb',
        'Inverter Setup'      : 'fa-bolt',
        'Short Circuit Fix'   : 'fa-exclamation-triangle',
        'New Installation'    : 'fa-tools',
        'Furniture Repair'    : 'fa-couch',
        'Door/Window Fitting' : 'fa-door-open',
        'Wood Polishing'      : 'fa-star',
        'Almirah Work'        : 'fa-box',
        'Custom Furniture'    : 'fa-hammer',
        'Interior Painting'   : 'fa-paint-roller',
        'Exterior Painting'   : 'fa-home',
        'Texture Work'        : 'fa-spray-can',
        'Waterproofing'       : 'fa-shield-alt',
        'Wood Painting'       : 'fa-tree',
        'Home Deep Clean'     : 'fa-broom',
        'Sofa/Carpet Clean'   : 'fa-couch',
        'Kitchen Clean'       : 'fa-utensils',
        'Bathroom Sanitize'   : 'fa-toilet',
        'Post-Renovation'     : 'fa-building',
        'AC Service'          : 'fa-snowflake',
        'Gas Refilling'       : 'fa-gas-pump',
        'AC Installation'     : 'fa-wind',
        'Cooling Issue'       : 'fa-thermometer-half',
        'PCB Repair'          : 'fa-microchip',
        'Interior Design'     : 'fa-palette',
        'False Ceiling'       : 'fa-layer-group',
        'Modular Kitchen'     : 'fa-utensils',
        'Wallpaper Work'      : 'fa-image',
        'Space Planning'      : 'fa-drafting-compass',
        'CCTV Install'        : 'fa-camera',
        'Security Audit'      : 'fa-user-shield',
        'Lock/Key Work'       : 'fa-key',
        'Alarm Setup'         : 'fa-bell',
        'Night Patrolling'    : 'fa-moon',
        'Standard Service'    : 'fa-tools',
        'Emergency Service'   : 'fa-ambulance',
        'Annual Maintenance'  : 'fa-calendar-check',
        'Consultation'        : 'fa-comments',
        'Full Package'        : 'fa-star'
    };

    /* ── Calendar State ── */
    var calState = {
        viewYear  : new Date().getFullYear(),
        viewMonth : new Date().getMonth(),
        selected  : null
    };

    /* ── Time Slots ── */
    var ALL_SLOTS = [
        '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
        '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
        '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'
    ];

    /* Some slots randomly marked as booked for realism */
    var BOOKED_SLOTS = ['9:00 AM', '12:00 PM', '5:00 PM'];

    /* Month names */
    var MONTHS     = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
    var DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    /* Payment label map */
    var PAY_LABELS = {
        'cash'   : 'Cash on Service',
        'upi'    : 'UPI / GPay',
        'online' : 'Online Payment'
    };

    /* ── localStorage key used by bookings.js ── */
    var USER_KEY = 'sewa_user';

    /* ── Helper: get currently logged-in user from localStorage ── */
    function _getLoggedInUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY)) || null;
        } catch (e) {
            return null;
        }
    }

    /* ── Save booking to localStorage so bookings.js can read it ── */
    function _saveBookingToLocalStorage(bookingData) {
        try {
            var email = bookingData.userEmail || '';

            /* 1. Save to per-email key: sewa_bookings_{email} */
            if (email) {
                var emailKey  = 'sewa_bookings_' + email;
                var existing  = [];
                try { existing = JSON.parse(localStorage.getItem(emailKey)) || []; } catch (e) { existing = []; }
                if (!Array.isArray(existing)) existing = [];
                existing.unshift(bookingData);
                localStorage.setItem(emailKey, JSON.stringify(existing));
            }

            /* 2. Save to global sewanow_bookings key as well */
            var globalKey      = 'sewanow_bookings';
            var globalExisting = [];
            try { globalExisting = JSON.parse(localStorage.getItem(globalKey)) || []; } catch (e) { globalExisting = []; }
            if (!Array.isArray(globalExisting)) globalExisting = [];
            globalExisting.unshift(bookingData);
            localStorage.setItem(globalKey, JSON.stringify(globalExisting));

            /* 3. Always overwrite last_booking for quick access */
            localStorage.setItem('last_booking', JSON.stringify(bookingData));

        } catch (e) {
            console.error('Failed to save booking to localStorage:', e);
        }
    }

    /* ════════════════════════════
       INIT
    ════════════════════════════ */
    function init(workerData) {
        state.worker = workerData;

        var backLink = document.getElementById('backToProfile');
        if (backLink) backLink.href = 'profile.html?id=' + workerData.id;

        _initSummaryCard();
        _initServiceChips();
        _initCalendar();
        _initPaymentOptions();
        _initHamburger();
        _updateProgress();
        _updateSummary();
    }

    /* ════════════════════════════
       SUMMARY CARD INIT
    ════════════════════════════ */
    function _initSummaryCard() {
        var w = state.worker;

        var name     = _f(w, 'name', 'Worker');
        var initials = name.trim().split(/\s+/).map(function (p) { return p[0] || ''; }).join('').toUpperCase().slice(0, 2) || '??';
        var rawCat   = (_f(w, 'category', 'service')).toLowerCase().trim();
        var catLabel = _f(w, 'categoryLabel', '') || _capitalize(rawCat);
        var rating   = parseFloat(_f(w, 'rating', 0)) || 0;
        var reviews  = parseInt(_f(w, 'reviews', 0)) || 0;
        var price    = parseFloat(_f(w, 'price', 0)) || 0;

        _setText('sumAvatar',    initials);
        _setText('sumName',      name);
        _setHTML('sumCategory',  '<i class="fas fa-tools"></i> ' + catLabel);
        _setHTML('sumStars',     _renderStars(rating));
        _setText('sumRatingVal', rating.toFixed(1));
        _setText('sumReviews',   '(' + reviews + ' reviews)');
        _setText('sumPriceBase',  '₹' + price);
        _setText('sumPriceTotal', '₹' + price);
    }

    /* ════════════════════════════
       SERVICE CHIPS
    ════════════════════════════ */
    function _initServiceChips() {
        var rawCat  = (_f(state.worker, 'category', 'default')).toLowerCase().trim();
        var options = SERVICE_OPTIONS[rawCat] || SERVICE_OPTIONS['default'];
        var wrap    = document.getElementById('serviceChips');
        if (!wrap) return;

        wrap.innerHTML = options.map(function (opt) {
            var icon = SERVICE_ICONS[opt] || 'fa-tools';
            return '<div class="bk-chip" data-val="' + opt + '">' +
                       '<i class="fas ' + icon + '"></i>' + opt +
                   '</div>';
        }).join('');

        wrap.querySelectorAll('.bk-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                wrap.querySelectorAll('.bk-chip').forEach(function (c) { c.classList.remove('selected'); });
                chip.classList.add('selected');
                state.form.serviceType = chip.getAttribute('data-val');
                _clearError('errServiceType');
                _updateSummaryField('sumService', state.form.serviceType);
            });
        });
    }

    /* ════════════════════════════
       CALENDAR
    ════════════════════════════ */
    function _initCalendar() {
        document.getElementById('calPrev').addEventListener('click', function () {
            calState.viewMonth--;
            if (calState.viewMonth < 0) { calState.viewMonth = 11; calState.viewYear--; }
            _renderCalendar();
        });
        document.getElementById('calNext').addEventListener('click', function () {
            calState.viewMonth++;
            if (calState.viewMonth > 11) { calState.viewMonth = 0; calState.viewYear++; }
            _renderCalendar();
        });
        _renderCalendar();
        _renderTimeSlots();
    }

    function _renderCalendar() {
        var year  = calState.viewYear;
        var month = calState.viewMonth;
        var today = new Date(); today.setHours(0, 0, 0, 0);

        document.getElementById('calMonthYear').textContent = MONTHS[month] + ' ' + year;

        var firstDay  = new Date(year, month, 1).getDay();
        var daysInMon = new Date(year, month + 1, 0).getDate();
        var html      = '';

        for (var e = 0; e < firstDay; e++) {
            html += '<div class="bk-cal-day empty"></div>';
        }

        for (var d = 1; d <= daysInMon; d++) {
            var thisDate = new Date(year, month, d);
            thisDate.setHours(0, 0, 0, 0);

            var isPast   = thisDate < today;
            var isToday  = thisDate.getTime() === today.getTime();
            var isSel    = calState.selected && thisDate.getTime() === calState.selected.getTime();
            var isSunday = thisDate.getDay() === 0;

            var cls = 'bk-cal-day';
            if (isPast || isSunday) cls += ' disabled';
            if (isToday)            cls += ' today';
            if (isSel)              cls += ' selected';

            html += '<div class="' + cls + '" data-date="' + thisDate.toISOString() + '">' + d + '</div>';
        }

        var grid = document.getElementById('calGrid');
        grid.innerHTML = html;

        grid.querySelectorAll('.bk-cal-day:not(.disabled):not(.empty)').forEach(function (el) {
            el.addEventListener('click', function () {
                var dt = new Date(el.getAttribute('data-date'));
                calState.selected  = dt;
                state.form.date    = dt;
                state.form.dateStr = DAYS_SHORT[dt.getDay()] + ', ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear();

                _renderCalendar();
                _renderTimeSlots();
                _clearError('errDate');
                document.getElementById('selectedDateLabel').textContent = '— ' + state.form.dateStr;
                _updateSummaryField('sumDate', state.form.dateStr);
            });
        });
    }

    function _renderTimeSlots() {
        var wrap = document.getElementById('timeSlots');
        if (!wrap) return;

        wrap.innerHTML = ALL_SLOTS.map(function (slot) {
            var isBooked = BOOKED_SLOTS.indexOf(slot) !== -1;
            var isSel    = state.form.time === slot;
            var cls      = 'bk-slot' + (isBooked ? ' slot-booked' : '') + (isSel ? ' selected' : '');
            return '<div class="' + cls + '" data-time="' + slot + '">' +
                       slot +
                       (isBooked ? '<span class="bk-slot-hint">Booked</span>' : '') +
                   '</div>';
        }).join('');

        wrap.querySelectorAll('.bk-slot:not(.slot-booked)').forEach(function (el) {
            el.addEventListener('click', function () {
                wrap.querySelectorAll('.bk-slot').forEach(function (s) { s.classList.remove('selected'); });
                el.classList.add('selected');
                state.form.time = el.getAttribute('data-time');
                _clearError('errTime');
                _updateSummaryField('sumTime', state.form.time);
            });
        });
    }

    /* ════════════════════════════
       PAYMENT OPTIONS
    ════════════════════════════ */
    function _initPaymentOptions() {
        document.querySelectorAll('.bk-pay-opt').forEach(function (opt) {
            opt.addEventListener('click', function () {
                document.querySelectorAll('.bk-pay-opt').forEach(function (o) { o.classList.remove('selected'); });
                opt.classList.add('selected');
                var val = opt.getAttribute('data-val');
                opt.querySelector('input[type="radio"]').checked = true;
                state.form.payment = val;
                _updateSummaryField('sumPayment', PAY_LABELS[val] || val);
            });
        });
    }

    /* ════════════════════════════
       STEP NAVIGATION
    ════════════════════════════ */
    function nextStep() {
        if (!_validateStep(state.currentStep)) return;
        _collectStep(state.currentStep);

        if (state.currentStep === state.totalSteps) return;

        var curDot = document.querySelector('.bk-step[data-step="' + state.currentStep + '"]');
        if (curDot) { curDot.classList.remove('active'); curDot.classList.add('done'); }

        var lines = document.querySelectorAll('.bk-step-line');
        if (lines[state.currentStep - 1]) lines[state.currentStep - 1].classList.add('done');

        state.currentStep++;
        _showStep(state.currentStep);
        _updateProgress();

        if (state.currentStep === 4) _buildReview();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function prevStep() {
        if (state.currentStep <= 1) return;

        var curDot = document.querySelector('.bk-step[data-step="' + state.currentStep + '"]');
        if (curDot) curDot.classList.remove('active');

        var prevDot = document.querySelector('.bk-step[data-step="' + (state.currentStep - 1) + '"]');
        if (prevDot) prevDot.classList.remove('done');

        var lines = document.querySelectorAll('.bk-step-line');
        if (lines[state.currentStep - 2]) lines[state.currentStep - 2].classList.remove('done');

        state.currentStep--;
        _showStep(state.currentStep);
        _updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function goToStep(n) {
        if (n < 1 || n > state.totalSteps) return;
        if (n < state.currentStep) {
            while (state.currentStep > n) prevStep();
        }
    }

    function _showStep(n) {
        document.querySelectorAll('.bk-panel').forEach(function (p) { p.classList.remove('active'); });
        var panel = document.getElementById('step' + n);
        if (panel) panel.classList.add('active');

        var dot = document.querySelector('.bk-step[data-step="' + n + '"]');
        if (dot) dot.classList.add('active');
    }

    function _updateProgress() {
        var pct  = (state.currentStep / state.totalSteps) * 100;
        var fill = document.getElementById('progressFill');
        if (fill) fill.style.width = pct + '%';
    }

    /* ════════════════════════════
       COLLECT STEP DATA
    ════════════════════════════ */
    function _collectStep(step) {
        if (step === 1) {
            state.form.name  = _val('custName');
            state.form.phone = _val('custPhone');
            state.form.email = _val('custEmail');
            state.form.note  = _val('custNote');
            _updateSummaryField('sumService', state.form.serviceType || '—');
        }
        if (step === 3) {
            state.form.addrLine1 = _val('addrLine1');
            state.form.addrLine2 = _val('addrLine2');
            state.form.city      = _val('addrCity');
            state.form.pin       = _val('addrPin');

            var addrDisplay = state.form.addrLine1 +
                (state.form.addrLine2 ? ', ' + state.form.addrLine2 : '') +
                ', ' + state.form.city;
            _updateSummaryField('sumAddress', addrDisplay);
        }
    }

    /* ════════════════════════════
       VALIDATION
    ════════════════════════════ */
    function _validateStep(step) {
        var ok = true;

        if (step === 1) {
            if (!_val('custName').trim()) {
                _showError('errCustName', 'Please enter your full name');
                _addErrorClass('custName'); ok = false;
            } else _clearError('errCustName', 'custName');

            var phone = _val('custPhone').replace(/\s/g, '');
            if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) {
                _showError('errCustPhone', 'Enter a valid 10-digit mobile number');
                _addErrorClass('bk-phone-wrap'); ok = false;
            } else _clearError('errCustPhone');

            if (!state.form.serviceType) {
                _showError('errServiceType', 'Please select a service type');
                ok = false;
            } else _clearError('errServiceType');
        }

        if (step === 2) {
            if (!state.form.date) {
                _showError('errDate', 'Please select a date');
                ok = false;
            } else _clearError('errDate');

            if (!state.form.time) {
                _showError('errTime', 'Please select a time slot');
                ok = false;
            } else _clearError('errTime');
        }

        if (step === 3) {
            if (!_val('addrLine1').trim()) {
                _showError('errAddr1', 'Please enter your address');
                _addErrorClass('addrLine1'); ok = false;
            } else _clearError('errAddr1', 'addrLine1');

            if (!_val('addrCity').trim()) {
                _showError('errCity', 'Please enter your city');
                _addErrorClass('addrCity'); ok = false;
            } else _clearError('errCity', 'addrCity');

            var pin = _val('addrPin').trim();
            if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
                _showError('errPin', 'Enter a valid 6-digit PIN code');
                _addErrorClass('addrPin'); ok = false;
            } else _clearError('errPin', 'addrPin');
        }

        if (step === 4) {
            var terms = document.getElementById('agreeTerms');
            if (!terms || !terms.checked) {
                _showError('errTerms', 'Please accept the terms and conditions');
                ok = false;
            } else _clearError('errTerms');
        }

        return ok;
    }

    /* ════════════════════════════
       REVIEW STEP BUILD
    ════════════════════════════ */
    function _buildReview() {
        var w    = state.worker;
        var f    = state.form;
        var name = _f(w, 'name', 'Worker');

        var sections = [
            {
                title : '<i class="fas fa-user"></i> Your Details',
                rows  : [
                    { key: 'Name',         val: f.name               },
                    { key: 'Phone',        val: '+91 ' + f.phone     },
                    { key: 'Email',        val: f.email || 'Not provided' },
                    { key: 'Service Type', val: f.serviceType        },
                    { key: 'Notes',        val: f.note || 'None'     }
                ],
                edit: 1
            },
            {
                title : '<i class="fas fa-calendar-alt"></i> Date & Time',
                rows  : [
                    { key: 'Date', val: f.dateStr },
                    { key: 'Time', val: f.time    }
                ],
                edit: 2
            },
            {
                title : '<i class="fas fa-map-marker-alt"></i> Address',
                rows  : [
                    { key: 'Address', val: f.addrLine1 + (f.addrLine2 ? ', ' + f.addrLine2 : '') },
                    { key: 'City',    val: f.city },
                    { key: 'PIN',     val: f.pin  }
                ],
                edit: 3
            },
            {
                title : '<i class="fas fa-wallet"></i> Payment',
                rows  : [
                    { key: 'Method',  val: PAY_LABELS[f.payment] || f.payment },
                    { key: 'Worker',  val: name                                },
                    { key: 'Charges', val: '₹' + (_f(w, 'price', 0) || 0)    }
                ],
                edit: null
            }
        ];

        var html = sections.map(function (sec) {
            var editBtn = sec.edit
                ? '<span class="bk-review-edit" onclick="BookingApp.goToStep(' + sec.edit + ')"><i class="fas fa-pencil-alt"></i> Edit</span>'
                : '';
            var rows = sec.rows.map(function (r) {
                return '<div class="bk-review-row">' +
                           '<span>' + r.key + '</span>' +
                           '<span>' + (r.val || '—') + '</span>' +
                       '</div>';
            }).join('');
            return '<div class="bk-review-section">' +
                       '<div class="bk-review-section-title">' + sec.title + editBtn + '</div>' +
                       rows +
                   '</div>';
        }).join('');

        var el = document.getElementById('reviewGrid');
        if (el) el.innerHTML = html;
    }

    /* ════════════════════════════
       SUBMIT BOOKING
    ════════════════════════════ */
    function submitBooking() {
        if (!_validateStep(4)) return;
        _collectStep(4);

        var btn     = document.getElementById('confirmBtn');
        var btnText = btn.querySelector('.bk-btn-text');
        var btnLoad = btn.querySelector('.bk-btn-loading');

        btn.disabled              = true;
        btnText.style.display     = 'none';
        btnLoad.style.display     = 'flex';

        var w = state.worker;
        var f = state.form;

        /* Get logged-in user details from localStorage */
        var loggedInUser  = _getLoggedInUser();
        var loggedInUid   = loggedInUser && loggedInUser.uid   ? loggedInUser.uid   : '';
        var loggedInEmail = loggedInUser && loggedInUser.email ? loggedInUser.email : (f.email || '');
        var loggedInName  = loggedInUser && loggedInUser.name  ? loggedInUser.name  : f.name;

        var bookingData = {
            workerId     : w.id,
            workerName   : _f(w, 'name', 'Worker'),
            category     : _f(w, 'category', ''),
            customerName : f.name,
            phone        : '+91' + f.phone,
            email        : f.email,
            serviceType  : f.serviceType,
            service_type : f.serviceType,
            note         : f.note,
            date         : f.dateStr,
            time         : f.time,
            time_slot    : f.time,
            address      : f.addrLine1 + (f.addrLine2 ? ', ' + f.addrLine2 : '') + ', ' + f.city + ' - ' + f.pin,
            city         : f.city,
            pinCode      : f.pin,
            payment      : f.payment,
            price        : parseFloat(_f(w, 'price', 0)) || 0,
            status       : 'pending',

            /* Fields required by bookings.js to match this booking to the logged-in user */
            userId       : loggedInUid,
            userEmail    : loggedInEmail,
            userName     : loggedInName,

            /* Timestamp for sorting in bookings.js */
            createdAt    : new Date().toISOString()
        };

        /* If Firebase is connected — save to Firestore */
        if (typeof window._firebaseSubmit === 'function') {
            window._firebaseSubmit(bookingData)
                .then(function (bookingId) {
                    bookingData.id        = bookingId;
                    bookingData.bookingId = bookingId;
                    /* Also save to localStorage so bookings.js can read it immediately */
                    _saveBookingToLocalStorage(bookingData);
                    _showSuccess(bookingData, bookingId);
                })
                .catch(function (err) {
                    console.error('Firebase booking error:', err);
                    /* Fallback: generate a local ID and save to localStorage only */
                    var localId           = 'BK' + Date.now().toString(36).toUpperCase();
                    bookingData.id        = localId;
                    bookingData.bookingId = localId;
                    _saveBookingToLocalStorage(bookingData);
                    _showSuccess(bookingData, localId);
                });
        } else {
            /* Demo / offline mode — save only to localStorage */
            setTimeout(function () {
                var localId           = 'BK' + Date.now().toString(36).toUpperCase();
                bookingData.id        = localId;
                bookingData.bookingId = localId;
                _saveBookingToLocalStorage(bookingData);
                _showSuccess(bookingData, localId);
            }, 1800);
        }
    }

    /* ════════════════════════════
       SHOW SUCCESS
    ════════════════════════════ */
    function _showSuccess(data, bookingId) {
        document.getElementById('bookingMain').style.display = 'none';

        var rows = [
            { icon: 'fa-id-badge',      key: 'Booking ID', val: bookingId      },
            { icon: 'fa-user-hard-hat', key: 'Worker',     val: data.workerName },
            { icon: 'fa-tools',         key: 'Service',    val: data.serviceType },
            { icon: 'fa-calendar',      key: 'Date',       val: data.date       },
            { icon: 'fa-clock',         key: 'Time',       val: data.time       },
            { icon: 'fa-map-marker-alt',key: 'Address',    val: data.address    },
            { icon: 'fa-wallet',        key: 'Payment',    val: PAY_LABELS[data.payment] },
            { icon: 'fa-tag',           key: 'Amount',     val: '₹' + data.price }
        ];

        var idRow = '<div class="bk-booking-id">Your Booking ID: <strong>' + bookingId + '</strong></div>';

        var rowsHtml = rows.slice(1).map(function (r) {
            return '<div class="bk-confirm-row">' +
                       '<span class="bk-confirm-key"><i class="fas ' + r.icon + '"></i>' + r.key + '</span>' +
                       '<span class="bk-confirm-val">' + (r.val || '—') + '</span>' +
                   '</div>';
        }).join('');

        var card = document.getElementById('confirmCard');
        if (card) card.innerHTML = idRow + rowsHtml;

        var succ = document.getElementById('successState');
        succ.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ════════════════════════════
       LIVE SUMMARY UPDATES
    ════════════════════════════ */
    function _updateSummary() {
        _liveUpdate('custName');
        _liveUpdate('custPhone');
        _liveUpdate('addrLine1');
        _liveUpdate('addrCity');
        _liveUpdate('addrPin');
    }

    function _liveUpdate(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
            if (id === 'addrLine1' || id === 'addrCity') {
                var addr = (_val('addrLine1') || '…') + ', ' + (_val('addrCity') || '…');
                _updateSummaryField('sumAddress', addr);
            }
        });
    }

    function _updateSummaryField(id, val) {
        var el = document.getElementById(id);
        if (!el || !val) return;
        el.textContent = val;
        el.classList.remove('updated');
        void el.offsetWidth;
        el.classList.add('updated');
        setTimeout(function () { el.classList.remove('updated'); }, 500);
    }

    /* ════════════════════════════
       HAMBURGER
    ════════════════════════════ */
    function _initHamburger() {
        var hamburger = document.getElementById('hamburger');
        var navLinks  = document.getElementById('navLinks');
        var overlay   = document.getElementById('navOverlay');
        if (!hamburger) return;

        function toggle() {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('open');
            if (overlay) overlay.classList.toggle('show');
        }

        hamburger.addEventListener('click', toggle);
        if (overlay) overlay.addEventListener('click', toggle);
        if (navLinks) {
            navLinks.querySelectorAll('a').forEach(function (a) {
                a.addEventListener('click', function () {
                    if (hamburger.classList.contains('active')) toggle();
                });
            });
        }
    }

    /* ════════════════════════════
       HELPERS
    ════════════════════════════ */
    function _f(obj, key, fallback) {
        var v = obj[key];
        if (!v && v !== 0) v = obj[key.toLowerCase()];
        if (!v && v !== 0) v = obj[key.charAt(0).toUpperCase() + key.slice(1)];
        return (v !== undefined && v !== null && v !== '') ? v : (fallback !== undefined ? fallback : '');
    }

    function _val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function _setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function _setHTML(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    function _capitalize(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    function _renderStars(rating) {
        var html  = '';
        var full  = Math.floor(rating);
        var half  = (rating - full) >= 0.5;
        var empty = 5 - full - (half ? 1 : 0);
        for (var i = 0; i < full;  i++) html += '<i class="fas fa-star"></i>';
        if (half)                        html += '<i class="fas fa-star-half-alt"></i>';
        for (var j = 0; j < empty; j++) html += '<i class="far fa-star"></i>';
        return html;
    }

    function _showError(errId, msg) {
        var el = document.getElementById(errId);
        if (el) el.textContent = msg;
    }

    function _clearError(errId, inputId) {
        var el = document.getElementById(errId);
        if (el) el.textContent = '';
        if (inputId) _removeErrorClass(inputId);
    }

    function _addErrorClass(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('error');
    }

    function _removeErrorClass(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('error');
    }

    /* ── Public API ── */
    return {
        init          : init,
        nextStep      : nextStep,
        prevStep      : prevStep,
        goToStep      : goToStep,
        submitBooking : submitBooking
    };

})();