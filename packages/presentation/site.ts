import {readProductKnowledge} from './product-knowledge.mjs';
import {readCatalogConfig,type CatalogConfig} from './catalog-categories.mjs';
import type {ProductKnowledge} from './product-knowledge-types';
import { readProductBadges, type ProductBadges } from './product-badges.mjs';
import type { Article, ExpertNote, Product } from './content-types';

// What the administrator changed on the server (scripts/site-admin.mjs, GET /api/site), applied over the built site in
// the visitor's browser: the warehouse rate turns each product's у.е. prices into new rubles; a product's own prices
// and stock replace the price list's; hidden expert comments are left out. The built pages carry the build-time rubles
// until the page starts; the store then applies the last known settings (cached in this browser) and the fresh ones.

export type ProductOverride = { retailUnits: number | null; partnerUnits: number | null; retailRub: number | null; partnerRub: number | null; availability: string | null; badges?: ProductBadges };
export type CardOverride = { name?: string; image?: string; summary?:string; package?:string };
export type SiteSettings = { catalog?:CatalogConfig; knowledge?: Record<string,ProductKnowledge>; rate: { rubPerUnit: number; updatedAt: string } | null; products: Record<string, ProductOverride>; hiddenNotes: Record<string, string[]>; cards?: Record<string, CardOverride>; ratings?: Record<string, { sum: number; count: number }>; visibility?: Record<string, boolean>; extraProducts?: Product[]; content?: SiteContent; hiddenContent?: Record<string, string[]>; noteStars?: Record<string, Record<string, number>> };
/** «Контент» of site management (packages/presentation/site-content.mjs): what an administrator added, newest first. */
export type Promo = { id: number; title: string; text: string; from: string; to: string; image: string; link: string; products?: string[] };
export type Photo = { id: number; image: string; caption: string };
export type AddedVideo = { id: number; url: string; title: string };
export type Answer = { id: number; q: string; a: string };
export type AddedArticle = Article & { contentId: number; custom: true; data: { title: string; lead: string; body: string; cover: string; date: string; products: string[] } };
export type SiteContent = { promos: Promo[]; photos: Photo[]; videos: AddedVideo[]; faq: Answer[]; articles: AddedArticle[] };
export const emptyContent: SiteContent = { promos: [], photos: [], videos: [], faq: [], articles: [] };
/** Built content an administrator hid (old videos by id, articles by id, FAQ answers by faqKey). */
export const isHiddenContent = (site: SiteSettings | null, kind: string, key: string) => Boolean(site?.hiddenContent?.[kind]?.includes(key));

/** The administrator's content of one product card (GET /api/product-content); set fields replace the built ones. */
export type ProductContent = { photos?:string[]; videos?:{url:string;title:string}[]; summary?:string; name?: string; about?: string[]; highlights?: string[]; properties?: Record<string, string>; documents?: { name: string; url: string }[]; image?: string };

type Original = { retail: number; partner: number | null; availability: string | null; availability_text: string | null; name?: string; hidden: boolean; badges?: ProductBadges; copy?: Product['copy']; card?: Product['card']; experts?: Product['experts'] };
const originals = new WeakMap<Product, Original>();
const contentEdits = new WeakMap<Product, ProductContent|null>();
const AVAILABILITY_TEXT: Record<string, string> = { InStock: 'В наличии', OutOfStock: 'Нет в наличии' };

/** Rubles of a product under the settings: own ruble price > own у.е. price × rate > price list у.е. × rate > built price. */
export function pricesUnder(p: Product, original: Pick<Original, 'retail' | 'partner'>, site: SiteSettings | null, buildRate: number) {
  const o = site?.products[p.id];
  const rate = site?.rate?.rubPerUnit ?? buildRate;
  const units = { retail: o?.retailUnits ?? p.prices.units?.retail ?? null, partner: o?.partnerUnits ?? p.prices.units?.partner ?? null };
  const fromUnits = (u: number | null, built: number | null) => u === null ? built : Math.round(u * rate);
  return { retail: o?.retailRub ?? fromUnits(units.retail, original.retail) ?? original.retail, partner: o?.partnerRub ?? fromUnits(units.partner, original.partner) };
}

