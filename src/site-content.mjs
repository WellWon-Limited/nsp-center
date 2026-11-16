// What an administrator adds to the site in «Контент» (scripts/site-admin.mjs, table content_items): offers, photos,
// videos, journal articles and FAQ answers. Every kind is a short form of plain fields — no markup is accepted, the
// text is turned into safe HTML here — so a typo cannot break a page. The same rules run on the server (checking what
// is saved) and in the browser (showing it).

import { slugOf } from './custom-product.mjs';

export const CONTENT_KINDS = ['promo', 'photo', 'video', 'article', 'faq'];
/** Built content that can be hidden (and returned) by its key: the old site's videos, articles and FAQ answers. */
export const HIDEABLE_KINDS = ['video', 'article', 'faq'];

const text = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const localFile = v => typeof v === 'string' && /^\/(api\/files\/[a-f0-9]{32}|images\/[\w./-]+|media\/[\w./%-]+)$/.test(v) && !v.includes('..');
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(String(v)));
const sitePath = v => typeof v === 'string' && /^\/[\w\-./?=&%]*$/.test(v) && !v.startsWith('//');

/** A video page on VK Видео, Rutube or YouTube turned into what the gallery needs: the player address, the page to open
 *  and a poster (YouTube publishes one; the others get the gallery's neutral poster). Null for anything else. */
