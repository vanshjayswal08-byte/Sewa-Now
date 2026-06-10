(function () {

    /* ========================================
       DATA — worker profiles
       ======================================== */
    var WORKERS = [];

    function initApp() {
        WORKERS = window.FIREBASE_WORKERS || [];
        applyFilters();
    }

    /* ========================================
       STARS HELPER
       ======================================== */
    function renderStars(rating) {
        var html = '';
        var full  = Math.floor(rating);
        var half  = (rating - full) >= 0.5;
        var empty = 5 - full - (half ? 1 : 0);
        for (var i = 0; i < full;  i++) html += '<i class="fas fa-star"></i>';
        if (half)                        html += '<i class="fas fa-star-half-alt"></i>';
        for (var j = 0; j < empty; j++) html += '<i class="far fa-star"></i>';
        return html;
    }

    /* ========================================
       CATEGORY MATCH HELPER
       Firebase mein category kisi bhi format mein
       stored ho sakti hai:
         "ac", "ac repair", "ac_repair", "AC Repair"
       Yeh function sab ko normalize karke compare karta hai
       ======================================== */
    function normalizeCategory(str) {
        return (str || '')
            .toLowerCase()
            .replace(/[\s_\-]+/g, ''); // spaces, underscores, hyphens remove
    }

    /* Dropdown value → sab possible variations */
    var CATEGORY_MAP = {
        'plumber'     : ['plumber'],
        'electrician' : ['electrician'],
        'carpenter'   : ['carpenter'],
        'painter'     : ['painter'],
        'cleaner'     : ['cleaner'],
        'ac'          : ['ac', 'acrepair', 'ac repair', 'ac_repair'],
        'interior'    : ['interior', 'interiordesign', 'interior design'],
        'security'    : ['security']
    };

    function categoryMatches(workerCat, filterVal) {
        if (filterVal === 'all') return true;
        var normalized = normalizeCategory(workerCat);
        var variants   = (CATEGORY_MAP[filterVal] || [filterVal]).map(normalizeCategory);
        return variants.indexOf(normalized) !== -1;
    }

    /* ========================================
       RENDER CARDS
       ======================================== */
    function renderCard(w) {
        var rating     = parseFloat(w.rating)     || 0;
        var reviews    = parseInt(w.reviews)      || 0;
        var experience = parseInt(w.experience)   || 0;
        var price      = parseFloat(w.price)      || 0;

        return [
            '<div class="worker-card reveal">',
                '<div class="availability-badge ' + (w.available ? 'badge-available' : 'badge-busy') + '">',
                    w.available ? '● Available' : '● Busy',
                '</div>',

                '<div class="worker-card-top">',
                    '<div class="worker-avatar">' + (w.initials || '?') + '</div>',
                    '<div class="worker-meta">',
                        '<h3>' + (w.name || 'Unknown') + '</h3>',
                        '<p class="category-tag"><i class="fas ' + (w.categoryIcon || 'fa-tools') + '"></i> ' + (w.categoryLabel || w.category || 'Service') + '</p>',
                    '</div>',
                '</div>',

                '<div class="worker-card-body">',
                    '<div class="rating">',
                        renderStars(rating),
                        '<span>' + rating.toFixed(1) + '</span>',
                        '<span class="rating-count">(' + reviews + ' reviews)</span>',
                    '</div>',
                    '<div class="worker-pills">',
                        '<span class="info-pill"><i class="fas fa-briefcase"></i> ' + experience + ' yrs exp</span>',
                        '<span class="info-pill"><i class="fas fa-map-marker-alt"></i> ' + (w.location || 'N/A') + '</span>',
                    '</div>',
                    '<div class="price-row">',
                        '<span class="price-label">Starting from</span>',
                        '<span class="price-value">₹' + price + '<small>/visit</small></span>',
                    '</div>',
                '</div>',

                '<div class="worker-card-footer">',
                    '<a href="profile.html?id=' + w.id + '" class="btn-outline">View Profile</a>',
                    '<a href="booking.html?id=' + w.id + '" class="btn-book">Book Now</a>',
                '</div>',
            '</div>'
        ].join('');
    }

    /* ========================================
       FILTER + SORT
       ======================================== */
    function getFiltered() {
        var cat   = document.getElementById('categoryFilter').value;
        var avail = document.getElementById('availFilter').value;
        var loc   = (document.getElementById('locationFilter').value || '').trim().toLowerCase();
        var sort  = document.getElementById('sortBy').value;

        var list = WORKERS.filter(function (w) {
            // ✅ FIXED: Smart category matching (ac, ac repair, ac_repair sab match)
            if (!categoryMatches(w.category, cat)) return false;
            if (avail === 'available' && !w.available) return false;
            if (avail === 'busy'      &&  w.available) return false;
            if (loc && (w.location || '').toLowerCase().indexOf(loc) === -1) return false;
            return true;
        });

        list.sort(function (a, b) {
            if (sort === 'rating')     return parseFloat(b.rating)     - parseFloat(a.rating);
            if (sort === 'experience') return parseInt(b.experience)   - parseInt(a.experience);
            if (sort === 'price_low')  return parseFloat(a.price)      - parseFloat(b.price);
            if (sort === 'price_high') return parseFloat(b.price)      - parseFloat(a.price);
            return 0;
        });

        return list;
    }

    /* ========================================
       PAGINATION
       ======================================== */
    var PAGE_SIZE = 6;
    var currentPage = 1;

    function renderPage(list) {
        var grid  = document.getElementById('workerGrid');
        var count = document.getElementById('resultsCount');
        var pag   = document.getElementById('pagination');

        count.textContent = '(' + list.length + ' found)';

        var start = (currentPage - 1) * PAGE_SIZE;
        var slice = list.slice(start, start + PAGE_SIZE);

        if (slice.length === 0) {
            grid.innerHTML = [
                '<div class="empty-state">',
                    '<i class="fas fa-search"></i>',
                    '<h3>No workers found</h3>',
                    '<p>Try adjusting your filters or search in a different area.</p>',
                '</div>'
            ].join('');
            pag.innerHTML = '';
            return;
        }

        grid.innerHTML = slice.map(renderCard).join('');

        // trigger reveal
        setTimeout(function () {
            grid.querySelectorAll('.reveal').forEach(function (el) {
                el.classList.add('visible');
            });
        }, 50);

        // pagination buttons
        var total = Math.ceil(list.length / PAGE_SIZE);
        var pagHTML = '';

        pagHTML += '<button class="page-btn" ' + (currentPage === 1 ? 'disabled' : '') + ' id="prevBtn"><i class="fas fa-chevron-left"></i></button>';
        for (var p = 1; p <= total; p++) {
            pagHTML += '<button class="page-btn ' + (p === currentPage ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }
        pagHTML += '<button class="page-btn" ' + (currentPage === total ? 'disabled' : '') + ' id="nextBtn"><i class="fas fa-chevron-right"></i></button>';
        pag.innerHTML = pagHTML;

        // bind pagination clicks
        pag.querySelectorAll('[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                currentPage = parseInt(this.dataset.page);
                renderPage(currentData);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
        var prevBtn = document.getElementById('prevBtn');
        var nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.addEventListener('click', function () {
            if (currentPage > 1) { currentPage--; renderPage(currentData); }
        });
        if (nextBtn) nextBtn.addEventListener('click', function () {
            if (currentPage < total) { currentPage++; renderPage(currentData); }
        });
    }

    var currentData = [];

    function applyFilters() {
        currentPage = 1;
        currentData = getFiltered();
        renderPage(currentData);
        renderPills();
    }

    /* ========================================
       ACTIVE PILLS
       ======================================== */
    function renderPills() {
        var pContainer = document.getElementById('activePills');
        pContainer.innerHTML = '';

        var cat   = document.getElementById('categoryFilter');
        var avail = document.getElementById('availFilter');

        if (cat.value !== 'all') addPill(pContainer, cat.options[cat.selectedIndex].text, function () { cat.value = 'all'; applyFilters(); });
        if (avail.value !== 'all') addPill(pContainer, avail.options[avail.selectedIndex].text, function () { avail.value = 'all'; applyFilters(); });

        var loc = document.getElementById('locationFilter').value.trim();
        if (loc) addPill(pContainer, loc, function () { document.getElementById('locationFilter').value = ''; applyFilters(); });
    }

    function addPill(container, text, onRemove) {
        var pill = document.createElement('span');
        pill.className = 'filter-pill';
        pill.innerHTML = text + ' <span class="pill-x">&#10005;</span>';
        pill.addEventListener('click', onRemove);
        container.appendChild(pill);
    }

    /* ========================================
       VIEW TOGGLE
       ======================================== */
    document.getElementById('gridViewBtn').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        document.getElementById('workerGrid').classList.remove('list-view');
    });

    document.getElementById('listViewBtn').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('gridViewBtn').classList.remove('active');
        document.getElementById('workerGrid').classList.add('list-view');
    });

    /* ========================================
       FORM SUBMIT
       ======================================== */
    document.getElementById('filterForm').addEventListener('submit', function (e) {
        e.preventDefault();
        applyFilters();
    });

    /* also apply on dropdown change for instant UX */
    ['categoryFilter', 'sortBy', 'availFilter'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', applyFilters);
    });

    /* ========================================
       HAMBURGER (same logic as index.html)
       ======================================== */
    var hamburger = document.getElementById('hamburger');
    var navLinks  = document.getElementById('navLinks');
    var overlay   = document.getElementById('navOverlay');

    function toggleMenu() {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('open');
        overlay.classList.toggle('show');
    }

    hamburger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);

    /* ========================================
       READ QUERY PARAMS (from index.html search)
       ======================================== */
    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    var searchParam = getParam('search');
    if (searchParam) {
        var matched = ['plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'ac', 'interior', 'security'];
        var lp = searchParam.toLowerCase();
        var matchedCat = matched.find(function (c) { return lp.indexOf(c) !== -1; });
        if (matchedCat) {
            document.getElementById('categoryFilter').value = matchedCat;
        } else {
            document.getElementById('locationFilter').value = searchParam;
        }
    }

    /* ========================================
       initApp global expose
       ======================================== */
    window.initApp = initApp;

})();