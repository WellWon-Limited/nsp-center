import type { ExpertNote, Product } from './content-types';

// What the administrator changed on the server (scripts/site-admin.mjs, GET /api/site), applied over the built site in
// the visitor's browser: the warehouse rate turns each product's у.е. prices into new rubles; a product's own prices
// and stock replace the price list's; hidden expert comments are left out. The built pages carry the build-time rubles
// until the page starts; the store then applies the last known settings (cached in this browser) and the fresh ones.

export type ProductOverride = { retailUnits: number | null; partnerUnits: number | null; retailRub: number | null; partnerRub: number | null; availability: string | null };
export type SiteSettings = { rate: { rubPerUnit: number; updatedAt: string } | null; products: Record<string, ProductOverride>; hiddenNotes: Record<string, string[]> };

type Original = { retail: number; partner: number | null; availability: string | null; availability_text: string | null };
const originals = new WeakMap<Product, Original>();
const AVAILABILITY_TEXT: Record<string, string> = { InStock: 'В наличии', OutOfStock: 'Нет в наличии' };

/** Rubles of a product under the settings: own ruble price > own у.е. price × rate > price list у.е. × rate > built price. */
export function pricesUnder(p: Product, original: Original, site: SiteSettings | null, buildRate: number) {
  const o = site?.products[p.id];
  const rate = site?.rate?.rubPerUnit ?? buildRate;
  const units = { retail: o?.retailUnits ?? p.prices.units?.retail ?? null, partner: o?.partnerUnits ?? p.prices.units?.partner ?? null };
  const fromUnits = (u: number | null, built: number | null) => u === null ? built : Math.round(u * rate);
  return { retail: o?.retailRub ?? fromUnits(units.retail, original.retail) ?? original.retail, partner: o?.partnerRub ?? fromUnits(units.partner, original.partner) };
}

/** Puts the settings into the product objects the pages read (prices and stock); calling it again with other settings
 *  starts from the built values, so it never compounds. */
export function applySite(products: Iterable<Product>, site: SiteSettings | null, buildRate: number) {
  for (const p of products) {
    let original = originals.get(p);
    if (!original) { original = { retail: p.prices.retail, partner: p.prices.partner, availability: p.availability, availability_text: p.availability_text }; originals.set(p, original); }
    const { retail, partner } = pricesUnder(p, original, site, buildRate);
    p.prices.retail = retail;
    p.prices.partner = partner;
    const availability = site?.products[p.id]?.availability ?? original.availability;
    p.availability = availability;
    p.availability_text = availability === original.availability ? original.availability_text : AVAILABILITY_TEXT[availability ?? ''] ?? original.availability_text;
  }
}

/** A stable name of an expert comment, for hiding it (the same text in the same lecture by the same doctor). */
export const noteKey = (n: ExpertNote) => `${n.speaker}|${n.lecture}|${n.text.slice(0, 80)}`;
export const visibleNotes = (productId: string, notes: ExpertNote[] | undefined, site: SiteSettings | null) => {
  const hidden = site?.hiddenNotes[productId];
  return hidden?.length ? (notes ?? []).filter(n => !hidden.includes(noteKey(n))) : notes ?? [];
};

/** Settings as cached in this browser or answered by the server; anything malformed is ignored. */
export function readSite(v: unknown): SiteSettings | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const rate = x.rate && typeof x.rate === 'object' && Number((x.rate as Record<string, unknown>).rubPerUnit) > 0 ? { rubPerUnit: Number((x.rate as Record<string, unknown>).rubPerUnit), updatedAt: String((x.rate as Record<string, unknown>).updatedAt ?? '') } : null;
  const n = (v: unknown) => typeof v === 'number' && v > 0 ? v : null;
  const products: Record<string, ProductOverride> = {};
  for (const [id, o] of Object.entries((x.products as Record<string, Record<string, unknown>>) || {})) if (o && typeof o === 'object') products[id] = { retailUnits: n(o.retailUnits), partnerUnits: n(o.partnerUnits), retailRub: n(o.retailRub), partnerRub: n(o.partnerRub), availability: o.availability === 'InStock' || o.availability === 'OutOfStock' ? o.availability : null };
  const hiddenNotes: Record<string, string[]> = {};
  for (const [id, keys] of Object.entries((x.hiddenNotes as Record<string, unknown>) || {})) if (Array.isArray(keys)) hiddenNotes[id] = keys.filter((k): k is string => typeof k === 'string');
  return { rate, products, hiddenNotes };
}
