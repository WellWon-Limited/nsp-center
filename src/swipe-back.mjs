// «Назад» by swiping from the left edge (owner, 2026-11-11). Safari and Chrome in a browser tab have their own edge swipe,
// and Android has the system back gesture; the iPhone home-screen app (standalone PWA) has neither — so the gesture is
// added only there. It works only on a screen that has a back button (owner, 2026-11-11: not on the home page, the tabs,
// the chat or the plan) and does exactly what that button does. A swipe starts within 24 px of the left edge and goes
// right at least 72 px, mostly sideways and within 700 ms; nothing is drawn while the finger moves.

/** Whether a finished touch is a back swipe: start x, total dx and dy, duration in ms. */
export function isBackSwipe(startX, dx, dy, ms) {
  return startX <= 24 && dx >= 72 && Math.abs(dy) < dx * 0.6 && ms <= 700;
}

/** Back buttons of the site: the common one, the information pages' «На главную», the catalog's «Категории», the
 *  company page's and the journal's own. */
export const BACK_BUTTONS = '.back-link,.information-home,.catalog-mobile-back,.co-home-return a,.home-story-return a,.cert-back a,.av-journal-link a';
/** A step back inside the page comes first: the recommendation test's «Назад» goes to the previous question. */
export const STEP_BACK = '.back-action';
/** The back button on the screen now, or null: a shown step back, else the first shown back button. Every screen with
 *  «Назад» or «На главную» has the swipe (the marathon opened from the home page too); screens without one have none. */
export function backButton(doc) {
  const shown = a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...doc.querySelectorAll(STEP_BACK)].find(shown) ?? [...doc.querySelectorAll(BACK_BUTTONS)].find(shown) ?? null;
}

/** The app runs from the iPhone home screen (no browser back gesture there). */
export const standaloneIos = win => win.navigator.standalone === true || (/iP(hone|ad|od)/.test(win.navigator.userAgent) && win.matchMedia?.('(display-mode: standalone)').matches);

export function installSwipeBack(win, doc) {
  if (!standaloneIos(win)) return () => {};
  let start = null;
  // No circle with an arrow follows the finger (owner, 2026-11-11): the swipe simply opens the page behind.
  const show = () => {};
  const hide = () => {};
  const down = e => { const t = e.touches[0]; start = t && t.clientX <= 24 && backButton(doc) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null; };
  const move = e => { if (!start) return; const t = e.touches[0]; const dx = t.clientX - start.x, dy = t.clientY - start.y; if (Math.abs(dy) > Math.max(24, dx)) { start = null; hide(); return; } show(dx); };
  const up = e => {
    if (!start) return; const t = e.changedTouches[0];
    const go = isBackSwipe(start.x, t.clientX - start.x, t.clientY - start.y, Date.now() - start.at);
    start = null; hide();
    // The same as tapping the screen's back button (BackLink: the previous page, or its own address when opened directly).
    const button = go ? backButton(doc) : null;
    if (button) button.click();
  };
  doc.addEventListener('touchstart', down, { passive: true });
  doc.addEventListener('touchmove', move, { passive: true });
  doc.addEventListener('touchend', up, { passive: true });
  doc.addEventListener('touchcancel', () => { start = null; hide(); }, { passive: true });
  return () => {};
}
