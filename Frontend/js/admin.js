/* =============================================
   SEWA NOW — admin.js
   Admin Dashboard Logic
   ============================================= */

const API = "http://127.0.0.1:5000"; // Fixed your Python backend URL
let ADMIN_KEY = "";
let currentSection = "overview";
let trendChart, statusChart, categoryChart;
window.rawTrendData = [];

// ── Auth & Navigation ────────────────────────────────────────────────────────

async function doLogin() {
  const key = document.getElementById('key-input').value.trim();
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';

  if (!key) return;

  ADMIN_KEY = key;

  try {
    await api('/admin/stats');                                      // key validate karo backend se
    document.getElementById('login-overlay').style.display = 'none'; // success → overlay hatao
    loadOverview();
  } catch(e) {
    ADMIN_KEY = '';                                                 // galat key reset karo
    errEl.style.display = 'block';
    document.getElementById('key-input').value = '';
    document.getElementById('key-input').focus();
  }
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  
  const navItems = document.querySelectorAll('.nav-item');
  const index = ['overview','bookings','workers','customers'].indexOf(name);
  if(navItems[index]) navItems[index].classList.add('active');
  
  document.getElementById('topbar-title').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  currentSection = name;
  loadSection(name);
}

function loadCurrentSection() { loadSection(currentSection); }

function loadSection(name) {
  if (name === 'overview')   loadOverview();
  if (name === 'bookings')   loadBookings();
  if (name === 'workers')    loadWorkers();
  if (name === 'customers')  loadCustomers();
}

