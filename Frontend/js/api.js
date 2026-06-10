/* =============================================
   SEWA NOW — search.js
   Dropdown Search Autocomplete
   Pure Vanilla JS | No frameworks
   ============================================= */

(function () {

    /* ---- Categories List ---- */
    var CATEGORIES = [
        { label: 'Plumber',           icon: 'fa-faucet'        },
        { label: 'Electrician',       icon: 'fa-bolt'          },
        { label: 'Carpenter',         icon: 'fa-hammer'        },
        { label: 'Painter',           icon: 'fa-paint-roller'  },
        { label: 'Cleaner',           icon: 'fa-broom'         },
        { label: 'AC Repair',         icon: 'fa-snowflake'     },
        { label: 'Interior',          icon: 'fa-couch'         },
        { label: 'Security',          icon: 'fa-shield-alt'    },
        { label: 'Security Guard',    icon: 'fa-user-shield'   },
        { label: 'Bike Repair',       icon: 'fa-motorcycle'    },
        { label: 'Home Care Taker',   icon: 'fa-house-user'    },
    ];

    /* ---- Inject Styles (no changes to style.css needed) ---- */
    var style = document.createElement('style');
    style.textContent = [
        '.sw-dropdown{',
            'position:absolute;',
            'top:calc(100% + 6px);',
            'left:0;right:0;',
            'background:#fff;',
            'border-radius:12px;',
            'box-shadow:0 8px 32px rgba(0,0,0,0.13);',
            'border:1.5px solid rgba(249,115,22,0.15);',
            'z-index:9999;',
            'overflow:hidden;',
            'max-height:320px;',
            'overflow-y:auto;',
            'animation:swDrop 0.18s ease both;',
        '}',
        '@keyframes swDrop{',
            'from{opacity:0;transform:translateY(-8px)}',
            'to{opacity:1;transform:translateY(0)}',
        '}',
        '.sw-dropdown::-webkit-scrollbar{width:5px}',
        '.sw-dropdown::-webkit-scrollbar-thumb{background:#E7E5E4;border-radius:4px}',
        '.sw-item{',
            'display:flex;align-items:center;gap:12px;',
            'padding:11px 16px;',
            'cursor:pointer;',
            'font-family:inherit;font-size:0.93rem;',
            'color:#1C1917;',
            'transition:background 0.15s ease;',
            'border-bottom:1px solid rgba(0,0,0,0.04);',
        '}',
        '.sw-item:last-child{border-bottom:none}',
        '.sw-item:hover,.sw-item.sw-active{',
            'background:#FFF7ED;',
            'color:#F97316;',
        '}',
        '.sw-item i{',
            'width:28px;height:28px;',
            'border-radius:8px;',
            'background:rgba(249,115,22,0.10);',
            'display:flex;align-items:center;justify-content:center;',
            'font-size:0.8rem;color:#F97316;flex-shrink:0;',
        '}',
        '.sw-item.sw-active i{background:rgba(249,115,22,0.18)}',
        '.sw-empty{',
            'padding:14px 16px;',
            'font-size:0.88rem;color:#A8A29E;',
            'text-align:center;',
        '}',
        '.search-container{position:relative}',
    ].join('');
    document.head.appendChild(style);

    /* ---- Wait for DOM ---- */
    document.addEventListener('DOMContentLoaded', function () {

        var input    = document.getElementById('serviceSearch');
        var form     = input ? input.closest('form') : null;
        var wrapper  = input ? input.closest('.search-container') : null;

        if (!input || !wrapper) return;

        /* ---- Create Dropdown ---- */
        var dropdown = document.createElement('div');
        dropdown.className = 'sw-dropdown';
        dropdown.style.display = 'none';
        wrapper.appendChild(dropdown);

        var activeIndex = -1;
        var currentItems = [];

        /* ---- Render Items ---- */
        function render(list) {
            dropdown.innerHTML = '';
            activeIndex = -1;
            currentItems = list;

            if (list.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'sw-empty';
                empty.textContent = 'No service found. Try a different keyword.';
                dropdown.appendChild(empty);
                return;
            }

            list.forEach(function (cat, idx) {
                var item = document.createElement('div');
                item.className = 'sw-item';
                item.innerHTML =
                    '<i class="fas ' + cat.icon + '"></i>' +
                    '<span>' + cat.label + '</span>';

                item.addEventListener('mousedown', function (e) {
                    e.preventDefault(); // prevent blur before click
                    selectItem(cat.label);
                });

                item.addEventListener('mouseenter', function () {
                    setActive(idx);
                });

                dropdown.appendChild(item);
            });
        }

        /* ---- Filter ---- */
        function filter(query) {
            if (!query.trim()) return CATEGORIES;
            var q = query.trim().toLowerCase();
            return CATEGORIES.filter(function (c) {
                return c.label.toLowerCase().indexOf(q) !== -1;
            });
        }

        /* ---- Open / Close ---- */
        function openDropdown(query) {
            var list = filter(query);
            render(list);
            dropdown.style.display = 'block';
        }

        function closeDropdown() {
            dropdown.style.display = 'none';
            activeIndex = -1;
        }

        /* ---- Select ---- */
        function selectItem(label) {
            input.value = label;
            closeDropdown();
            input.focus();
        }

        /* ---- Keyboard Active Highlight ---- */
        function setActive(idx) {
            var items = dropdown.querySelectorAll('.sw-item');
            items.forEach(function (el) { el.classList.remove('sw-active'); });
            if (idx >= 0 && idx < items.length) {
                items[idx].classList.add('sw-active');
                items[idx].scrollIntoView({ block: 'nearest' });
            }
            activeIndex = idx;
        }

        /* ---- Events on Input ---- */
        input.addEventListener('focus', function () {
            openDropdown(this.value);
        });

        input.addEventListener('input', function () {
            openDropdown(this.value);
        });

        input.addEventListener('blur', function () {
            // small delay so mousedown on item fires first
            setTimeout(closeDropdown, 150);
        });

        /* ---- Keyboard Navigation ---- */
        input.addEventListener('keydown', function (e) {
            var items = dropdown.querySelectorAll('.sw-item');
            var total = items.length;

            if (dropdown.style.display === 'none') {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    openDropdown(input.value);
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var next = (activeIndex + 1) % total;
                setActive(next);

            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prev = activeIndex <= 0 ? total - 1 : activeIndex - 1;
                setActive(prev);

            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && currentItems[activeIndex]) {
                    e.preventDefault();
                    selectItem(currentItems[activeIndex].label);
                    // auto submit form with selected value
                    if (form) form.submit();
                }

            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        /* ---- Click outside to close ---- */
        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) {
                closeDropdown();
            }
        });

    });

})();