export function videoOf(url) {
  let u;
  try { u = new URL(String(url ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  const youtube = host === 'youtu.be' ? u.pathname.slice(1) : /(^|\.)youtube\.com$/.test(host) ? (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]) : null;
  if (youtube && /^[\w-]{11}$/.test(youtube)) return { source: 'youtube', id: youtube, embed: `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1`, href: `https://www.youtube.com/watch?v=${youtube}`, poster: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` };
  const rutube = host === 'rutube.ru' ? u.pathname.match(/^\/(?:video|play\/embed|shorts)\/([a-f0-9]{32})/)?.[1] : null;
  if (rutube) return { source: 'rutube', id: rutube, embed: `https://rutube.ru/play/embed/${rutube}?autoplay=1`, href: `https://rutube.ru/video/${rutube}/`, poster: '' };
  const vk = /^(vk\.com|vkvideo\.ru|vk\.ru)$/.test(host) ? (`${u.pathname}${u.search}`.match(/video(-?\d+)_(\d+)/) ?? null) : null;
  if (vk) return { source: 'vk', id: `${vk[1]}_${vk[2]}`, embed: `https://vkvideo.ru/video_ext.php?oid=${vk[1]}&id=${vk[2]}&autoplay=1`, href: `https://vkvideo.ru/video${vk[1]}_${vk[2]}`, poster: '' };
  return null;
}
export const VIDEO_SOURCES = { youtube: 'YouTube', rutube: 'Rutube', vk: 'VK Видео' };

const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Article or answer text to safe HTML: a blank line starts a paragraph, «## » a subheading, lines with «- » a list. */
export function textToHtml(body) {
  return text(body, 40000).split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map(block => {
    if (block.startsWith('## ')) return `<h2>${escape(block.slice(3).trim())}</h2>`;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.every(l => /^[-•]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${escape(l.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(escape).join('<br>')}</p>`;
  }).join('');
}

/** Checks one item of a kind: { value } to save, or { error } in words for the administrator. */
export function validateContent(kind, input, { productIds = null } = {}) {
  const x = input && typeof input === 'object' ? input : {};
  if (kind === 'photo') {
    if (!localFile(x.image)) return { error: 'Загрузите фото.' };
    return { value: { image: x.image, caption: text(x.caption, 200) } };
  }
  if (kind === 'video') {
    const video = videoOf(x.url);
    if (!video) return { error: 'Вставьте ссылку на ролик VK Видео, Rutube или YouTube.' };
    const title = text(x.title, 160);
    if (title.length < 2) return { error: 'Назовите видео.' };
    return { value: { url: video.href, title } };
  }
  if (kind === 'promo') {
    const title = text(x.title, 120);
    if (title.length < 2) return { error: 'Название акции — от 2 знаков.' };
    const body = text(x.text, 1500);
    const from = x.from ? String(x.from) : '', to = x.to ? String(x.to) : '';
    if ((from && !isoDate(from)) || (to && !isoDate(to))) return { error: 'Даты — в формате дня, например 2026-12-01.' };
    if (from && to && from > to) return { error: 'Акция заканчивается раньше, чем начинается.' };
    if (x.image && !localFile(x.image)) return { error: 'Фото акции не загрузилось, загрузите ещё раз.' };
    const link = text(x.link, 300);
    if (link && !sitePath(link)) return { error: 'Ссылка — адрес страницы этого сайта, например /catalog/.' };
    if (x.products !== undefined && (!Array.isArray(x.products) || x.products.length > 24 || x.products.some(id => typeof id !== 'string' || (productIds && !productIds.has(id))))) return { error: 'Выберите до 24 существующих товаров для акции.' };
    return { value: { title, text: body, from, to, image: x.image || '', link, products: [...new Set(x.products ?? [])] } };
  }
  if (kind === 'faq') {
    const q = text(x.q, 300), a = text(x.a, 4000);
    if (q.length < 3) return { error: 'Напишите вопрос.' };
    if (a.length < 3) return { error: 'Напишите ответ.' };
    return { value: { q, a } };
  }
  if (kind === 'article') {
    const title = text(x.title, 200);
    if (title.length < 3) return { error: 'Заголовок статьи — от 3 знаков.' };
    const lead = text(x.lead, 600);
    const body = text(x.body, 40000);
    if (body.length < 20) return { error: 'Напишите текст статьи.' };
    if (x.cover && !localFile(x.cover)) return { error: 'Обложка не загрузилась, загрузите ещё раз.' };
    const date = x.date && isoDate(x.date) ? String(x.date) : '';
    const products = Array.isArray(x.products) ? [...new Set(x.products.filter(id => typeof id === 'string' && (!productIds || productIds.has(id))))].slice(0, 8) : [];
    return { value: { title, lead, body, cover: x.cover || '', date, products } };
  }
  return { error: 'Нет такого раздела.' };
}

/** «12 ноября 2026» from 2026-11-12. */
export const humanDate = iso => isoDate(iso) ? new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** A journal article as the pages read it (the Article shape of the built ones), with its own address /blog/<slug>/. */
export function articleOf(item, productPaths = new Map()) {
  const d = item.data;
  const path = `/blog/${item.slug}/`;
  const html = `${d.lead ? `<p>${escape(d.lead)}</p>` : ''}${textToHtml(d.body)}`;
  return {
    id: `custom-${item.id}`, path, url: path, title: d.title, date: humanDate(d.date || String(item.created_at ?? '').slice(0, 10)),
    description: d.lead || null, image: d.cover || null, images: d.cover ? [d.cover] : [], html, body: d.body,
    related: d.products.map(id => productPaths.get(id)).filter(Boolean), source: { raw: '', markdown: '' }, custom: true,
  };
}

/** An article's address part from its title (latin letters), free among the taken ones. */
export function articleSlug(title, taken) {
  const base = slugOf(title);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Offers shown today: started (or no start) and not ended (or no end); the newest first. */
export const activePromos = (promos, today) => promos.filter(p => (!p.from || p.from <= today) && (!p.to || p.to >= today));

/** A stable key of a built FAQ answer, for hiding it. */
export const faqKey = question => String(question).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200);

/** Puts the added articles into the journal list the pages read (newest first, before the built ones) and takes out
 *  deleted ones; an edited article replaces its old copy. */
export function mergeArticles(articles, added) {
  for (let i = articles.length - 1; i >= 0; i--) if (articles[i].custom) articles.splice(i, 1);
  articles.unshift(...added);
}
