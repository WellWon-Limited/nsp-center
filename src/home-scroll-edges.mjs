// The browser paints the root canvas during rubber-band scrolling. Keep it white near the header,
// and continue the page/footer surface only at the bottom of the selected home design and of the restyled catalog.
export function installHomeScrollEdges(win, doc) {
 const root = doc.documentElement;
 if (root.dataset.homeDesign !== 'd' && !root.dataset.catalogDesign) return () => {};
 const previous = root.dataset.homeScrollEdge;
 let frame = 0;
 const paint = () => {
  frame = 0;
  const end = Math.max(0, root.scrollHeight - win.innerHeight);
  const edge = end > 0 && win.scrollY >= end - 2 ? 'bottom' : 'top';
  if (root.dataset.homeScrollEdge !== edge) root.dataset.homeScrollEdge = edge;
 };
 const schedule = () => { if (!frame) frame = win.requestAnimationFrame(paint); };
 const options = { passive: true };
 win.addEventListener('scroll', schedule, options);
 win.addEventListener('resize', schedule, options);
 win.addEventListener('pageshow', schedule, options);
 const observer = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
 if (doc.body) observer?.observe(doc.body);
 paint();
 return () => {
  win.removeEventListener('scroll', schedule, options);
  win.removeEventListener('resize', schedule, options);
  win.removeEventListener('pageshow', schedule, options);
  if (frame) win.cancelAnimationFrame(frame);
  observer?.disconnect();
  if (previous === undefined) delete root.dataset.homeScrollEdge;
  else root.dataset.homeScrollEdge = previous;
 };
}
