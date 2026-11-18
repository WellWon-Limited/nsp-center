// First-tap navigation on phones. iOS spends a tap that lands while the page is still gliding after a swipe on stopping the
// glide, so the bottom bar and the header (fixed/sticky, they never scroll themselves) needed a second tap. Touch events
// still arrive in that case; only the synthetic click is dropped. A short, still touch on these bars is therefore turned
// into the click right away, and the tapped tab is highlighted at once so the visitor sees the tap was taken.

export const TAP_MOVE = 10;
export const TAP_MS = 600;
export const INSTANT_TARGETS = '.bottom-nav a[href],.catalog-entry-link,.site-header a[href]:not(.mobile-menu a),.site-header button:not(.mobile-menu button)';

/** A touch counts as a tap when the finger barely moved and was lifted quickly. */
export function isTap(dx, dy, ms) {
  return Math.abs(dx) <= TAP_MOVE && Math.abs(dy) <= TAP_MOVE && ms >= 0 && ms <= TAP_MS;
}

/** Marks a bottom-bar tab as the one being opened; the mark is cleared when the page is shown from the back/forward cache. */
export function markGoing(doc, link) {
  if (!link.closest('.bottom-nav')) return;
  for (const other of doc.querySelectorAll('.bottom-nav a.is-going')) other.classList.remove('is-going');
  link.classList.add('is-going');
}

export function installInstantTap(win, doc) {
  let start = null;
  doc.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    const target = event.touches.length === 1 ? event.target?.closest?.(INSTANT_TARGETS) : null;
    start = target && !target.disabled ? { target, x: touch.clientX, y: touch.clientY, at: event.timeStamp } : null;
  }, { passive: true });
  doc.addEventListener('touchmove', event => {
    const touch = event.touches[0];
    if (start && touch && !isTap(touch.clientX - start.x, touch.clientY - start.y, 0)) start = null;
  }, { passive: true });
  doc.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  doc.addEventListener('touchend', event => {
    const tap = start; start = null;
    const touch = event.changedTouches[0];
    if (!tap || !touch || event.touches.length) return;
    if (!isTap(touch.clientX - tap.x, touch.clientY - tap.y, event.timeStamp - tap.at)) return;
    if (!tap.target.isConnected || !tap.target.contains(doc.elementFromPoint(touch.clientX, touch.clientY))) return;
    // Cancelling the touch drops the browser's own (possibly lost) click, so the element is clicked exactly once here.
    event.preventDefault();
    markGoing(doc, tap.target);
    tap.target.click();
  }, { passive: false });
  win.addEventListener('pageshow', event => {
    if (event.persisted) for (const link of doc.querySelectorAll('.bottom-nav a.is-going')) link.classList.remove('is-going');
  });
}
