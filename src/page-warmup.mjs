// Fast page switches: the service worker opens a page it already keeps at once (scripts/sw-template.js). This module asks
// it to keep, ahead of time, the pages a visitor is about to open: the tabs once the page has settled, the link under a
// finger the moment it touches, and the catalog's sections and the products in view (a few at a time, never on a data
// saver or a slow connection).

export const MAX_IN_VIEW = 12;

/** A same-site page address worth keeping, or null (site management, the API, files, other sites). */
export function pageOf(href, base) {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    if (u.origin !== new URL(base).origin || /^\/(admin|api)(\/|$)/.test(u.pathname) || /\.[a-z0-9]+$/i.test(u.pathname)) return null;
    return u.pathname + u.search;
  } catch { return null; }
}

/** Whether the connection allows warming more than the tabs. */
export const roomy = nav => !nav?.connection?.saveData && !/(^|-)2g$/.test(nav?.connection?.effectiveType ?? '');

export function installWarmup(win, doc) {
  const sw = win.navigator.serviceWorker;
  if (!sw) return;
  const asked = new Set();
  const send = list => {
    const urls = list.filter(url => url && !asked.has(url));
    if (!urls.length || !sw.controller) return;
    urls.forEach(url => asked.add(url));
    sw.controller.postMessage({ type: 'warm', urls });
  };
  const here = () => win.location.href;
  const links = selector => [...doc.querySelectorAll(selector)].map(a => pageOf(a.getAttribute('href'), here()));
  const idle = fn => (win.requestIdleCallback ? win.requestIdleCallback(fn, { timeout: 3000 }) : win.setTimeout(fn, 1500));
  const start = () => idle(() => {
    send(links('.bottom-nav a[href], .desktop-nav a[href]'));
    if (!roomy(win.navigator)) return;
    send(links('.catalog-entry-link[href], .catalog-sidebar a[href]'));
    if (!('IntersectionObserver' in win)) return;
    let left = MAX_IN_VIEW;
    const seen = new win.IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && left > 0) { left--; seen.unobserve(entry.target); send([pageOf(entry.target.getAttribute('href'), here())]); }
      if (left <= 0) seen.disconnect();
    }, { rootMargin: '200px 0px' });
    doc.querySelectorAll('.product-card h3 a[href]').forEach(a => seen.observe(a));
  });
  if (doc.readyState === 'complete') start(); else win.addEventListener('load', start, { once: true });
  doc.addEventListener('touchstart', event => {
    const a = event.target?.closest?.('a[href]');
    if (a && !a.target) send([pageOf(a.getAttribute('href'), here())]);
  }, { passive: true });
}
