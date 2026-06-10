// ============================================================
//  Sewa Now — auth.js  (shared across ALL pages)
//  Place in:  Frontend/js/auth.js
// ============================================================

const SEWA_USER_KEY  = 'sewa_user';
const SEWA_TOKEN_KEY = 'sewa_token';
const SEWA_UID_KEY   = 'sewa_uid';
const API            = 'http://127.0.0.1:5000';

// ── Getters ──────────────────────────────────────────────────────────────────
function sewaGetUser()  { try { return JSON.parse(localStorage.getItem(SEWA_USER_KEY)); } catch(e) { return null; } }
function sewaGetToken() { return localStorage.getItem(SEWA_TOKEN_KEY) || ''; }

function sewaSaveSession(user, token, uid) {
  localStorage.setItem(SEWA_USER_KEY,  JSON.stringify(user));
  localStorage.setItem(SEWA_TOKEN_KEY, token);
  if (uid) localStorage.setItem(SEWA_UID_KEY, uid);
}

function sewaClearSession() {
  localStorage.removeItem(SEWA_USER_KEY);
  localStorage.removeItem(SEWA_TOKEN_KEY);
  localStorage.removeItem(SEWA_UID_KEY);
  // legacy keys cleanup
  localStorage.removeItem('sewa_user');
  localStorage.removeItem('sewanow_token');
}

// ── Logout — Firebase signOut + clear session ─────────────────────────────────
async function sewaLogout() {
  sewaClearSession();

  // Flag set karo — auth.html pe onAuthStateChanged redirect nahi karega
  sessionStorage.setItem('sewa_logout', '1');

  try {
    const { getApps } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
    );
    const { getAuth, signOut } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
    );
    const apps = getApps();
    if (apps.length > 0) {
      await signOut(getAuth(apps[0]));
    }
  } catch(e) {
    // Silent — localStorage + sessionStorage already set hai
  }

  window.location.href = 'auth.html';
}

// ── Auth-guarded fetch ────────────────────────────────────────────────────────
async function sewaFetch(path, options = {}) {
  const token = sewaGetToken();
  options.headers = Object.assign({}, options.headers, {
    'Content-Type':  'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  });
  const res = await fetch(API + path, options);
  if (res.status === 401) {
    sewaClearSession();
    window.location.href = 'auth.html';
    return null;
  }
  return res;
}

// ── Navbar injection ──────────────────────────────────────────────────────────
function sewaInjectNavbar() {
  const user = sewaGetUser();
  const item = document.getElementById('navAuthItem');
  if (!item) return;
  if (!user || !user.name) return;

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const profileLink = user.role === 'worker' ? 'dashboard.html' : 'profile.html';
  const bookingLink = user.role === 'worker' ? 'dashboard.html' : 'bookings.html';
  const adminItem   = user.role === 'admin'
    ? `<a href="admin.html" class="nav-dd-item"><i class="fas fa-shield-alt"></i> Admin Panel</a>`
    : '';

  item.className = 'nav-user-menu';
  item.innerHTML = `
    <div class="nav-user-btn" id="navUserBtn">
      <div class="nav-avatar">${initials}</div>
      <span class="nav-user-name">${user.name}</span>
      <i class="fas fa-chevron-down nav-chevron" id="navChevron"></i>
    </div>
    <div class="nav-dropdown" id="navDropdown">
      <div class="nav-dropdown-header">
        <div class="nav-dd-avatar">${initials}</div>
        <div>
          <strong>${user.name}</strong>
          <span>${user.email || user.phone || ''}</span>
        </div>
      </div>
      <div class="nav-dropdown-divider"></div>
      <a href="${profileLink}" class="nav-dd-item"><i class="fas fa-user"></i> My Profile</a>
      <a href="${bookingLink}" class="nav-dd-item"><i class="fas fa-calendar-check"></i> My Bookings</a>
      ${adminItem}
      <div class="nav-dropdown-divider"></div>
      <button class="nav-dd-item nav-dd-logout" onclick="sewaLogout()">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>
    </div>
  `;

  const btn      = document.getElementById('navUserBtn');
  const dropdown = document.getElementById('navDropdown');
  const chevron  = document.getElementById('navChevron');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    chevron.classList.toggle('rotated', !isOpen);
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    chevron.classList.remove('rotated');
  });

  dropdown.addEventListener('click', e => e.stopPropagation());
}

// ── Auto-run ──────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sewaInjectNavbar);
} else {
  sewaInjectNavbar();
}