/** Discount-card prices from GET /api/card-prices (scripts/card-prices.mjs): only for a signed-in account with a card
 *  number, or an administrator (who also gets the price list's card units for the price editor). */
export type CardPrices = { prices: Record<string, number>; units?: Record<string, number> };
/** The settings without the administrator's card price fields: what may be kept in this browser's cache. */
export const withoutCardFields = (site: SiteSettings): SiteSettings => ({ ...site, products: Object.fromEntries(Object.entries(site.products).map(([id, o]) => [id, { ...o, partnerUnits: null, partnerRub: null }])) });

/** Puts the settings into the product objects the pages read (prices and stock); calling it again with other settings
 *  starts from the built values, so it never compounds. The card price is set only from `cardPrices` (the built pages and
 *  bundle carry none), so without it every visitor sees retail prices. */
export function applySite(products: Iterable<Product>, site: SiteSettings | null, buildRate: number, cardPrices: CardPrices | null = null) {
  for (const p of products) {
    let original = originals.get(p);
    if (!original) { original = { retail: p.prices.retail, partner: p.prices.partner, availability: p.availability, availability_text: p.availability_text, name: p.name, hidden: Boolean(p.hidden), badges: p.badges, copy:p.copy, card:p.card, experts:p.experts }; originals.set(p, original); }
    // Stars come only from published customer reviews on this site: the mean of their stars, to one decimal, as
    // marketplaces show it (the old site's numbers had no reviews behind them). A new published review changes it.
    const ours = site?.ratings?.[p.id];
    if (ours?.count) p.stars = { value: Math.round(ours.sum / ours.count * 10) / 10, count: ours.count, sum: ours.sum }; else delete p.stars;
    p.knowledge=site?.knowledge?.[p.id];
    const addedExperts=(p.knowledge?.experts??[]).filter(n=>!(original.experts??[]).some(o=>o.speaker===n.speaker&&o.lecture===n.lecture&&o.text===n.text));
    p.experts=addedExperts.length?[...(original.experts??[]),...addedExperts]:original.experts;

    p.copy=p.knowledge?{about:p.knowledge.about,highlights:p.knowledge.highlights}:original.copy;
    p.card=p.knowledge?.benefit?{kicker:'',parts:[],more:0,notes:0,...original.card,sub:p.knowledge.benefit}:original.card;
    if(addedExperts.length)p.card={kicker:'',parts:[],more:0,sub:'',...p.card,notes:(original.card?.notes??original.experts?.length??0)+addedExperts.length};
    p.badges = readProductBadges(site?.products[p.id]?.badges ?? original.badges);
    const card = site?.cards?.[p.id];
    p.name = card?.name ?? original.name ?? p.name;
    if(card?.summary!==undefined)p.card={kicker:'',parts:[],more:0,notes:0,...p.card,sub:card.summary};
    if(card?.package!==undefined)p.adminPackage=card.package;else delete p.adminPackage;
    if (card?.image!==undefined) p.adminImage = card.image; else delete p.adminImage;
    const { retail } = pricesUnder(p, original, site, buildRate);
    p.prices.retail = retail;
    p.prices.partner = cardPrices?.prices[p.id] ?? null;
    const units = cardPrices?.units?.[p.id];
    if (units !== undefined && p.prices.units) p.prices.units = { ...p.prices.units, partner: units };
    // Hidden from customers (the administrator's choice, else the build's): nothing to buy, so it is out of stock too.
    p.hidden = site?.visibility?.[p.id] ?? original.hidden;
    const availability = p.hidden ? 'OutOfStock' : site?.products[p.id]?.availability ?? original.availability;
    p.availability = availability;
    p.availability_text = availability === original.availability ? original.availability_text : AVAILABILITY_TEXT[availability ?? ''] ?? original.availability_text;
    if(contentEdits.has(p))applyContent(p,contentEdits.get(p)??null);
  }
}

