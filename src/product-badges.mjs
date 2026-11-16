/** Shared, bounded product labels; stock is always derived from availability. */
export const DISCOUNT_PERCENTS = [5, 10, 15, 20, 30, 50];
export function readProductBadges(input) {
  const x = input && typeof input === 'object' ? input : {};
  return { discountPercent: DISCOUNT_PERCENTS.includes(x.discountPercent) ? x.discountPercent : 0, isNew: x.isNew === true, isHit: x.isHit === true };
}
export function validateProductBadges(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![0, ...DISCOUNT_PERCENTS].includes(input.discountPercent)
    || typeof input.isNew !== 'boolean' || typeof input.isHit !== 'boolean') return { error: 'Выберите скидку 5, 10, 15, 20, 30 или 50% либо «Без скидки» и отметьте нужные метки.' };
  return { value: readProductBadges(input) };
}
export function productBadgeLabels(input) {
  const b = readProductBadges(input);
  return [...(b.discountPercent ? [{ kind: 'sale', text: `−${b.discountPercent}%` }] : []), ...(b.isNew ? [{ kind: 'new', text: 'Новинка' }] : []), ...(b.isHit ? [{ kind: 'hit', text: 'Хит продаж' }] : [])];
}