// ── API helper ───────────────────────────────────────────────────────────────
async function api(path) {
  console.log("Sending request to:", path, "with Key:", ADMIN_KEY); // ✨ Debugging line
  
  const res = await fetch(API + path, { 
    headers: { 
      'X-Admin-Key': ADMIN_KEY, // Ye key tumhare login hone ke baad set honi chahiye
      'Content-Type': 'application/json' 
    } 
  });
  
  if (res.status === 401) {
    console.error("401 Unauthorized! Key is missing or invalid.");
    // ... baki ka code
    throw new Error('Unauthorized');
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

// ── Overview & Smart KPIs ──────────────────────────────────────────────────
async function loadOverview() {
  show('overview-loading'); hide('overview-content');
  try {
    const [stats, trend, cats] = await Promise.all([
      api('/admin/stats'),
      api('/admin/bookings-trend'),
      api('/admin/bookings-by-category'),
    ]);

    window.rawTrendData = trend;

    // Smart KPI Injection
    const sg = document.getElementById('stat-grid');
    sg.innerHTML = `
      <div class="stat-card orange">
        <div class="stat-header">
          <div class="stat-label">Total Users</div>
          <div class="trend-badge trend-up">↑ 25%</div>
        </div>
        <div class="stat-value">${stats.users.total}</div>
        <div class="stat-sub">${stats.users.workers} workers · ${stats.users.customers} customers</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <div class="stat-label">Total Bookings</div>
          <div class="trend-badge trend-down">↓ 10%</div>
        </div>
        <div class="stat-value">${stats.bookings.total}</div>
        <div class="stat-sub">${stats.bookings.pending} pending</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <div class="stat-label">Completed</div>
          <div class="trend-badge trend-up">↑ 12%</div>
        </div>
        <div class="stat-value">${stats.bookings.completed}</div>
        <div class="stat-sub">Jobs done</div>
      </div>
      <div class="stat-card red">
        <div class="stat-header">
          <div class="stat-label">Cancelled</div>
          <div class="trend-badge trend-down">↓ 5%</div>
        </div>
        <div class="stat-value">${stats.bookings.cancelled}</div>
        <div class="stat-sub">This period</div>
      </div>
    `;

    // Global Chart Settings
    Chart.defaults.font.family = "'Segoe UI', sans-serif";
    Chart.defaults.color = '#999';
    Chart.defaults.animation = { duration: 1200, easing: 'easeOutQuart' };

    renderTrendChart(window.rawTrendData);

    // Doughnut Chart
    if (statusChart) statusChart.destroy();
    // 🎯 Custom Plugin: Center mein "Total" aur Number likhne ke liye
      const doughnutCenterText = {
        id: 'doughnutCenterText',
        beforeDraw: function(chart) {
          if (chart.config.type !== 'doughnut') return;
          const width = chart.width;
          const height = chart.height;
          const ctx = chart.ctx;
      
          ctx.restore();
          
          // Sabhi slices ka total calculate karo
          const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
      
          // "Total" Word ki styling
          ctx.font = "600 12px 'Segoe UI', sans-serif";
          ctx.fillStyle = "#888";
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.fillText("Total", width / 2, (height / 2) - 12); // Center se thoda upar
      
          // Asli Number ki styling
          ctx.font = "900 28px 'Segoe UI', sans-serif";
          ctx.fillStyle = "#1a1a2e"; // Dark blue color
          ctx.fillText(total, width / 2, (height / 2) + 14); // Center se thoda neeche
          
          ctx.save();
        }
      };

      // 🍩 Doughnut Chart (Upgraded with Center Text & Percentages)
      if (statusChart) statusChart.destroy();
      const b = stats.bookings;
      
      statusChart = new Chart(document.getElementById('status-chart'), {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
          datasets: [{ 
            data: [b.pending, b.confirmed, b.completed, b.cancelled], 
            backgroundColor: ['#f39c12','#2980b9','#27ae60','#e74c3c'], 
            borderWidth: 3, 
            borderColor: '#ffffff', 
            hoverOffset: 8 
          }]
        },
        plugins: [doughnutCenterText, ChartDataLabels], // ✨ Dono plugins yahan add kiye
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          cutout: '75%', // Ring ki motai (Bada circle center mein text ke liye jagah banayega)
          plugins: { 
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
            tooltip: { backgroundColor: '#1a1a2e', padding: 10, cornerRadius: 8 },
            
            // ✨ Percentages Logic
            datalabels: {
              color: '#ffffff',
              font: { weight: 'bold', size: 12 },
              formatter: (value, ctx) => {
                let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                if (value === 0 || sum === 0) return ''; // Agar slice ki value 0 hai, toh percentage mat dikhao
                let percentage = Math.round((value * 100) / sum) + "%";
                return percentage;
              }
            }
          } 
        }
      });

    // Bar Chart
    if (categoryChart) categoryChart.destroy();
    const catCtx = document.getElementById('category-chart').getContext('2d');
    let barGradient = catCtx.createLinearGradient(0, 0, 0, 300);
    barGradient.addColorStop(0, '#ff6b35'); barGradient.addColorStop(1, '#e85a25');
    categoryChart = new Chart(catCtx, {
      type: 'bar',
      data: {
        labels: cats.map(c => c.category),
        datasets: [{ label: 'Bookings', data: cats.map(c => c.count), backgroundColor: barGradient, borderRadius: 6, barPercentage: 0.5 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a2e', padding: 12, cornerRadius: 8 } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, border: {display: false}, grid: { color: '#f4f5f7', borderDash: [5, 5] }, ticks: { stepSize: 1 } } } }
    });

    hide('overview-loading'); show('overview-content');
  } catch(e) { document.getElementById('overview-loading').innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

// ── Chart Logic & Filters ──────────────────────────────────────────────────
// 📈 Upgraded Line Chart: Smooth Curve, Glowing Points & Gradient Fill
// 📈 Interactive Line Chart (Zoom, Pan, Tooltips, Legend Toggle, Animations)
function renderTrendChart(trendData) {
    if (trendChart) trendChart.destroy();
    const trendCtx = document.getElementById('trend-chart').getContext('2d');
    
    // Gradient Fill Setup
    const chartHeight = document.getElementById('trend-chart').clientHeight || 250;
    let trendGradient = trendCtx.createLinearGradient(0, 0, 0, chartHeight);
    trendGradient.addColorStop(0, 'rgba(255, 107, 53, 0.4)');
    trendGradient.addColorStop(1, 'rgba(255, 107, 53, 0.0)');

    trendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: trendData.map(t => {
            if (!t.date) return '—';
            return new Date(t.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        }),
        datasets: [{
          label: 'Total Bookings', // Ye naam Legend mein dikhega
          data: trendData.map(t => t.count),
          borderColor: '#ff6b35',
          borderWidth: 3,
          tension: 0.4, // ✨ Smooth animations/curves
          fill: true,
          backgroundColor: trendGradient,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ff6b35',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#ff6b35'
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        interaction: { mode: 'index', intersect: false },
        
        // ✨ Smooth Animations (Chart load hote waqt)
        animation: {
          duration: 1200,
          easing: 'easeOutQuart'
        },

        plugins: { 
          // ✨ Legend Toggle (Click karne par line hide/show hogi)
          legend: { 
              display: true, 
              position: 'top',
              align: 'end',
              labels: {
                  usePointStyle: true,
                  boxWidth: 8,
                  font: { family: "'Segoe UI', sans-serif", size: 12, weight: '600' }
              }
          },
          
          // ✨ Hover Tooltips
          tooltip: { 
              backgroundColor: '#1a1a2e',
              titleFont: { size: 13, family: "'Segoe UI', sans-serif" },
              bodyFont: { size: 13, weight: 'bold', family: "'Segoe UI', sans-serif" },
              padding: 12, 
              cornerRadius: 8,
              displayColors: true
          },

          // ✨ Zoom & Pan (Requires chartjs-plugin-zoom)
          zoom: {
              pan: { 
                  enabled: true, 
                  mode: 'x', // Sirf left-right pan allow karega
                  modifierKey: 'ctrl' // Ctrl daba kar drag karne par pan hoga (optional)
              },
              zoom: { 
                  wheel: { enabled: true }, // Mouse wheel se zoom
                  pinch: { enabled: true }, // Mobile touch pinch zoom
                  mode: 'x' 
              }
          }
        }, 
        scales: { 
          x: { 
            grid: { display: false }, 
            ticks: { font: { size: 11 } }
          }, 
          y: { 
            beginAtZero: true, 
            border: { display: false }, 
            grid: { color: '#f0f0f0' }, 
            ticks: { stepSize: 1, font: { size: 11 } } 
          } 
        } 
      }
    });
}

// 🗓️ NEW: Dynamic Date Dropdown Logic
function handlePresetChange() {
  const val = document.getElementById('date-preset').value;
  const customControls = document.getElementById('custom-date-controls');
  
  // Agar Custom select kiya toh calendars dikhao
  if (val === 'custom') {
    customControls.style.display = 'flex';
    return; // User jab 'Apply' dabayega tab filter hoga
  } else {
    customControls.style.display = 'none';
  }

  // Din calculate karo (Today, 7, 30, 90)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - parseInt(val));
  
  // Dates ko YYYY-MM-DD format mein badlo (matching database format)
  const endStr = end.toLocaleDateString('en-CA'); 
  const startStr = start.toLocaleDateString('en-CA');

  // Filter maro aur chart dobara banao
  const filtered = window.rawTrendData.filter(t => t.date >= startStr && t.date <= endStr);
  renderTrendChart(filtered);
}

// 🗓️ Apply Custom Range
function applyDateFilter() {
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;
  if (!start || !end) return alert("Select both start and end dates");

  const filtered = window.rawTrendData.filter(t => t.date >= start && t.date <= end);
  renderTrendChart(filtered);
}

function downloadChart(canvasId, filename) {
  const link = document.createElement('a');
  link.href = document.getElementById(canvasId).toDataURL('image/png');
  link.download = filename;
  link.click();
}

function downloadCSV() {
  let csv = "Date,Bookings Count\n";
  window.rawTrendData.forEach(row => { csv += `${row.date},${row.count}\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(blob);
  a.download = 'SewaNow_Bookings_Trend.csv';
  a.click();
}

// ── Tables Rendering ───────────────────────────────────────────────────────
async function loadBookings() {
  show('bookings-loading'); hide('bookings-content');
  try {
    const bookings = await api('/admin/recent-bookings');
    const tbody = document.getElementById('bookings-tbody');
    
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><code>${b.booking_id}</code></td>
        <td>${b.customer_name}</td>
        <td>${b.worker_name}</td>
        <td>${b.service_type}</td>
        <td>${b.date}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>
          ${b.status === 'pending' ? `
            <button class="refresh-btn" onclick="updateBooking('${b.booking_id}', 'confirmed')" style="color:var(--success); border-color:var(--success); padding:2px 8px; font-size:11px;">Confirm</button>
            <button class="refresh-btn" onclick="updateBooking('${b.booking_id}', 'cancelled')" style="color:var(--danger); border-color:var(--danger); padding:2px 8px; font-size:11px; margin-left:5px;">Cancel</button>
          ` : '—'}
        </td>
      </tr>
    `).join('');
    hide('bookings-loading'); show('bookings-content');
  } catch(e) {
    document.getElementById('bookings-loading').innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

// ✨ Naya function: Backend se baat karne ke liye
async function updateBooking(id, status) {
  try {
    // Ye route tumhe apne main.py (backend) mein banana hoga
    const res = await fetch(`${API}/admin/update-booking/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
      body: JSON.stringify({ status: status })
    });
    const result = await res.json();
    if(result.success) {
      loadBookings(); // Table refresh ho jayegi
      loadOverview(); // Stat cards update ho jayenge
    }
  } catch(e) { alert("Error updating booking"); }
}

async function loadWorkers() {
  show('workers-loading'); hide('workers-content');
  try {
    const workers = await api('/admin/top-workers');
    document.getElementById('workers-count').textContent = `Top ${workers.length} workers`;
    const tbody = document.getElementById('workers-tbody');
    if (!workers.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No workers yet</td></tr>`; }
    else {
      tbody.innerHTML = workers.map((w, i) => `
        <tr>
          <td><strong>#${i+1}</strong> ${w.name}</td>
          <td style="text-transform:capitalize">${w.category || '—'}</td>
          <td>${w.city || '—'}</td>
          <td><strong>${w.total_jobs}</strong> jobs</td>
          <td><span class="stars">${'★'.repeat(Math.round(w.rating))}${'☆'.repeat(5 - Math.round(w.rating))}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">${Number(w.rating).toFixed(1)}</span></td>
        </tr>
      `).join('');
    }
    hide('workers-loading'); show('workers-content');
  } catch(e) { document.getElementById('workers-loading').innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

async function loadCustomers() {
  show('customers-loading'); hide('customers-content');
  try {
    const customers = await api('/admin/users?role=customer');
    document.getElementById('customers-count').textContent = `${customers.length} total`;
    const tbody = document.getElementById('customers-tbody');
    if (!customers.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No customers yet</td></tr>`; }
    else {
      tbody.innerHTML = customers.map(u => `
        <tr>
          <td><strong>${u.name || '—'}</strong></td>
          <td style="color:var(--muted);font-size:12px">${u.email || '—'}</td>
          <td>${u.phone || '—'}</td>
          <td>${u.city || '—'}</td>
          <td style="color:var(--muted);font-size:12px">${u.created_at ? u.created_at.slice(0,10) : '—'}</td>
        </tr>
      `).join('');
    }
    hide('customers-loading'); show('customers-content');
  } catch(e) { document.getElementById('customers-loading').innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
}

function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }