/**
 * PomoCare LP - Main JS
 * Handles: hamburger menu, language dropdown, smooth scroll,
 * scroll animations, tab switching, comparison toggle, header scroll
 */
document.addEventListener('DOMContentLoaded', function () {

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

  function updateCookieBannerText(lang) {
    if (!cookieBannerText) return;
    var privacyHref = cookieBannerText.querySelector('a');
    if (lang === 'en') {
      cookieBannerText.innerHTML = 'We use cookies and local storage to improve our service. See our <a href="privacy/">Privacy Policy</a> for details.';
      if (cookieAccept) cookieAccept.textContent = 'Accept';
      if (cookieDecline) cookieDecline.textContent = 'Decline';
    } else {
      cookieBannerText.innerHTML = '当サイトはサービス改善のためCookieおよびローカルストレージを使用します。詳細は<a href="privacy/">プライバシーポリシー</a>をご覧ください。';
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
