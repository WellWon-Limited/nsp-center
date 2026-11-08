import type { ExpertNote, Product } from './content-types';

// What the administrator changed on the server (scripts/site-admin.mjs, GET /api/site), applied over the built site in
// the visitor's browser: the warehouse rate turns each product's у.е. prices into new rubles; a product's own prices
// and stock replace the price list's; hidden expert comments are left out. The built pages carry the build-time rubles
// until the page starts; the store then applies the last known settings (cached in this browser) and the fresh ones.

export type ProductOverride = { retailUnits: number | null; partnerUnits: number | null; retailRub: number | null; partnerRub: number | null; availability: string | null };
export type CardOverride = { name?: string; image?: string };
export type SiteSettings = { rate: { rubPerUnit: number; updatedAt: string } | null; products: Record<string, ProductOverride>; hiddenNotes: Record<string, string[]>; cards?: Record<string, CardOverride>; ratings?: Record<string, { sum: number; count: number }>; noteStars?: Record<string, Record<string, number>> };
/** The administrator's content of one product card (GET /api/product-content); set fields replace the built ones. */
export type ProductContent = { name?: string; about?: string[]; highlights?: string[]; properties?: Record<string, string>; documents?: { name: string; url: string }[]; image?: string };

type Original = { retail: number; partner: number | null; availability: string | null; availability_text: string | null; name?: string };
const originals = new WeakMap<Product, Original>();
const AVAILABILITY_TEXT: Record<string, string> = { InStock: 'В наличии', OutOfStock: 'Нет в наличии' };

/** Rubles of a product under the settings: own ruble price > own у.е. price × rate > price list у.е. × rate > built price. */
export function pricesUnder(p: Product, original: Pick<Original, 'retail' | 'partner'>, site: SiteSettings | null, buildRate: number) {
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
    if (!original) { original = { retail: p.prices.retail, partner: p.prices.partner, availability: p.availability, availability_text: p.availability_text, name: p.name }; originals.set(p, original); }
    // Stars come only from published customer reviews on this site: the mean of their stars, to one decimal, as
    // marketplaces show it (the old site's numbers had no reviews behind them). A new published review changes it.
    const ours = site?.ratings?.[p.id];
    if (ours?.count) p.stars = { value: Math.round(ours.sum / ours.count * 10) / 10, count: ours.count, sum: ours.sum }; else delete p.stars;
    const card = site?.cards?.[p.id];
    p.name = card?.name ?? original.name ?? p.name;
    if (card?.image) p.adminImage = card.image; else delete p.adminImage;
    const { retail, partner } = pricesUnder(p, original, site, buildRate);
    p.prices.retail = retail;
    p.prices.partner = partner;
    const availability = site?.products[p.id]?.availability ?? original.availability;
    p.availability = availability;
    p.availability_text = availability === original.availability ? original.availability_text : AVAILABILITY_TEXT[availability ?? ''] ?? original.availability_text;
  }
}

/** Stock as built from the catalog data, before the administrator's change (for «Без изменений» in site management). */
export const builtAvailability = (p: Product) => (originals.get(p) ?? p).availability;

type ContentOriginal = Pick<Product, 'name' | 'copy' | 'properties' | 'documents'>;
const contentOriginals = new WeakMap<Product, ContentOriginal>();
/** Puts a card's own content into the product object its page reads; null brings the built content back. */
export function applyContent(p: Product, c: ProductContent | null) {
  let o = contentOriginals.get(p);
  if (!o) { o = { name: originals.get(p)?.name ?? p.name, copy: p.copy, properties: p.properties, documents: p.documents }; contentOriginals.set(p, o); }
  p.name = c?.name ?? o.name;
  p.copy = c?.about || c?.highlights ? { about: c.about ?? o.copy?.about ?? [], highlights: c.highlights ?? o.copy?.highlights ?? [] } : o.copy;
  p.properties = c?.properties ? Object.fromEntries(Object.entries({ ...o.properties, ...c.properties }).filter(([, v]) => v)) : o.properties;
  p.documents = c?.documents ? c.documents.map(d => ({ name: d.name, size: '', url: d.url })) : o.documents;
  if (c?.image) p.adminImage = c.image; else delete p.adminImage;
}

/** An expert comment's stars: five unless the administrator set others (owner, 2026-11-08: expert comments are rated
 *  and counted in the product's stars). */
export const noteStars = (productId: string, key: string, site: SiteSettings | null) => site?.noteStars?.[productId]?.[key] ?? 5;
/** How many reviews a product has — expert comments shown plus published customer reviews — and their mean stars to
 *  one decimal (null without reviews). */
export function reviewSummary(p: Product, notes: number, site: SiteSettings | null) {
  const hidden = new Set(site?.hiddenNotes[p.id] ?? []);
  const experts = Math.max(0, notes - hidden.size);
  const adjust = Object.entries(site?.noteStars?.[p.id] ?? {}).filter(([key]) => !hidden.has(key)).reduce((sum, [, n]) => sum + n - 5, 0);
  const count = experts + (p.stars?.count ?? 0);
  const sum = experts * 5 + adjust + (p.stars?.sum ?? 0);
  return { count, stars: count ? Math.round(sum / count * 10) / 10 : null };
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
  const cards: Record<string, CardOverride> = {};
  const safe = (v: unknown) => typeof v === 'string' && v.startsWith('/') ? v : undefined;
  for (const [id, c] of Object.entries((x.cards as Record<string, Record<string, unknown>>) || {})) if (c && typeof c === 'object') cards[id] = { ...(typeof c.name === 'string' ? { name: c.name } : {}), ...(safe(c.image) ? { image: safe(c.image) } : {}) };
  const ratings: Record<string, { sum: number; count: number }> = {};
  for (const [id, r] of Object.entries((x.ratings as Record<string, Record<string, unknown>>) || {})) if (r && Number(r.count) > 0) ratings[id] = { sum: Number(r.sum) || 0, count: Number(r.count) };
  const noteStarsMap: Record<string, Record<string, number>> = {};
  for (const [id, m] of Object.entries((x.noteStars as Record<string, Record<string, unknown>>) || {})) if (m && typeof m === 'object') noteStarsMap[id] = Object.fromEntries(Object.entries(m).filter(([, n]) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 5).map(([k, n]) => [k, Number(n)]));
  return { rate, products, hiddenNotes, cards, ratings, noteStars: noteStarsMap };
}
