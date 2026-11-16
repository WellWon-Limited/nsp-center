import {layoutScale} from './layout-scale.mjs';
/** Keep the original type sizes. Spend less space on excerpts before moving purchase controls. */
export function fitProductOverview(el, view = el.ownerDocument.defaultView) {
  if (!view) return;
  const scale=layoutScale(el);
  const top = el.getBoundingClientRect().top + view.scrollY;
  const height = Math.max(240, (view.innerHeight - top - 20)/scale);
  el.style.setProperty('--product-available-height', `${height}px`);
  const phone = view.innerWidth < 960;
  const sections = [...el.querySelectorAll('.product-short-section')];
  const updateDetails = () => {
    for (const section of sections) {
      const text = section.querySelector('p');
      section.dataset.clipped = text && text.scrollHeight > text.clientHeight + 1 ? 'true' : 'false';
    }
  };
  const fits = () => {
    const bottom = el.getBoundingClientRect().bottom - 12*scale;
    return [...el.querySelectorAll('.product-purchase > *, .purchase-actions > *')].every(node => {
      const box = node.getBoundingClientRect();
      return !box.height || box.bottom <= bottom + 1;
    });
  };
  for (let level = 0; level <= 3; level++) {
    el.dataset.compact = level > 0 ? 'true' : 'false';
    el.dataset.dense = level > 1 ? 'true' : 'false';
    el.dataset.tight = level > 2 ? 'true' : 'false';
    updateDetails();
    if (phone || fits()) break;
  }
  // Long names keep the same type scale and vertical facts; grow the frame only when spacing alone cannot fit them.
  if (!phone && !fits()) {
    const needed=Math.ceil(Math.max(...[...el.querySelectorAll('.product-purchase > *')].map(node=>node.getBoundingClientRect().bottom))-el.getBoundingClientRect().top+24*scale);
    el.style.setProperty('--product-available-height', `${Math.max(height,needed/scale)}px`);
  }
  updateDetails();
}
