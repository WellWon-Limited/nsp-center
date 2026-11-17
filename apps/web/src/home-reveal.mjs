// Home page: what lies below the first screen comes up softly as it scrolls into view (the cards one
// after another, in the manner of the hero heading; index.html puts data-reveal-design="2" on <html>; not on phones).
// Each block below the first screen and each card in it is marked; when one enters the screen it gets .is-in and the
// CSS (home-reveal.css) plays the entrance. Blocks already on screen when the page opens show at once; a visitor who asked the
// system for less motion sees everything without movement.

export const REVEAL_BLOCKS = '.site-main > section:not(.home-hero), .site-main > .section, .home-story, .home-consult';
export const REVEAL_ITEMS = '.product-card, .article-card, .care-card, .home-path, .story-review, .story-intro-card, .story-section > h2, .story-pickup, .story-benefit, .story-panorama, .home-consult > *';

// Where a block starts its entrance: a little after it enters the screen, so the entrance is seen (owner, 2026-11-12:
// starting it ahead of the screen hid the movement).
export const EARLY = { 2: '-10%' };

export function installHomeReveal(win, doc) {
  const root = doc.documentElement;
  if (!root.dataset.revealDesign || !doc.querySelector('.home-first-screen')) return () => {};
  // Not on phones (owner, 2026-11-12): there the page is scrolled quickly and the blocks simply stand in place.
  if (win.matchMedia?.('(max-width: 639px)').matches) return () => {};
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in win)) return () => {};
  const blocks = [...doc.querySelectorAll(REVEAL_BLOCKS)].filter(b => !b.closest('.home-first-screen'));
  const fold = win.innerHeight;
  const watched = [];
  for (const block of blocks) {
    if (block.getBoundingClientRect().top < fold) continue; // already seen: no entrance
    block.classList.add('reveal');
    // Each card comes up when it itself reaches the screen (a tall block — «О NSP Center» with the reviews and the
    // pickup point — would otherwise show its lower cards long before they are seen); cards of one row follow one
    // another by their place in the row.
    // Within one row the cards go left to right (the left review before the right one, owner 2026-11-12).
    const items = [...block.querySelectorAll(REVEAL_ITEMS)].map(item => ({ item, box: item.getBoundingClientRect() }));
    for (const { item, box } of items) {
      const place = items.filter(o => Math.abs(o.box.top - box.top) < 24 && o.box.left < box.left - 1).length;
      item.classList.add('reveal-item'); item.style.setProperty('--reveal-i', String(Math.min(place, 6))); watched.push(item);
    }
    watched.push(block);
  }
  root.classList.add('reveal-ready');
  const seen = new win.IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); seen.unobserve(entry.target); }
  }, { rootMargin: `0px 0px ${EARLY[root.dataset.revealDesign] ?? '0%'} 0px`, threshold: 0 });
  watched.forEach(b => seen.observe(b));
  // Moving through the page with Tab: a card that takes the focus is shown at once (never a focused invisible card).
  const onFocus = event => { for (const el of [event.target?.closest?.('.reveal-item'), event.target?.closest?.('.reveal')]) if (el) { el.classList.add('is-in'); seen.unobserve(el); } };
  doc.addEventListener('focusin', onFocus);
  return () => { seen.disconnect(); doc.removeEventListener('focusin', onFocus); root.classList.remove('reveal-ready'); };
}