/** Shown to customers: in the catalog, search, home, theme pages, recommendations and the chat. */
export const listed = (p: Product) => !p.hidden;
/** Hidden as built (a line no longer supplied), before the administrator's choice. */
export const builtHidden = (p: Product) => (originals.get(p) ?? { hidden: Boolean(p.hidden) }).hidden;

/** Stock as built from the catalog data, before the administrator's change (for «Без изменений» in site management). */
export const builtAvailability = (p: Product) => (originals.get(p) ?? p).availability;

type ContentOriginal = Pick<Product, 'name' | 'copy' | 'properties' | 'documents'>;
const contentOriginals = new WeakMap<Product, ContentOriginal>();
/** Puts a card's own content into the product object its page reads; null brings the built content back. */
export function applyContent(p: Product, c: ProductContent | null) {
  contentEdits.set(p,c);
  let o = contentOriginals.get(p);
  if (!o) { o = { name: originals.get(p)?.name ?? p.name, copy: p.copy, properties: p.properties, documents: p.documents }; contentOriginals.set(p, o); }
  p.name = c?.name ?? o.name;
  p.copy = c?.about || c?.highlights ? { about: c.about ?? p.knowledge?.about ?? o.copy?.about ?? [], highlights: c.highlights ?? p.knowledge?.highlights ?? o.copy?.highlights ?? [] } : p.knowledge?{about:p.knowledge.about,highlights:p.knowledge.highlights}:o.copy;
  if(c?.properties)p.adminProperties=c.properties;else delete p.adminProperties;
  p.properties = c?.properties ? Object.fromEntries(Object.entries({ ...o.properties, ...c.properties }).filter(([, v]) => v)) : o.properties;
  p.documents = c?.documents ? c.documents.map(d => ({ name: d.name, size: '', url: d.url })) : o.documents;
  if (c?.image!==undefined) p.adminImage = c.image; else delete p.adminImage;
  if(c?.photos!==undefined)p.adminPhotos=c.photos;else delete p.adminPhotos;
  if(c?.videos!==undefined)p.adminVideos=c.videos;else delete p.adminVideos;
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
  for (const [id, o] of Object.entries((x.products as Record<string, Record<string, unknown>>) || {})) if (o && typeof o === 'object') products[id] = { retailUnits: n(o.retailUnits), partnerUnits: n(o.partnerUnits), retailRub: n(o.retailRub), partnerRub: n(o.partnerRub), availability: o.availability === 'InStock' || o.availability === 'OutOfStock' ? o.availability : null, ...(o.badges !== undefined ? { badges: readProductBadges(o.badges) } : {}) };
  const hiddenNotes: Record<string, string[]> = {};
  for (const [id, keys] of Object.entries((x.hiddenNotes as Record<string, unknown>) || {})) if (Array.isArray(keys)) hiddenNotes[id] = keys.filter((k): k is string => typeof k === 'string');
  const cards: Record<string, CardOverride> = {};
  const safe = (v: unknown) => typeof v === 'string' && v.startsWith('/') ? v : undefined;
  for (const [id, c] of Object.entries((x.cards as Record<string, Record<string, unknown>>) || {})) if (c && typeof c === 'object') cards[id] = { ...(typeof c.name === 'string' ? { name: c.name } : {}), ...(c.image===''?{image:''}:safe(c.image) ? { image: safe(c.image) } : {}), ...(typeof c.summary==='string'?{summary:c.summary.slice(0,300)}:{}), ...(typeof c.package==='string'?{package:c.package.slice(0,300)}:{}) };
  const ratings: Record<string, { sum: number; count: number }> = {};
  for (const [id, r] of Object.entries((x.ratings as Record<string, Record<string, unknown>>) || {})) if (r && Number(r.count) > 0) ratings[id] = { sum: Number(r.sum) || 0, count: Number(r.count) };
  const noteStarsMap: Record<string, Record<string, number>> = {};
  for (const [id, m] of Object.entries((x.noteStars as Record<string, Record<string, unknown>>) || {})) if (m && typeof m === 'object') noteStarsMap[id] = Object.fromEntries(Object.entries(m).filter(([, n]) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 5).map(([k, n]) => [k, Number(n)]));
  const visibility: Record<string, boolean> = {};
  for (const [id, hidden] of Object.entries((x.visibility as Record<string, unknown>) || {})) if (typeof hidden === 'boolean') visibility[id] = hidden;
  // Cards created in site management (packages/presentation/custom-product.mjs): only well-formed ones, with their own address.
  const extraProducts = (Array.isArray(x.extraProducts) ? x.extraProducts : []).filter((p): p is Product => Boolean(p) && typeof p === 'object'
    && typeof p.id === 'string' && /^[a-z0-9-]+$/.test(p.id) && p.path === `/product/${p.id}/` && typeof p.name === 'string' && p.custom === true
    && Boolean(p.prices) && typeof p.prices.retail === 'number' && typeof p.categoryPath === 'string' && Array.isArray(p.breadcrumbs));
  // Content: only well-formed entries of each kind (local files, plain strings); anything else is dropped.
  const c = (x.content && typeof x.content === 'object' ? x.content : {}) as Record<string, unknown>;
  const list = (v: unknown) => Array.isArray(v) ? v.filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object' && Number.isInteger(i.id) || (Boolean(i) && typeof i === 'object' && Number.isInteger((i as Record<string, unknown>).contentId))) : [];
  const str = (v: unknown) => typeof v === 'string' ? v : '';
  const file = (v: unknown) => typeof v === 'string' && /^\/(api\/files|images|media)\//.test(v) ? v : '';
  const content: SiteContent = {
    promos: list(c.promos).map(i => ({ id: Number(i.id), title: str(i.title), text: str(i.text), from: str(i.from), to: str(i.to), image: file(i.image), link: str(i.link).startsWith('/') ? str(i.link) : '', products: Array.isArray(i.products) ? i.products.filter((id): id is string => typeof id === 'string').slice(0,24) : [] })).filter(p => p.title),
    photos: list(c.photos).map(i => ({ id: Number(i.id), image: file(i.image), caption: str(i.caption) })).filter(p => p.image),
    videos: list(c.videos).map(i => ({ id: Number(i.id), url: str(i.url), title: str(i.title) })).filter(v => v.url),
    faq: list(c.faq).map(i => ({ id: Number(i.id), q: str(i.q), a: str(i.a) })).filter(a => a.q && a.a),
    articles: list(c.articles).filter(a => a.custom === true && typeof a.path === 'string' && /^\/blog\/[a-z0-9-]+\/$/.test(a.path as string) && typeof a.html === 'string') as unknown as AddedArticle[],
  };
  const hiddenContent: Record<string, string[]> = {};
  for (const [kind, keys] of Object.entries((x.hiddenContent as Record<string, unknown>) || {})) if (Array.isArray(keys)) hiddenContent[kind] = keys.filter((k): k is string => typeof k === 'string');
  const knowledge:Record<string,ProductKnowledge>={};
  if(x.knowledge&&typeof x.knowledge==='object')for(const [id,v] of Object.entries(x.knowledge)){const parsed=readProductKnowledge(v);if(parsed)knowledge[id]=parsed;}
  return { catalog:readCatalogConfig(x.catalog)??undefined, rate, products, knowledge, hiddenNotes, cards, ratings, noteStars: noteStarsMap, visibility, extraProducts, content, hiddenContent };
}
