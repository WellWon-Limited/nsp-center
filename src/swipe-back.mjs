// «Назад» by swiping from the left edge (owner, 2026-11-11). Safari and Chrome in a browser tab have their own edge swipe,
// and Android has the system back gesture, so a second one there would go back twice; in the iPhone home-screen app
// (standalone PWA) every page replaces the previous one in history (src/app-history.mjs), so the system swipe has nothing
// to go back to — the gesture is added only there. It works only on a screen that has a back button (owner, 2026-11-11:
// not on the home page, the tabs, the chat or the plan) and does exactly what that button does. Nothing is drawn while
// the finger moves (owner, 2026-11-11: no arrow circle).
//
// As on iOS (owner, 2026-11-12: research how the back swipe should work): it starts at the left edge only, not anywhere
// on the screen — the site has sideways carousels and the full-screen swipe of iOS 26 fights them. The direction is
// decided after the first 10 px (sideways, or it is scrolling and stays scrolling). On release it goes back after a
// third of the screen's width, or after a short quick flick; a finger that went back left cancels it; so does a second
// finger (zoom). It leaves alone touches that start in a field, a slider, a carousel that can still scroll left, and
// any open menu or dialog.

/** The edge zone, px from the left. */
export const EDGE = 24;
/** Whether a finished touch is a back swipe: start x, total dx and dy, the screen's width and the finger's speed at
 *  release (px/ms, positive to the right). */
export function isBackSwipe(startX, dx, dy, width, velocity = 0) {
  if (startX > EDGE || dx <= 0 || Math.abs(dy) >= dx * 0.6 || velocity < -0.05) return false;
  return dx >= width * 0.35 || (dx >= 40 && velocity >= 0.3);
}
/** After the first 10 px the swipe either is sideways (true), is a scroll (false), or is not decided yet (null). */
export function swipeDirection(dx, dy) {
  if (Math.hypot(dx, dy) < 10) return null;
  return dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

/** Touches that start here belong to the element, not to the back swipe. */
export const OWN_TOUCH = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[data-no-swipe-back]';
/** Open layers over the page: the swipe does not leave the page under them. */
export const OVERLAYS = 'dialog[open],[aria-modal="true"],.mobile-menu,[aria-haspopup][aria-expanded="true"]';
const shown = a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
/** Whether a touch starting at `target` must not become a back swipe. */
export function ownsTouch(target, doc, win) {
  if ([...doc.querySelectorAll(OVERLAYS)].some(shown)) return true;
  for (let el = target; el && el !== doc.body && el.nodeType === 1; el = el.parentElement) {
    if (el.matches?.(OWN_TOUCH)) return true;
    // A sideways carousel that is not at its start would scroll back with this finger.
    if (el.scrollLeft > 0 && el.scrollWidth > el.clientWidth && /(auto|scroll)/.test(win.getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

/** Back buttons of the site: the common one, the information pages' «На главную», the catalog's «Категории», the
 *  company page's and the journal's own. */
export const BACK_BUTTONS = '.back-link,.information-home,.catalog-mobile-back,.co-home-return a,.home-story-return a,.cert-back a,.av-journal-link a';
/** A step back inside the page comes first: the recommendation test's «Назад» goes to the previous question. */
export const STEP_BACK = '.back-action';
/** The back button on the screen now, or null: a shown step back, else the first shown back button. Every screen with
 *  «Назад» or «На главную» has the swipe (the marathon opened from the home page too); screens without one have none. */
export function backButton(doc) {
  return [...doc.querySelectorAll(STEP_BACK)].find(shown) ?? [...doc.querySelectorAll(BACK_BUTTONS)].find(shown) ?? null;
}

/** The app runs from the iPhone home screen (no browser back gesture there). */
export const standaloneIos = win => win.navigator.standalone === true || (/iP(hone|ad|od)/.test(win.navigator.userAgent) && win.matchMedia?.('(display-mode: standalone)').matches);

export function installSwipeBack(win, doc) {
  if (!standaloneIos(win)) return () => {};
  let start = null;
  const down = e => {
    const t = e.touches[0];
    start = e.touches.length === 1 && t.clientX <= EDGE && backButton(doc) && !ownsTouch(e.target, doc, win)
      ? { x: t.clientX, y: t.clientY, sideways: null, last: [{ x: t.clientX, at: e.timeStamp }] } : null;
  };
  const move = e => {
    if (!start) return;
    if (e.touches.length > 1) { start = null; return; }
    const t = e.touches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (start.sideways === null) start.sideways = swipeDirection(dx, dy);
    if (start.sideways === false) { start = null; return; }
    // The last ~80 ms of the finger, for its speed at release.
    start.last.push({ x: t.clientX, at: e.timeStamp });
    while (start.last.length > 2 && e.timeStamp - start.last[0].at > 80) start.last.shift();
  };
  const up = e => {
    if (!start) return;
    const t = e.changedTouches[0], first = start.last[0];
    const ms = e.timeStamp - first.at;
    const velocity = ms > 0 ? (t.clientX - first.x) / ms : 0;
    const go = start.sideways === true && isBackSwipe(start.x, t.clientX - start.x, t.clientY - start.y, win.innerWidth, velocity);
    start = null;
    // The same as tapping the screen's back button (BackLink: the previous page, or its own address when opened directly).
    const button = go ? backButton(doc) : null;
    if (button) button.click();
  };
  const cancel = () => { start = null; };
  const options = { passive: true };
  doc.addEventListener('touchstart', down, options);
  doc.addEventListener('touchmove', move, options);
  doc.addEventListener('touchend', up, options);
  doc.addEventListener('touchcancel', cancel, options);
  return () => {
    doc.removeEventListener('touchstart', down, options);
    doc.removeEventListener('touchmove', move, options);
    doc.removeEventListener('touchend', up, options);
    doc.removeEventListener('touchcancel', cancel, options);
  };
}
