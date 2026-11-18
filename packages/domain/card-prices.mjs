// Discount-card prices are not public (owner, 2026-11-10): a distributor may not offer products at the distributor
// price to everyone. Every page, the browser bundle and /api/site carry retail prices only; the card prices leave the
// server only through GET /api/card-prices, to a signed-in account with a discount card number, or to an administrator.

/** A product as the browser and the built pages may see it: no card price, no card price units, none of the old site's
 *  own price fields (its snapshot "price", "price_base" and "discount" are not shown anywhere). */
export function publicProduct(p) {
  if (!p || typeof p !== 'object' || !p.prices) return p;
  const { price, price_base, discount, ...rest } = p;
  const units = p.prices.units ? { retail: p.prices.units.retail } : undefined;
  return { ...rest, prices: { ...p.prices, partner: null, ...(units ? { units } : {}) } };
}

/** Site settings without the administrator's card price fields (for /api/site to everyone but administrators). */
export function publicSiteSettings(settings) {
  const products = Object.fromEntries(Object.entries(settings.products ?? {}).map(([id, { partnerUnits, partnerRub, ...o }]) => [id, o]));
  return { ...settings, products };
}

/** Card prices in rubles under the current settings, by the same rule as packages/presentation/site.ts (pricesUnder): the product's own
 *  ruble price, else its own у.е. price × rate, else the price list's у.е. × rate, else the built price. */
export function cardPricesFor(products, settings, buildRate) {
  const rate = settings?.rate?.rubPerUnit ?? buildRate;
  const prices = {};
  for (const p of products) {
    const o = settings?.products?.[p.id];
    const units = o?.partnerUnits ?? p.prices?.units?.partner ?? null;
    const rub = o?.partnerRub ?? (units === null ? p.prices?.partner ?? null : Math.round(units * rate));
    if (rub !== null) prices[p.id] = rub;
  }
  return prices;
}

/** The price list's card price units, for the administrator's price editor. */
export const cardUnitsOf = products => Object.fromEntries(products.filter(p => p.prices?.units?.partner != null).map(p => [p.id, p.prices.units.partner]));
