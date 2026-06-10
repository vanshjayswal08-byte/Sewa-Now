/* =====================================================
   SEWA NOW — Profile Page Fix
   ===================================================== */

/* ── INSTANT REDIRECT (before DOM loads) ── */
(function () {
    /* If a worker ID is present in the URL, this is a public worker profile page.
       Do not redirect — let the page load normally. */
    var workerId = new URLSearchParams(window.location.search).get('id');
    if (workerId) return;

    var raw  = localStorage.getItem('sewa_user');
    var user = null;
    try { user = raw ? JSON.parse(raw) : null; } catch (e) { user = null; }

    if (!user) {
        window.location.replace('auth.html');
        return;
    }

    /* Redirect customers to their own profile page */
    if (user.role === 'customer' || !user.role) {
        window.location.replace('user-profile.html');
        return;
    }

    if (user.role === 'worker') {
        window.location.replace('dashboard.html');
        return;
    }

    if (user.role === 'admin') {
        window.location.replace('admin.html');
        return;
    }
})();

/* ── Baaki code tabhi chalega jab role = 'customer' na ho ── */
document.addEventListener('DOMContentLoaded', function () {

    /* ── Get user data from localStorage ── */
    var raw  = localStorage.getItem('sewa_user');
    var user = null;

    try { user = raw ? JSON.parse(raw) : null; } catch (e) { user = null; }

    if (!user) {
        window.location.replace('auth.html');
        return;
    }

    /* ── Extract data fields ── */
    var name  = user.name  || user.fullName  || 'User';
    var email = user.email || '—';
    var phone = user.phone || user.phoneNumber || user.mobile || '—';
    var role  = user.role  || 'customer';

    var roleCap = role.charAt(0).toUpperCase() + role.slice(1);

    /* ── Generate initials for avatar ── */
    var initials = name.trim().split(/\s+/)
        .map(function (p) { return p[0] || ''; })
        .join('').toUpperCase().slice(0, 2) || '?';

    /* ── Fill hero section ── */
    var avatarEl = document.getElementById('upAvatar');
    if (avatarEl) avatarEl.textContent = initials;

    var upNameEl = document.getElementById('upName');
    if (upNameEl) upNameEl.textContent = name;

    var upEmailEl = document.getElementById('upEmail');
    if (upEmailEl) upEmailEl.textContent = email;

    var upRoleBadgeEl = document.getElementById('upRoleBadge');
    if (upRoleBadgeEl) upRoleBadgeEl.textContent = roleCap;

    /* ── Fill personal info list ── */
    var infoNameEl = document.getElementById('infoName');
    if (infoNameEl) infoNameEl.textContent = name;

    var infoEmailEl = document.getElementById('infoEmail');
    if (infoEmailEl) infoEmailEl.textContent = email;

    var infoPhoneEl = document.getElementById('infoPhone');
    if (infoPhoneEl) infoPhoneEl.textContent = phone;

    var infoRoleEl = document.getElementById('infoRole');
    if (infoRoleEl) infoRoleEl.textContent = roleCap;

    /* ── Update navbar ── */
    var navAuthItem = document.getElementById('navAuthItem');
    if (navAuthItem) {
        var initStr = initials;
        navAuthItem.className = 'nav-user-menu';
        navAuthItem.innerHTML =
            '<div class="nav-user-btn" id="navUserBtn">' +
                '<div class="nav-avatar">' + initStr + '</div>' +
                '<span class="nav-user-name">' + name + '</span>' +
                '<i class="fas fa-chevron-down nav-chevron" id="navChevron"></i>' +
            '</div>' +
            '<div class="nav-dropdown" id="navDropdown">' +
                '<div class="nav-dropdown-header">' +
                    '<div class="nav-dd-avatar">' + initStr + '</div>' +
                    '<div>' +
                        '<strong>' + name + '</strong>' +
                        '<span>' + email + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="nav-dropdown-divider"></div>' +
                '<a href="user-profile.html" class="nav-dd-item"><i class="fas fa-user"></i> My Profile</a>' +
                '<a href="bookings.html" class="nav-dd-item"><i class="fas fa-calendar-check"></i> My Bookings</a>' +
                '<div class="nav-dropdown-divider"></div>' +
                '<button class="nav-dd-item nav-dd-logout" id="navLogoutBtn">' +
                    '<i class="fas fa-sign-out-alt"></i> Logout' +
                '</button>' +
            '</div>';

        var btn      = document.getElementById('navUserBtn');
        var dropdown = document.getElementById('navDropdown');
        var chevron  = document.getElementById('navChevron');

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = dropdown.classList.contains('open');
            dropdown.classList.toggle('open', !isOpen);
            chevron.classList.toggle('rotated', !isOpen);
        });

        document.addEventListener('click', function () {
            dropdown.classList.remove('open');
            chevron.classList.remove('rotated');
        });

        dropdown.addEventListener('click', function (e) { e.stopPropagation(); });

        var navLogoutBtn = document.getElementById('navLogoutBtn');
        if (navLogoutBtn) {
            navLogoutBtn.addEventListener('click', function () {
                localStorage.removeItem('sewa_user');
                localStorage.removeItem('sewanow_token');
                window.location.replace('auth.html');
            });
        }
    }

    /* ── Logout button ── */
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('sewa_user');
            localStorage.removeItem('sewanow_token');
            window.location.replace('auth.html');
        });
    }

    /* ── Reset Password Modal ── */
    var forgotPassBtn = document.getElementById('forgotPassBtn');
    var forgotModal   = document.getElementById('forgotModal');
    var modalClose    = document.getElementById('modalClose');

    if (forgotPassBtn && forgotModal) {
        forgotPassBtn.addEventListener('click', function () {
            forgotModal.style.display = 'flex';
            var resetEmailInput = document.getElementById('resetEmail');
            if (resetEmailInput) resetEmailInput.value = email;
        });
    }

    if (modalClose && forgotModal) {
        modalClose.addEventListener('click', function () {
            forgotModal.style.display = 'none';
            resetSteps();
        });
    }

    if (forgotModal) {
        forgotModal.addEventListener('click', function (e) {
            if (e.target === forgotModal) {
                forgotModal.style.display = 'none';
                resetSteps();
            }
        });
    }

    /* ── Modal Steps Logic ── */
    var otpTimerInterval = null;

    /* Step 1: Send OTP */
    var sendOtpBtn = document.getElementById('sendOtpBtn');
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', function () {
            var emailVal = (document.getElementById('resetEmail') || {}).value || '';
            var errEl    = document.getElementById('resetEmailErr');
            if (!emailVal) {
                if (errEl) errEl.textContent = 'Please enter your email address.';
                return;
            }
            if (errEl) errEl.textContent = '';

            fetch('http://127.0.0.1:5000/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailVal })
            })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (result.success) {
                    showStep('step2');
                    var sentEl = document.getElementById('otpSentTo');
                    if (sentEl) sentEl.textContent = emailVal;
                    startOtpTimer(300);
                } else {
                    if (errEl) errEl.textContent = result.error || 'Error sending OTP.';
                }
            })
            .catch(function () {
                showStep('step2');
                var sentEl = document.getElementById('otpSentTo');
                if (sentEl) sentEl.textContent = emailVal;
                startOtpTimer(300);
            });
        });
    }

    /* Step 2: Verify OTP */
    var verifyOtpBtn = document.getElementById('verifyOtpBtn');
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', function () {
            var otp = '';
            for (var i = 1; i <= 6; i++) {
                var box = document.getElementById('otp' + i);
                otp += box ? box.value : '';
            }
            var errEl = document.getElementById('otpErr');
            if (otp.length < 6) {
                if (errEl) errEl.textContent = 'Please enter the 6-digit OTP.';
                return;
            }
            if (errEl) errEl.textContent = '';
            showStep('step3');
        });
    }

    /* Step 3: Save New Password */
    var saveNewPassBtn = document.getElementById('saveNewPassBtn');
    if (saveNewPassBtn) {
        saveNewPassBtn.addEventListener('click', function () {
            var newPass     = (document.getElementById('newPassword') || {}).value || '';
            var confirmPass = (document.getElementById('confirmNewPassword') || {}).value || '';
            var errEl1      = document.getElementById('newPassErr');
            var errEl2      = document.getElementById('confirmPassErr');

            if (newPass.length < 6) {
                if (errEl1) errEl1.textContent = 'Password must be at least 6 characters.';
                return;
            }
            if (errEl1) errEl1.textContent = '';
            if (newPass !== confirmPass) {
                if (errEl2) errEl2.textContent = 'Passwords do not match.';
                return;
            }
            if (errEl2) errEl2.textContent = '';

            fetch('http://127.0.0.1:5000/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: newPass })
            })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (result.success) {
                    showStep('step4');
                } else {
                    if (errEl1) errEl1.textContent = result.error || 'Password update failed.';
                }
            })
            .catch(function () { showStep('step4'); });
        });
    }

    /* Step 4: Done */
    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) {
        doneBtn.addEventListener('click', function () {
            if (forgotModal) forgotModal.style.display = 'none';
            resetSteps();
        });
    }

    /* Resend OTP */
    var resendOtpBtn = document.getElementById('resendOtpBtn');
    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', function () {
            clearInterval(otpTimerInterval);
            startOtpTimer(300);
        });
    }

    /* OTP box auto-focus */
    for (var i = 1; i <= 6; i++) {
        (function (idx) {
            var box = document.getElementById('otp' + idx);
            if (!box) return;
            box.addEventListener('input', function () {
                if (this.value && idx < 6) {
                    var next = document.getElementById('otp' + (idx + 1));
                    if (next) next.focus();
                }
            });
            box.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && !this.value && idx > 1) {
                    var prev = document.getElementById('otp' + (idx - 1));
                    if (prev) prev.focus();
                }
            });
        })(i);
    }

    /* Password strength meter */
    var newPassInput = document.getElementById('newPassword');
    if (newPassInput) {
        newPassInput.addEventListener('input', function () { updateStrength(this.value); });
    }

    /* Eye toggle buttons */
    document.querySelectorAll('.modal-eye-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetId = this.getAttribute('data-target');
            var input    = document.getElementById(targetId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });

    /* ── Helper: Show active step ── */
    function showStep(activeId) {
        ['step1', 'step2', 'step3', 'step4'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== activeId);
        });
    }

    /* ── Helper: Reset modal ── */
    function resetSteps() {
        showStep('step1');
        clearInterval(otpTimerInterval);
        for (var i = 1; i <= 6; i++) {
            var box = document.getElementById('otp' + i);
            if (box) box.value = '';
        }
    }

    /* ── Helper: OTP Timer ── */
    function startOtpTimer(seconds) {
        var timerEl   = document.getElementById('otpTimer');
        var remaining = seconds;
        clearInterval(otpTimerInterval);
        otpTimerInterval = setInterval(function () {
            remaining--;
            if (remaining <= 0) {
                clearInterval(otpTimerInterval);
                if (timerEl) timerEl.textContent = '00:00';
                return;
            }
            var m = Math.floor(remaining / 60);
            var s = remaining % 60;
            if (timerEl) timerEl.textContent =
                (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        }, 1000);
    }

    /* ── Helper: Password strength ── */
    function updateStrength(pass) {
        var score = 0;
        if (pass.length >= 6)  score++;
        if (pass.length >= 10) score++;
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass) && /[^a-zA-Z0-9]/.test(pass)) score++;
        var labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
        var colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
        var labelEl = document.getElementById('psLabel');
        if (labelEl) {
            labelEl.textContent = pass.length === 0 ? 'Enter a password' : (labels[score] || 'Weak');
            labelEl.style.color = pass.length === 0 ? '' : colors[score];
        }
        for (var i = 1; i <= 4; i++) {
            var bar = document.getElementById('ps' + i);
            if (bar) bar.style.backgroundColor = i <= score ? colors[score] : '#e5e7eb';
        }
    }

});