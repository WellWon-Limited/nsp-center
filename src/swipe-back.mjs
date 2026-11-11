// «Назад» by swiping from the left edge (owner, 2026-11-11). Safari and Chrome in a browser tab have their own edge swipe,
// and Android has the system back gesture; the iPhone home-screen app (standalone PWA) has neither — so the gesture is
// added only there. A swipe starts within 24 px of the left edge and goes right at least 72 px, mostly sideways and
// within 700 ms; a small arrow follows the finger and the previous page opens.

/** Whether a finished touch is a back swipe: start x, total dx and dy, duration in ms. */
export function isBackSwipe(startX, dx, dy, ms) {
  return startX <= 24 && dx >= 72 && Math.abs(dy) < dx * 0.6 && ms <= 700;
}

/** The app runs from the iPhone home screen (no browser back gesture there). */
export const standaloneIos = win => win.navigator.standalone === true || (/iP(hone|ad|od)/.test(win.navigator.userAgent) && win.matchMedia?.('(display-mode: standalone)').matches);

export function installSwipeBack(win, doc) {
  if (!standaloneIos(win)) return () => {};
  let start = null;
  const hint = doc.createElement('div');
  hint.className = 'swipe-back-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>';
  doc.body.appendChild(hint);
  const show = dx => { const p = Math.min(1, Math.max(0, dx / 72)); hint.style.opacity = String(p); hint.style.transform = `translate(${Math.min(dx, 72) * 0.6}px, -50%)`; };
  const hide = () => { hint.style.opacity = '0'; hint.style.transform = 'translate(0, -50%)'; };
  const down = e => { const t = e.touches[0]; start = t && t.clientX <= 24 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null; };
  const move = e => { if (!start) return; const t = e.touches[0]; const dx = t.clientX - start.x, dy = t.clientY - start.y; if (Math.abs(dy) > Math.max(24, dx)) { start = null; hide(); return; } show(dx); };
  const up = e => {
    if (!start) return; const t = e.changedTouches[0];
    const go = isBackSwipe(start.x, t.clientX - start.x, t.clientY - start.y, Date.now() - start.at);
    start = null; hide();
    if (go && win.history.length > 1) win.history.back();
  };
  doc.addEventListener('touchstart', down, { passive: true });
  doc.addEventListener('touchmove', move, { passive: true });
  doc.addEventListener('touchend', up, { passive: true });
  doc.addEventListener('touchcancel', () => { start = null; hide(); }, { passive: true });
  return () => { hint.remove(); };
}
