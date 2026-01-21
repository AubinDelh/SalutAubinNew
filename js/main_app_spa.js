/* main_app.js — SPA view initialisers (hero Swiper + carousels + infos + projects reveal + cursor + UI tone)
   Exposes: window.App.initAll(root)
*/
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Shell reveal ----------
  const revealPage = () => document.body.classList.add('page-in');

  // ---------- Splash ----------
  const initSplash = () => {
    const splash = $('#splash');
    if (!splash) return;

    const hide = () => {
      splash.classList.add('is-hidden');
      document.body.classList.remove('splash-lock');
    };

    splash.addEventListener('click', hide, { once: true });
    window.setTimeout(() => {
      if (!splash.classList.contains('is-hidden')) hide();
    }, 2200);
  };

  // ======================================================
  // UI tone (header/footer color) — single source of truth
  // ======================================================
  const setUiTone = (tone) => {
    const root = document.documentElement;
    const t = (tone || '').toLowerCase();

    // "light" = UI white (for dark backgrounds)
    if (t === 'light') {
      root.style.setProperty('--ui-fg', '#fff');
      root.style.setProperty('--ui-fg-hover', 'rgba(255,255,255,.65)');
      return;
    }

    // default "dark" = UI black (for light backgrounds)
    root.style.setProperty('--ui-fg', '#000');
    root.style.setProperty('--ui-fg-hover', 'rgba(0,0,0,.55)');
  };

  // Read tone from an element (supports data-ui OR data-tone)
  const readTone = (el) => {
    if (!el) return null;
    return el.getAttribute('data-ui') || el.getAttribute('data-tone') || null;
  };

  // ======================================================
  // Cursor: Stoemp-like pill Previous/Next (desktop only)
  // ======================================================
  let cursorBound = false;

  const initCursor = () => {
    const cursor = $('#cursor-label');
    if (!cursor) return;

    const enabled = window.innerWidth >= 1024;

    cursor.classList.remove('is-visible');
    document.body.classList.remove('has-text-cursor');

    if (!enabled) return;

    let textEl = $('.cursor-text', cursor);
    if (!textEl) {
      textEl = document.createElement('span');
      textEl.className = 'cursor-text';
      cursor.appendChild(textEl);
    }

    const ACTIVE_ZONES = '.hero-swiper, .carousel';

    const labelForSide = (zone, x) => {
      const r = zone.getBoundingClientRect();
      return x < (r.left + r.width / 2) ? 'Previous' : 'Next';
    };

    const update = (e) => {
      const hovered = document.elementFromPoint(e.clientX, e.clientY);
      const zone = hovered && hovered.closest(ACTIVE_ZONES);

      if (!zone) {
        cursor.classList.remove('is-visible');
        document.body.classList.remove('has-text-cursor');
        return;
      }

      // position (+12 like Stoemp)
      cursor.style.left = (e.clientX + 12) + 'px';
      cursor.style.top  = (e.clientY + 12) + 'px';

      cursor.classList.add('is-visible');
      document.body.classList.add('has-text-cursor');
      textEl.textContent = labelForSide(zone, e.clientX);

      const off = hovered && (hovered.classList.contains('nocursor') || hovered.closest('.nocursor'));
      cursor.classList.toggle('is-off', !!off);
    };

    if (!cursorBound) {
      document.addEventListener('mousemove', update, { passive: true });
      window.addEventListener('mouseleave', () => {
        cursor.classList.remove('is-visible');
        document.body.classList.remove('has-text-cursor');
      });
      window.addEventListener('resize', () => initCursor());
      cursorBound = true;
    }
  };

  // ======================================================
  // Hero Swiper + tone from slide (data-ui or data-tone)
  // ======================================================
  const initHeroSwiper = (root = document) => {
    const el = $('.hero-swiper', root);
    if (!el) return;

    if (typeof window.Swiper === 'undefined') {
      console.warn('[hero] Swiper not loaded');
      return;
    }

    // destroy previous instance for this element
    if (el.__swiper && typeof el.__swiper.destroy === 'function') {
      try { el.__swiper.destroy(true, true); } catch (_) {}
      el.__swiper = null;
    }

    const swiper = new Swiper(el, {
      loop: true,
      speed: 800,
      effect: 'fade',
      fadeEffect: { crossFade: true },
      allowTouchMove: true,
      mousewheel: false,
      breakpoints: {
        1024: { allowTouchMove: false }
      }
    });

    // desktop click: left/right prev/next (bind once)
    if (!el.__clickBound) {
      el.addEventListener('click', (e) => {
        if (window.innerWidth < 1024) return;
        const sw = el.__swiper;
        if (!sw) return;

        const r = el.getBoundingClientRect();
        const isLeft = e.clientX < r.left + r.width / 2;
        isLeft ? sw.slidePrev() : sw.slideNext();
      });
      el.__clickBound = true;
    }

    // slide-driven tone
    const applyToneFromSlide = () => {
      const active = el.querySelector('.swiper-slide-active');
      const tone = readTone(active);
      if (tone) setUiTone(tone);
    };

    // run once + on change (start aligns with fade)
    applyToneFromSlide();
    swiper.on('slideChangeTransitionStart', applyToneFromSlide);

    el.__swiper = swiper;
  };

  // ======================================================
  // Carousels (click left/right, fade via CSS opacity transition)
  // ======================================================
  const initCarousels = (root = document) => {
    const carousels = $$('.carousel', root);
    if (!carousels.length) return;

    const pad2 = (n) => String(n).padStart(2, '0');

    const getActiveIndex = (slides) => {
      const i = slides.findIndex(s => s.classList.contains('active'));
      return i >= 0 ? i : 0;
    };

    const syncMedia = (slides, idx) => {
      slides.forEach((s, i) => {
        if (s.tagName === 'VIDEO') {
          try { i === idx ? s.play() : s.pause(); } catch (_) {}
        }
      });
    };

    carousels.forEach((carousel) => {
      if (carousel.__bound) return;
      carousel.__bound = true;

      const slides = $$('img, video', carousel);
      if (slides.length < 2) return;

      let current = getActiveIndex(slides);
      slides.forEach((s, i) => s.classList.toggle('active', i === current));
      syncMedia(slides, current);

      const project = carousel.closest('.project');
      const counter = project?.querySelector('.carousel-counter');
      const total = Number(carousel.getAttribute('data-total')) || slides.length;

      const updateCounter = () => {
        if (!counter) return;
        counter.textContent = `${pad2(current + 1)}/${pad2(total)}`;
      };
      updateCounter();

      const go = (delta) => {
        if (carousel.classList.contains('is-animating')) return;

        const next = (current + delta + slides.length) % slides.length;
        if (next === current) return;

        carousel.classList.add('is-animating');

        const from = slides[current];
        const to = slides[next];

        // swap active
        from.classList.remove('active');
        to.classList.add('active');

        // if you use CSS transition on opacity for .active, this will fade naturally.
        // unlock on transition end (fallback timeout if no transition fires)
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          carousel.classList.remove('is-animating');
        };

        const onEnd = (e) => {
          if (e.propertyName !== 'opacity') return;
          to.removeEventListener('transitionend', onEnd);
          finish();
        };
        to.addEventListener('transitionend', onEnd);

        window.setTimeout(() => finish(), 500); // fallback

        current = next;
        updateCounter();
        syncMedia(slides, current);
      };

      carousel.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, textarea, select')) return;
        const r = carousel.getBoundingClientRect();
        const isLeft = e.clientX < (r.left + r.width / 2);
        go(isLeft ? -1 : +1);
      });
    });
  };

  // ======================================================
  // Project INFO accordion
  // ======================================================
  const initProjectInfo = (root = document) => {
    $$('.info-button', root).forEach((button) => {
      if (button.__bound) return;
      button.__bound = true;

      button.addEventListener('click', () => {
        const project = button.closest('.project');
        const details = project?.querySelector('.project--info--details');
        const icon = button.querySelector('.toggle-icon');
        if (!details) return;

        const isOpen = details.classList.contains('open');
        const full = details.scrollHeight;

        if (isOpen) {
          details.style.maxHeight = full + 'px';
          requestAnimationFrame(() => {
            details.style.maxHeight = '0px';
            details.classList.remove('open');
            if (icon) icon.textContent = '+';
          });
        } else {
          details.classList.add('open');
          details.style.maxHeight = '0px';
          requestAnimationFrame(() => {
            details.style.maxHeight = full + 'px';
            if (icon) icon.textContent = '–';
          });
        }

        const onEnd = (e) => {
          if (e.propertyName !== 'max-height') return;
          if (details.classList.contains('open')) details.style.maxHeight = '';
          details.removeEventListener('transitionend', onEnd);
        };
        details.addEventListener('transitionend', onEnd);
      });
    });
  };

  // ======================================================
  // Projects reveal (if CSS hides .project until .inview)
  // ======================================================
  let projectsObserver = null;

  const initProjectsReveal = (root = document) => {
    const items = $$('.project', root);
    if (!items.length) return;

    // reset observer when switching views
    if (projectsObserver) {
      try { projectsObserver.disconnect(); } catch (_) {}
      projectsObserver = null;
    }

    projectsObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('inview');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

    items.forEach((el) => {
      if (el.classList.contains('inview')) return;
      projectsObserver.observe(el);
    });
  };

  // ======================================================
  // Public API (called by router after injection)
  // ======================================================
  window.App = window.App || {};

  window.App.initAll = (rootEl) => {
    const root = rootEl || document.getElementById('view') || document;

    // 1) Apply tone from view wrapper first (main[data-ui])
    const main = root.querySelector('main[data-view]');
    const viewTone = readTone(main);
    if (viewTone) setUiTone(viewTone);

    // 2) Init features (hero can override tone per slide)
    initHeroSwiper(root);
    initCarousels(root);
    initProjectInfo(root);
    initProjectsReveal(root);
    initCursor();
  };

  // Back-compat hook (if you still use it somewhere)
  window.AppInit = {
    revealPage,
    initSplash,
    initView: () => window.App.initAll(document.getElementById('view') || document)
  };

  // Shell init once
  document.addEventListener('DOMContentLoaded', () => {
    revealPage();
    initSplash();
  });
})();
