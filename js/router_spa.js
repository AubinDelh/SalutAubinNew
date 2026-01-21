(() => {
  'use strict';

  const VIEW_SEL = 'main[data-view]';
  const DEFAULT_VIEW = 'views/hero.html';
  const viewEl = () => document.getElementById('view');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Keep URL on the shell, store view in hash (prevents /views/... navigation issues)
  const shellUrl = () => window.location.href.split('#')[0];

  const normalizeViewPath = (p) => {
    if (!p) return DEFAULT_VIEW;
    p = String(p).replace(/^#\/?/, ''); // remove "#/" prefix
    p = p.replace(/^\//, '');          // remove leading "/"
    return p || DEFAULT_VIEW;
  };

  const viewFromLocation = () => {
    const h = window.location.hash || '';
    return normalizeViewPath(h);
  };

  const isInternalViewLink = (a) => {
    if (!a) return false;
    if (!a.hasAttribute('data-route')) return false;

    const href = a.getAttribute('href');
    if (!href) return false;

    if (href.startsWith('?')) return false;
    if (href.startsWith('#')) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

    if (/^https?:\/\//i.test(href) && new URL(href).origin !== location.origin) return false;

    // accept "views/*.html"
    return href.endsWith('.html');
  };

  async function fetchHtml(viewPath) {
    const abs = new URL(viewPath, shellUrl()).toString();
    const res = await fetch(abs, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${viewPath}`);
    return await res.text();
  }

  function extractView(doc, viewPath) {
    // Preferred: <main data-view="...">
    let main = doc.querySelector(VIEW_SEL);
    if (main) return main;

    // Fallbacks: #page (your legacy pages), then first <main>, then <body>
    const fallback = doc.querySelector('#page') || doc.querySelector('main') || doc.body;
    if (!fallback) throw new Error(`No view container found in ${viewPath}`);

    // Wrap fallback contents into a main[data-view] so the app stays consistent
    const wrapper = doc.createElement('main');
    const base = (viewPath || '').split('/').pop() || 'view';
    const name = base.replace(/\.html$/i, '') || 'view';
    wrapper.setAttribute('data-view', name);
    wrapper.innerHTML = fallback.innerHTML;
    return wrapper;
  }

  async function loadView(viewPath, { push = true } = {}) {
    const mount = viewEl();
    if (!mount) {
      console.error('[router] #view not found');
      return;
    }

    viewPath = normalizeViewPath(viewPath);

    // OUT (match your CSS timings; keep short here, CSS does the smoothing)
    document.body.classList.remove('animate-in');
    document.body.classList.add('animate-out');
    void mount.offsetHeight;
    await sleep(1000);

    let html;
    try {
      html = await fetchHtml(viewPath);
    } catch (e) {
      console.error('[router] fetch failed:', e);
      document.body.classList.remove('animate-out');
      return;
    }

    let main;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      main = extractView(doc, viewPath);
    } catch (e) {
      console.error('[router] extract failed:', e);
      document.body.classList.remove('animate-out');
      return;
    }

    // inject
mount.innerHTML = '';
mount.appendChild(main.cloneNode(true));

    // update URL (stay on shell)
    if (push) {
      history.pushState({}, '', `${shellUrl()}#/${viewPath}`);
    }

    // init JS for new view
    try {
      window.App?.initAll?.(mount);
    } catch (e) {
      console.error('[App.initAll]', e);
    }

    // IN
    document.body.classList.remove('animate-out');
    void mount.offsetHeight;
    document.body.classList.add('animate-in');
    setTimeout(() => document.body.classList.remove('animate-in'), 240);

    window.scrollTo(0, 0);
  }

  // expose
  window.loadView = (p) => loadView(p, { push: true });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!isInternalViewLink(a)) return;
    e.preventDefault();
    loadView(a.getAttribute('href'), { push: true });
  });

  window.addEventListener('popstate', () => {
    loadView(viewFromLocation(), { push: false });
  });

  // boot
  if (viewEl() && !viewEl().innerHTML.trim()) {
    loadView(viewFromLocation(), { push: false });
  }
})();