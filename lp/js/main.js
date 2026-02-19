/**
 * PomoCare LP - Main JS
 */
document.addEventListener('DOMContentLoaded', () => {
  // ---- Mobile hamburger menu ----
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // ---- Language dropdown ----
  const langDropdown = document.getElementById('langDropdown');
  const langDropdownBtn = document.getElementById('langDropdownBtn');
  const langDropdownMenu = document.getElementById('langDropdownMenu');
  const langDropdownLabel = document.getElementById('langDropdownLabel');

  if (langDropdownBtn && langDropdown) {
    // Toggle open/close
    langDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langDropdown.classList.toggle('open');
      langDropdownBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!langDropdown.contains(e.target)) {
        langDropdown.classList.remove('open');
        langDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Language option click
    if (langDropdownMenu) {
      langDropdownMenu.querySelectorAll('.lang-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const lang = btn.getAttribute('data-lang');
          setLanguage(lang);

          // Update dropdown label & active state
          const labels = { ja: 'JP', en: 'EN' };
          if (langDropdownLabel) langDropdownLabel.textContent = labels[lang] || lang.toUpperCase();
          langDropdownMenu.querySelectorAll('.lang-option').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-lang') === lang);
          });

          // Close dropdown
          langDropdown.classList.remove('open');
          langDropdownBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Sync initial label with detected language
    const syncDropdownToLang = (lang) => {
      const labels = { ja: 'JP', en: 'EN' };
      if (langDropdownLabel) langDropdownLabel.textContent = labels[lang] || lang.toUpperCase();
      if (langDropdownMenu) {
        langDropdownMenu.querySelectorAll('.lang-option').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-lang') === lang);
        });
      }
    };
    // i18n.js sets the language on DOMContentLoaded; listen for the initial call
    // by reading the current lang after i18n initialises
    const initialLang = localStorage.getItem('pomocare-lp-lang') ||
      (navigator.language.startsWith('ja') ? 'ja' : 'en');
    syncDropdownToLang(initialLang);
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ---- Intersection Observer for fade-in ----
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.feature-card, .step, .pricing-card, .faq-item, .use-case-card').forEach((el) => {
    observer.observe(el);
  });
});
