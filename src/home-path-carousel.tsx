import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode, type ReactElement, type HTMLAttributes } from 'react';

// Native scrolling keeps touch swipes available. Repeated sets let the automatic
// movement always travel right, including the last-to-first transition.
export function HomePathCarousel({ children }: { children: ReactNode }) {
 const ref = useRef<HTMLElement>(null);
 const [mobile, setMobile] = useState(false);
 const items = Children.toArray(children);
 useEffect(() => {
  const query = matchMedia('(max-width:639px)');
  const update = () => setMobile(query.matches && document.documentElement.dataset.homeDesign === 'd' && document.documentElement.dataset.phoneDesign === '1');
  update(); query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
 }, []);
 useEffect(() => {
  const el = ref.current;
  if (!mobile || !el) return;
  const count = items.length;
  let timer: ReturnType<typeof setTimeout>;
  let settle: ReturnType<typeof setTimeout>;
  let touching = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const step = () => { const cards = el.querySelectorAll<HTMLElement>('a.home-path'); return cards[1].offsetLeft - cards[0].offsetLeft; };
  const jump = (index: number) => el.scrollTo({ left: index * step(), behavior: 'instant' });
  const schedule = () => {
   clearTimeout(timer);
   if (!touching && !document.hidden && !reduced.matches && !el.contains(document.activeElement)) timer = setTimeout(() => {
    el.scrollTo({ left: (Math.round(el.scrollLeft / step()) - 1) * step(), behavior: 'smooth' });
   }, 4500);
  };
  const normalize = () => {
   if (touching) return;
   const index = Math.round(el.scrollLeft / step());
   if (index < count) jump(index + count);
   else if (index >= count * 2) jump(index - count);
   schedule();
  };
  const scroll = () => { clearTimeout(timer); clearTimeout(settle); settle = setTimeout(normalize, 180); };
  const down = () => { touching = true; clearTimeout(timer); clearTimeout(settle); };
  const up = () => { touching = false; clearTimeout(settle); settle = setTimeout(normalize, 180); };
  const focus = () => clearTimeout(timer);
  const resize = () => { jump(count); schedule(); };
  jump(count); schedule();
  el.addEventListener('scroll', scroll, { passive: true });
  el.addEventListener('pointerdown', down, { passive: true });
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('pointercancel', up, { passive: true });
  el.addEventListener('focusin', focus); el.addEventListener('focusout', schedule);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  return () => {
   clearTimeout(timer); clearTimeout(settle);
   el.removeEventListener('scroll', scroll); el.removeEventListener('pointerdown', down);
   window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
   el.removeEventListener('focusin', focus); el.removeEventListener('focusout', schedule);
   window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', schedule);
   reduced.removeEventListener('change', schedule);
  };
 }, [mobile, items.length]);
 const copies = (side: string) => items.map((item, i) => isValidElement(item) ? cloneElement(item as ReactElement<HTMLAttributes<HTMLElement>>, { key: `${side}-${i}`, 'aria-hidden': true, tabIndex: -1, 'data-carousel-copy': side } as HTMLAttributes<HTMLElement>) : null);
 return <section ref={ref} className="home-paths" data-ds-id="home-pathways" data-carousel={mobile || undefined} aria-label="Категории продуктов">
  {items}
  {copies('middle')}
  {copies('after')}
 </section>;
}
