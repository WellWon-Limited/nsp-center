import { readFileSync } from 'node:fs';

// Two prices per product: retail for everyone, partner for holders of a discount
// card (an NSP distributor ID). The NSP price list is in conventional units
// (у.е.); rubles = units × rubPerUnit, rounded to whole rubles. Products missing
// from the list keep the snapshot price as retail and have no partner price.
export const priceListUrl = new URL('../references/prices/nsp-2026-11.json', import.meta.url);

export function readPriceList() {
  const list = JSON.parse(readFileSync(priceListUrl, 'utf8'));
  if (!(list.rubPerUnit > 0)) throw new Error('Price list: rubPerUnit must be a positive number');
  return list;
}

export function pricesFor(product, list) {
  const item = list.items[String(product.article ?? '').trim()];
  if (!item) return { retail: product.price, partner: null, source: 'snapshot' };
  const rub = units => Math.round(units * list.rubPerUnit);
  // `units` (у.е.) let the site recompute rubles when the administrator changes the rate (src/site.ts).
  return { retail: rub(item[list.retailColumn]), partner: rub(item[list.partnerColumn]), source: 'price-list', units: { retail: item[list.retailColumn], partner: item[list.partnerColumn] } };
}
