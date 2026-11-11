// Moving between pages in the iPhone home-screen app (owner, 2026-11-11). iOS lets a home-screen web app swipe back and
// forward through its page history by itself, and a site cannot turn that off — so it swiped back to the home page from
// a tab that has no «Назад», forward again into a section already left, and showed a strip of the page behind while it
// slid. Here the app keeps no browser history: every page replaces the current one, so iOS has nothing to swipe through;
// the way back is kept by the site itself (a short list in sessionStorage) and is taken only by the screen's «Назад»
// button or by the site's own swipe on screens that have that button (src/swipe-back.mjs). Tabs (the bottom bar, the
// header menu, the logo) start the list anew, as tabs of an app do. Safari, Chrome and Android keep the browser's history.

const STACK = 'nsp-center:back-stack';
const RESTORE = 'nsp-center:back-restore';
export const TAB_LINKS = '.bottom-nav a,.desktop-nav a,.mobile-menu a,a.brand';

const readStack = storage => { try { const v = JSON.parse(storage.getItem(STACK) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } };
const writeStack = (storage, list) => { try { storage.setItem(STACK, JSON.stringify(list.slice(-30))); } catch { /* the way back is only lost */ } };

/** The next stack after following a link from `here` to `to`: a tab starts it anew; otherwise `here` is added. */
export function nextStack(stack, here, to, tab) {
  if (tab) return [];
  if (to === here) return stack;
  // Coming back down the same way (a link to the page just before) does not grow the list.
  if (stack.at(-1) === to) return stack.slice(0, -1);
  return [...stack, here];
}

let active = false;
/** The page «Назад» leads to in the app (the last one on the list), or null. */
export const previousPage = win => { const top = readStack(win.sessionStorage).at(-1); try { return top ? new URL(top, win.location.href).pathname : null; } catch { return null; } };
/** Whether the site keeps the way back itself (the iPhone home-screen app). */
export const appHistory = () => active;

/** «Назад» in the app: the page before, or `fallback` when the list is empty. Returns false when not in the app. */
export function goBack(win, fallback) {
  if (!active) return false;
  const stack = readStack(win.sessionStorage);
  const to = stack.pop() ?? fallback;
  writeStack(win.sessionStorage, stack);
  try { win.sessionStorage.setItem(RESTORE, new URL(to, win.location.href).pathname + new URL(to, win.location.href).search); } catch { /* no scroll return */ }
  win.location.replace(to);
  return true;
}

/** Whether this page was opened by «Назад» in the app (its scroll position is brought back like the browser's back). */
export function openedByBack(win) {
  try {
    const here = win.location.pathname + win.location.search;
    if (win.sessionStorage.getItem(RESTORE) !== here) return false;
    win.sessionStorage.removeItem(RESTORE);
    return true;
  } catch { return false; }
}

export function installAppHistory(win, doc, standalone) {
  if (!standalone) return;
  active = true;
  doc.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    let url;
    try { url = new URL(link.href, win.location.href); } catch { return; }
    if (url.origin !== win.location.origin || !/^https?:$/.test(url.protocol)) return;
    const here = win.location.pathname + win.location.search;
    const to = url.pathname + url.search;
    if (to === here && url.hash) return; // a jump within the page
    event.preventDefault();
    writeStack(win.sessionStorage, nextStack(readStack(win.sessionStorage), here, to, Boolean(link.closest(TAB_LINKS))));
    win.location.replace(url.href);
  });
}
