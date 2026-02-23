/**
 * PomoCare LP - Main JS
 * Handles: hamburger menu, language dropdown, smooth scroll,
 * scroll animations, tab switching, comparison toggle, header scroll,
 * theme toggle
 */
document.addEventListener('DOMContentLoaded', function () {

  // ================================================================
  // Theme toggle (Light / Gray / Dark)
  // ================================================================
  var THEME_KEY = 'pomocare-lp-theme';
  var THEMES = ['light', 'gray', 'dark'];

  // SVG icons for each theme state
  var THEME_ICONS = {
    light: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    gray: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor"/></svg>',
    dark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  };

  var THEME_LABELS = { light: 'Light', gray: 'Gray', dark: 'Dark' };

  function updateThemeIcon(theme) {
    var btns = document.querySelectorAll('.theme-toggle');
    btns.forEach(function (btn) {
      btn.innerHTML = THEME_ICONS[theme] || THEME_ICONS.dark;
      btn.setAttribute('aria-label', THEME_LABELS[theme] || 'Dark');
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcon(theme);
    // Swap logo for light vs dark themes
    var logos = document.querySelectorAll('.logo-img');
    logos.forEach(function (img) {
      img.src = theme === 'light' ? 'images/logo.svg' : 'images/logo_dark.svg';
    });
  }

  function cycleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var idx = THEMES.indexOf(current);
    var next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  }

  // Bind all theme toggle buttons
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', cycleTheme);
  });

  // Set initial icon
  updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'dark');

  // ================================================================
  // Mobile hamburger menu
  // ================================================================
  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      mobileNav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // ================================================================
  // Language dropdown (header + footer)
  // ================================================================
  function initLangDropdown(dropdownId, btnId, menuId) {
    var dropdown = document.getElementById(dropdownId);
    var btn = document.getElementById(btnId);
    var menu = document.getElementById(menuId);

    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Close all other dropdowns first
      document.querySelectorAll('.lang-dropdown.open').forEach(function (dd) {
        if (dd !== dropdown) dd.classList.remove('open');
      });
      var isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    if (menu) {
      menu.querySelectorAll('.lang-option').forEach(function (option) {
        option.addEventListener('click', function () {
          var lang = option.getAttribute('data-lang');
          if (typeof setLanguage === 'function') setLanguage(lang);
          syncAllLangDropdowns(lang);
          dropdown.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function syncAllLangDropdowns(lang) {
    var labels = { ja: 'JP', en: 'EN' };
    document.querySelectorAll('.lang-dropdown').forEach(function (dd) {
      // Update label text
      var lbl = dd.querySelector('[id$="LangLabel"], [id$="DropdownLabel"]');
      if (lbl) lbl.textContent = labels[lang] || lang.toUpperCase();
      // Update active state
      dd.querySelectorAll('.lang-option').forEach(function (opt) {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
      });
    });
    // Sync mobile nav language row
    var mobileLangRow = document.getElementById('mobileLangRow');
    if (mobileLangRow) {
      mobileLangRow.querySelectorAll('.lang-option').forEach(function (opt) {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
      });
    }
  }

  initLangDropdown('langDropdown', 'langDropdownBtn', 'langDropdownMenu');
  initLangDropdown('footerLangDropdown', 'footerLangBtn', 'footerLangMenu');
  initLangDropdown('mobileLangDropdown', 'mobileLangDropdownBtn', 'mobileLangDropdownMenu');

  // Mobile nav language buttons
  var mobileLangRow = document.getElementById('mobileLangRow');
  if (mobileLangRow) {
    mobileLangRow.querySelectorAll('.lang-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var lang = opt.getAttribute('data-lang');
        if (typeof setLanguage === 'function') setLanguage(lang);
        syncAllLangDropdowns(lang);
      });
    });
  }

  // Sync initial state
  var initialLang = localStorage.getItem('pomocare-lp-lang') ||
    (navigator.language.startsWith('ja') ? 'ja' : 'en');
  syncAllLangDropdowns(initialLang);

  // ================================================================
  // Smooth scroll for anchor links
  // ================================================================
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        var offset = 80;
        var top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  // ================================================================
  // Header scroll shadow
  // ================================================================
  var header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // ================================================================
  // Intersection Observer for scroll animations
  // ================================================================
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible', 'visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.animate-on-scroll, .fade-in, .feature-card, .step, .pricing-card, .faq-item').forEach(function (el) {
    observer.observe(el);
  });

  // ================================================================
  // Tab switching (Showcase + Use Cases)
  // ================================================================
  function initTabs(tabNavId, options) {
    var tabNav = document.getElementById(tabNavId);
    if (!tabNav) return;

    var buttons = tabNav.querySelectorAll('.tab-btn');
    var parent = tabNav.closest('section');
    var panels = parent ? parent.querySelectorAll('[data-panel]') : [];

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');

        // Update active button
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // Update panels
        panels.forEach(function (panel) {
          panel.classList.toggle('active', panel.getAttribute('data-panel') === tab);
        });

        // Callback
        if (options && options.onChange) options.onChange(tab);
      });
    });
  }

  // App Showcase tabs — switch screenshot image
  var screenshotMap = {
    timer: 'images/screenshot-focus-mode.jpg',
    stats: 'images/screenshot-stats-weekly.jpg',
    settings: 'images/screenshot-settings.jpg',
    labels: 'images/screenshot-labels.jpg'
  };

  initTabs('showcaseTabs', {
    onChange: function (tab) {
      var img = document.getElementById('showcaseImg');
      if (img && screenshotMap[tab]) {
        img.style.opacity = '0';
        setTimeout(function () {
          img.src = screenshotMap[tab];
          img.style.opacity = '1';
        }, 200);
      }
    }
  });

  // Use Cases tabs
  initTabs('useCaseTabs');

  // ================================================================
  // Tab nav overflow indicator ("›")
  // ================================================================
  document.querySelectorAll('.tab-nav').forEach(function (nav) {
    var wrapper = nav.closest('.tab-nav-wrapper');
    if (!wrapper) return;

    function checkOverflow() {
      var atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4;
      wrapper.classList.toggle('at-end', atEnd);
    }

    nav.addEventListener('scroll', checkOverflow, { passive: true });
    // Initial check (run after layout)
    setTimeout(checkOverflow, 0);
  });

  // ================================================================
  // Comparison table toggle
  // ================================================================
  var compToggle = document.getElementById('compToggle');
  var compContent = document.getElementById('compContent');

  if (compToggle && compContent) {
    compToggle.addEventListener('click', function () {
      var isOpen = compContent.classList.toggle('open');
      compToggle.classList.toggle('open', isOpen);
    });
  }

  // ================================================================
  // Cookie consent banner
  // ================================================================
  var cookieBanner = document.getElementById('cookieBanner');
  var cookieAccept = document.getElementById('cookieAccept');
  var cookieDecline = document.getElementById('cookieDecline');
  var cookieBannerText = document.getElementById('cookieBannerText');

  var COOKIE_KEY = 'pomocare-cookie-consent';

  // Detect relative path to privacy page
  var privacyPath = (function () {
    var path = window.location.pathname;
    // If we're in a subdir (e.g. /terms/, /support/), use ../privacy/
    if (/\/[^/]+\/[^/]*$/.test(path) && !/\/(index\.html)?$/.test(path.replace(/\/[^/]+\/[^/]*$/, ''))) {
      return '../privacy/';
    }
    // Check if we're at root level (e.g. / or /index.html)
    var segments = path.replace(/\/+$/, '').split('/').filter(Boolean);
    return segments.length > 1 ? '../privacy/' : 'privacy/';
  })();

  function updateCookieBannerText(lang) {
    if (!cookieBannerText) return;
    if (lang === 'en') {
      cookieBannerText.innerHTML = 'We use cookies and local storage to improve our service. See our <a href="' + privacyPath + '">Privacy Policy</a> for details.';
      if (cookieAccept) cookieAccept.textContent = 'Accept';
      if (cookieDecline) cookieDecline.textContent = 'Decline';
    } else {
      cookieBannerText.innerHTML = '当サイトはサービス改善のためCookieおよびローカルストレージを使用します。詳細は<a href="' + privacyPath + '">プライバシーポリシー</a>をご覧ください。';
      if (cookieAccept) cookieAccept.textContent = '同意する';
      if (cookieDecline) cookieDecline.textContent = '拒否する';
    }
  }

  if (cookieBanner) {
    // Show banner if consent not yet given
    if (!localStorage.getItem(COOKIE_KEY)) {
      setTimeout(function () {
        cookieBanner.classList.add('is-visible');
      }, 800);
    }

    if (cookieAccept) {
      cookieAccept.addEventListener('click', function () {
        localStorage.setItem(COOKIE_KEY, 'accepted');
        cookieBanner.classList.remove('is-visible');
      });
    }

    if (cookieDecline) {
      cookieDecline.addEventListener('click', function () {
        localStorage.setItem(COOKIE_KEY, 'declined');
        cookieBanner.classList.remove('is-visible');
      });
    }

    // Sync text with language
    var currentLang = localStorage.getItem('pomocare-lp-lang') ||
      (navigator.language.startsWith('ja') ? 'ja' : 'en');
    updateCookieBannerText(currentLang);

    // Listen for language changes via i18n hook
    var _origSetLangForCookie = window.setLanguage;
    window.setLanguage = function (lang) {
      if (_origSetLangForCookie) _origSetLangForCookie(lang);
      updateCookieBannerText(lang);
    };
  }

});
