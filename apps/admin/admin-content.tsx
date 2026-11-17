import {siteUrl} from './links';
import {AdminBackButton} from './admin-form';
import {ContentPreviewButton} from './admin-preview';
import {RequiredLabel,RequiredHint,RequiredMark} from './admin-form';
import { useEffect, useState, type FormEvent } from 'react';
import type { ContentPage } from '../../src/content-types';
import { data, shortName, today, useStore } from '../../src/store';
import { emptyContent, type SiteSettings } from '../../src/site';
import { activePromos, faqKey, humanDate, videoOf, VIDEO_SOURCES } from '../../src/site-content.mjs';
import { faqSections, videoSections } from '../../src/information-content.mjs';
import { ProductPicker } from '../../src/personal';
import { Icon } from '../../src/ui';

// «Контент» in site management (research 2026-11-11: shops let staff publish offers, photos, videos, articles and FAQ
// themselves, as short forms of plain fields). Each section lists what is on the site and has one form to add or change
// an entry; the old site's videos, articles and answers can be hidden and brought back. Saved through
// /api/admin/site-content (scripts/site-admin.mjs), shown by the pages from the site settings (src/site-content.mjs).

type Run = (path: string, body: unknown, done: string) => Promise<boolean>;
type Section = { site: SiteSettings; run: Run };
export type ContentTab = 'promos' | 'photos' | 'videos' | 'journal' | 'faq';

/** The built text of a page (the browser's catalog data leaves page texts out): read from that page's own data. */
function usePageHtml(path: string) {
  const [html, setHtml] = useState(() => (data.pages.find(p => p.path === path) as ContentPage | undefined)?.html ?? '');
  useEffect(() => {
    if (html) return;
    let off = false;
    fetch('/api/admin/preview-data?page='+encodeURIComponent(path)).then(r=>{
      if(!r.ok)throw Error('Не удалось загрузить содержимое страницы');return r.json();
    }).then(body=>{if(!off)setHtml(body.page?.html??'')}).catch(()=>{/* existing list remains available on retry */});
    return () => { off = true; };
  }, [path]);
  return html;
}
const hidden = (site: SiteSettings, kind: string, key: string) => Boolean(site.hiddenContent?.[kind]?.includes(key));
const call = (run: Run, kind: string, action: string, extra: Record<string, unknown>, done: string) => run('/api/admin/site-content', { kind, action, ...extra }, done);

/** A phone photo can be 10 MB: it is made at most 2000 px on the long side (WebP) before it is sent. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('encode')), 'image/webp', 0.9));
  } catch { return file; }
}
async function upload(file: File, notify: (s: string) => void): Promise<string | null> {
  const blob = await shrink(file);
  try {
    const r = await fetch(`/api/admin/upload?product=content&kind=image&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    const b = await r.json().catch(() => null);
    if (!r.ok) { notify(b?.error || 'Не удалось загрузить фото.'); return null; }
    return b.url as string;
  } catch { notify('Нет связи с сервером.'); return null; }
}

export function ImageField({ label, value, onChange, required=false }: { label: string; value: string; onChange: (url: string) => void; required?:boolean }) {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);
  return <div className="admin-content-image">
    {value && <img src={value} alt="" />}
    <label className="admin-file">{busy ? 'Загружаем…' : value ? `${label}: заменить` : label}{required&&<RequiredMark/>}<input aria-required={required} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); const url = await upload(file, notify); setBusy(false); if (url) onChange(url); }} /></label>
    {value && <button type="button" className="btn btn--secondary" onClick={() => onChange('')}>Убрать фото</button>}
  </div>;
}

/** A row of the list: what it is, and its buttons. */
function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <li className="admin-content-row"><span><strong>{title}</strong>{note && <small>{note}</small>}</span><span className="admin-content-actions">{children}</span></li>;
}
function Remove({ onYes, what }: { onYes: () => void; what: string }) {
  const [sure, setSure] = useState(false);
  return sure ? <><span className="admin-content-ask">Удалить {what}?</span><button type="button" className="btn btn--primary" onClick={onYes}>Да</button><button type="button" className="btn btn--secondary" onClick={() => setSure(false)}>Нет</button></>
    : <button type="button" className="btn btn--secondary" onClick={() => setSure(true)}>Удалить</button>;
}

// ── Акции ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const noPromo = { title: '', text: '', from: '', to: '', image: '', link: '', products: [] as string[] };
export function PromosSection({ site, run }: Section) {
  const promos = (site.content ?? emptyContent).promos;
  const [edit, setEdit] = useState<{ id: number | null; f: typeof noPromo } | null>(null);
  const [pick, setPick] = useState('');
  const now = today();
  const running = new Set(activePromos(promos, now).map(p => p.id));
  const save = async (e: FormEvent) => { e.preventDefault(); if (!edit) return; if (await call(run, 'promo', edit.id ? 'update' : 'add', { id: edit.id, item: edit.f }, edit.id ? 'Акция сохранена' : 'Акция добавлена')) setEdit(null); };
  const set = <K extends keyof typeof noPromo>(k: K) => (v: (typeof noPromo)[K]) => setEdit(x => x && { ...x, f: { ...x.f, [k]: v } });
  return <section className="admin-card" data-ds-id="admin-promos">
    <p className="admin-lead">Выберите товары — на странице «Акции» они появятся карточками каталога под условиями акции. Цены и метки скидки задаются в редакторе товара. С датой окончания акция уходит со страницы сама на следующий день.</p>
    {!edit && <button type="button" className="btn btn--primary admin-new-product-open" onClick={() => setEdit({ id: null, f: noPromo })}><Icon name="plus" size={18} />Новая акция</button>}
    {edit && <form className="admin-editor admin-content-form" onSubmit={save}><AdminBackButton onClick={()=>setEdit(null)}>К акциям</AdminBackButton><RequiredHint/>
      <label><RequiredLabel>Название</RequiredLabel><input className="field" value={edit.f.title} onChange={e => set('title')(e.target.value)} placeholder="Например: −15% на омега-3" required /></label>
      <label>Условия — абзацы через пустую строку<textarea className="field" rows={5} value={edit.f.text} onChange={e => set('text')(e.target.value)} /></label>
      <div className="admin-editor-grid">
        <label>Начало<input className="field" type="date" value={edit.f.from} onChange={e => set('from')(e.target.value)} /></label>
        <label>Окончание<input className="field" type="date" value={edit.f.to} onChange={e => set('to')(e.target.value)} /></label>
        <label>Ссылка «Подробнее»<input className="field" value={edit.f.link} onChange={e => set('link')(e.target.value)} placeholder="/catalog/ — необязательно" /></label>
      </div>
      <div className="admin-content-products"><span>Товары акции</span>
        <ul>{edit.f.products.map(id=><li key={id}>{shortName(data.products.find(p=>p.id===id)?.name??id)}<button type="button" aria-label="Убрать товар из акции" onClick={()=>set('products')(edit.f.products.filter(x=>x!==id))}><Icon name="close" size={14}/></button></li>)}</ul>
        {edit.f.products.length<24&&<div className="admin-picker"><ProductPicker exclude={edit.f.products} value={pick} onChange={id=>{if(id){set('products')([...edit.f.products,id]);setPick('')}}} placeholder="Добавить товар: название или артикул" label="Товар акции"/></div>}
      </div>
      <ImageField label="Обложка акции — необязательно" value={edit.f.image} onChange={set('image')} />
      <div className="admin-editor-actions"><ContentPreviewButton kind="promo" item={edit.f}/><button className="btn btn--primary">{edit.id ? 'Сохранить' : 'Добавить акцию'}</button><button type="button" className="btn btn--secondary" onClick={() => setEdit(null)}>Отмена</button></div>
    </form>}
    {promos.length ? <ul className="admin-content-list">{promos.map(p => <Row key={p.id} title={p.title} note={running.has(p.id) ? (p.to ? `Идёт до ${humanDate(p.to)}` : 'Идёт') : p.from > now ? `Начнётся ${humanDate(p.from)}` : 'Закончилась — на сайте не видна'}>
      <button type="button" className="btn btn--secondary" onClick={() => setEdit({ id: p.id, f: { title: p.title, text: p.text, from: p.from, to: p.to, image: p.image, link: p.link, products: p.products ?? [] } })}>Изменить</button>
      <Remove what="акцию" onYes={() => void call(run, 'promo', 'delete', { id: p.id }, 'Акция удалена')} />
    </Row>)}</ul> : <p className="ds-muted">Акций пока нет — на сайте написано «Акций пока нет».</p>}
  </section>;
}

// ── Фото ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function PhotosSection({ site, run }: Section) {
  const { notify } = useStore();
  const photos = (site.content ?? emptyContent).photos;
  const [busy, setBusy] = useState(0);
  const [draftPhotos,setDraftPhotos]=useState<{image:string;caption:string}[]>([]);
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const add = async (files: File[]) => {
    for (const file of files) {
      setBusy(n => n + 1);
      const url = await upload(file, notify);
      if (url) setDraftPhotos(items=>[...items,{image:url,caption:''}]);
      setBusy(n => n - 1);
    }
  };
  return <section className="admin-card" data-ds-id="admin-photos">
    <p className="admin-lead">Фото видны на странице «Фотогалерея», новые — первыми. Можно выбрать сразу несколько; большие снимки с телефона уменьшаются перед загрузкой.</p>
    <label className="btn btn--primary admin-new-product-open admin-file-button"><Icon name="plus" size={18} />{busy ? `Загружаем… (${busy})` : 'Добавить фото'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy > 0} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void add(files); }} /></label>
    {draftPhotos.length>0&&<div className="admin-photo-drafts"><h3>Новые фото — ещё не опубликованы</h3><ul className="admin-photo-grid">{draftPhotos.map((photo,index)=><li key={photo.image}><img src={photo.image} alt={photo.caption||'Новое фото'}/><input className="field" aria-label="Подпись нового фото" value={photo.caption} onChange={e=>setDraftPhotos(items=>items.map((p,i)=>i===index?{...p,caption:e.target.value}:p))}/><ContentPreviewButton kind="photo" item={photo}/><button type="button" className="btn btn--primary" onClick={async()=>{if(await call(run,'photo','add',{item:photo},'Фото опубликовано'))setDraftPhotos(items=>items.filter(p=>p!==photo))}}>Опубликовать фото</button><button className="btn" type="button" onClick={()=>setDraftPhotos(items=>items.filter(p=>p!==photo))}>Убрать из черновиков</button></li>)}</ul></div>}
    {photos.length ? <ul className="admin-photo-grid">{photos.map(p => <li key={p.id}>
      <img src={p.image} alt={p.caption || 'Фото'} loading="lazy" />
      <input className="field" value={captions[p.id] ?? p.caption} placeholder="Подпись — необязательно" onChange={e => setCaptions(c => ({ ...c, [p.id]: e.target.value }))} />
      <span className="admin-content-actions"><ContentPreviewButton kind="photo" item={{image:p.image,caption:captions[p.id]??p.caption}}/>{(captions[p.id] ?? p.caption) !== p.caption && <button type="button" className="btn btn--primary" onClick={() => void call(run, 'photo', 'update', { id: p.id, item: { image: p.image, caption: captions[p.id] } }, 'Подпись сохранена')}>Сохранить</button>}<Remove what="фото" onYes={() => void call(run, 'photo', 'delete', { id: p.id }, 'Фото удалено')} /></span>
    </li>)}</ul> : <p className="ds-muted">Фото пока нет — на сайте написано «Фото пока нет».</p>}
  </section>;
}

// ── Видео ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function VideosSection({ site, run }: Section) {
  const added = (site.content ?? emptyContent).videos;
  const built = videoSections(usePageHtml('/video/')) as { id: string; title: string }[];
  const [f, setF] = useState({ url: '', title: '' });
  const info = f.url ? videoOf(f.url) : null;
  const save = async (e: FormEvent) => { e.preventDefault(); if (await call(run, 'video', 'add', { item: f }, 'Видео добавлено')) setF({ url: '', title: '' }); };
  return <section className="admin-card" data-ds-id="admin-videos">
    <p className="admin-lead">Видео не загружается на сайт, а добавляется ссылкой на ролик в VK Видео, Rutube или YouTube: так оно не занимает место и открывается в их плеере. VK Видео и Rutube в России открываются без замедлений.</p>
    <form className="admin-editor admin-content-form" onSubmit={save}><RequiredHint/>
      <div className="admin-editor-grid">
        <label><RequiredLabel>Ссылка на ролик</RequiredLabel><input className="field" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://vkvideo.ru/video-…" required /></label>
        <label><RequiredLabel>Название</RequiredLabel><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required /></label>
      </div>
      {f.url && <p className={info ? 'admin-hint-muted' : 'admin-error'}>{info ? `Ролик ${VIDEO_SOURCES[info.source]} — подходит.` : 'Это не ссылка на ролик VK Видео, Rutube или YouTube.'}</p>}
      <div className="admin-editor-actions"><ContentPreviewButton kind="video" item={f}/><button className="btn btn--primary" disabled={!info}>Добавить видео</button></div>
    </form>
    <h3>На сайте</h3>
    <ul className="admin-content-list">
      {added.map(v => <Row key={`a${v.id}`} title={v.title} note={`${VIDEO_SOURCES[videoOf(v.url)?.source ?? ''] ?? ''} · добавлено здесь`}><a className="btn btn--secondary" href={v.url} target="_blank" rel="noopener">Открыть</a><Remove what="видео" onYes={() => void call(run, 'video', 'delete', { id: v.id }, 'Видео удалено')} /></Row>)}
      {built.map(v => { const off = hidden(site, 'video', v.id); return <Row key={v.id} title={v.title} note={off ? 'Скрыто с сайта' : 'YouTube · со старого сайта'}>
        <button type="button" className={`btn ${off ? 'btn--primary' : 'btn--secondary'}`} onClick={() => void call(run, 'video', off ? 'show' : 'hide', { key: v.id }, off ? 'Видео снова на сайте' : 'Видео скрыто')}>{off ? 'Вернуть' : 'Скрыть'}</button>
      </Row>; })}
    </ul>
  </section>;
}

// ── Журнал ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const noArticle = { title: '', date: '', lead: '', body: '', cover: '', products: [] as string[] };
export function JournalSection({ site, run }: Section) {
  const added = (site.content ?? emptyContent).articles;
  const built = data.articles.filter(a => !a.custom);
  const [edit, setEdit] = useState<{ id: number | null; f: typeof noArticle } | null>(null);
  const [pick, setPick] = useState('');
  const set = <K extends keyof typeof noArticle>(k: K) => (v: (typeof noArticle)[K]) => setEdit(x => x && { ...x, f: { ...x.f, [k]: v } });
  const save = async (e: FormEvent) => { e.preventDefault(); if (!edit) return; if (await call(run, 'article', edit.id ? 'update' : 'add', { id: edit.id, item: edit.f }, edit.id ? 'Статья сохранена' : 'Статья опубликована в журнале')) setEdit(null); };
  return <section className="admin-card" data-ds-id="admin-journal">
    <p className="admin-lead">Статья появляется в «Журнале о заботе» и на главной, новые — первыми. Поисковики видят её текст сразу.</p>
    {!edit && <button type="button" className="btn btn--primary admin-new-product-open" onClick={() => setEdit({ id: null, f: { ...noArticle, date: today() } })}><Icon name="plus" size={18} />Новая статья</button>}
    {edit && <form className="admin-editor admin-content-form" onSubmit={save}><AdminBackButton onClick={()=>setEdit(null)}>К статьям</AdminBackButton><RequiredHint/>
      <div className="admin-editor-grid">
        <label><RequiredLabel>Заголовок</RequiredLabel><input className="field" value={edit.f.title} onChange={e => set('title')(e.target.value)} required /></label>
        <label>Дата<input className="field" type="date" value={edit.f.date} onChange={e => set('date')(e.target.value)} /></label>
      </div>
      <ImageField label="Обложка" value={edit.f.cover} onChange={set('cover')} />
      <label>Вводный абзац — коротко, о чём статья<textarea className="field" rows={3} value={edit.f.lead} onChange={e => set('lead')(e.target.value)} /></label>
      <label><RequiredLabel>Текст статьи</RequiredLabel><textarea className="field" rows={14} value={edit.f.body} onChange={e => set('body')(e.target.value)} required /></label>
      <p className="admin-hint-muted">Абзацы разделяйте пустой строкой. Подзаголовок — строка, начинающаяся с «## ». Список — строки, начинающиеся с «- ».</p>
      <div className="admin-content-products"><span>Товары из статьи — карточки под текстом</span>
        <ul>{edit.f.products.map(id => <li key={id}>{shortName(data.products.find(p => p.id === id)?.name ?? id)}<button type="button" aria-label="Убрать товар" onClick={() => set('products')(edit.f.products.filter(x => x !== id))}><Icon name="close" size={14} /></button></li>)}</ul>
        {edit.f.products.length < 8 && <div className="admin-picker"><ProductPicker exclude={edit.f.products} value={pick} onChange={id => { if (id) { set('products')([...edit.f.products, id]); setPick(''); } }} placeholder="Добавить товар: название или артикул" label="Товар статьи" /></div>}
      </div>
      <div className="admin-editor-actions"><ContentPreviewButton kind="article" item={edit.f}/><button className="btn btn--primary">{edit.id ? 'Сохранить' : 'Опубликовать'}</button><button type="button" className="btn btn--secondary" onClick={() => setEdit(null)}>Отмена</button></div>
    </form>}
    <h3>Статьи</h3>
    <ul className="admin-content-list">
      {added.map(a => <Row key={a.path} title={a.title} note={`${a.date} · добавлена здесь`}><a className="btn btn--secondary" href={siteUrl(a.path)} target="_blank" rel="noopener">Открыть</a><button type="button" className="btn btn--secondary" onClick={() => setEdit({ id: a.contentId, f: { ...noArticle, ...a.data } })}>Изменить</button><Remove what="статью" onYes={() => void call(run, 'article', 'delete', { id: a.contentId }, 'Статья удалена')} /></Row>)}
      {built.map(a => { const off = hidden(site, 'article', a.id); return <Row key={a.id} title={a.title} note={off ? 'Скрыта с сайта' : `${a.date ?? ''} · со старого сайта`}>
        <a className="btn btn--secondary" href={siteUrl(a.path)} target="_blank" rel="noopener">Открыть</a>
        <button type="button" className={`btn ${off ? 'btn--primary' : 'btn--secondary'}`} onClick={() => void call(run, 'article', off ? 'show' : 'hide', { key: a.id }, off ? 'Статья снова в журнале' : 'Статья скрыта')}>{off ? 'Вернуть' : 'Скрыть'}</button>
      </Row>; })}
    </ul>
  </section>;
}

// ── Частые вопросы ─────────────────────────────────────────────────────────────────────────────────────────────────
export function FaqSection({ site, run }: Section) {
  const added = (site.content ?? emptyContent).faq;
  const built = faqSections(usePageHtml('/company/faq/')).filter((s: { level: number }) => s.level !== 2) as { title: string }[];
  const [edit, setEdit] = useState<{ id: number | null; q: string; a: string } | null>(null);
  const save = async (e: FormEvent) => { e.preventDefault(); if (!edit) return; if (await call(run, 'faq', edit.id ? 'update' : 'add', { id: edit.id, item: { q: edit.q, a: edit.a } }, edit.id ? 'Ответ сохранён' : 'Вопрос добавлен')) setEdit(null); };
  return <section className="admin-card" data-ds-id="admin-faq">
    <p className="admin-lead">Вопросы на странице «Частые вопросы». Добавленные здесь стоят первыми; вопросы со старого сайта можно скрыть.</p>
    {!edit && <button type="button" className="btn btn--primary admin-new-product-open" onClick={() => setEdit({ id: null, q: '', a: '' })}><Icon name="plus" size={18} />Новый вопрос</button>}
    {edit && <form className="admin-editor admin-content-form" onSubmit={save}><AdminBackButton onClick={()=>setEdit(null)}>К вопросам</AdminBackButton><RequiredHint/>
      <label><RequiredLabel>Вопрос</RequiredLabel><input className="field" value={edit.q} onChange={e => setEdit({ ...edit, q: e.target.value })} required /></label>
      <label><RequiredLabel>Ответ — абзацы через пустую строку, список строками с «- »</RequiredLabel><textarea className="field" rows={6} value={edit.a} onChange={e => setEdit({ ...edit, a: e.target.value })} required /></label>
      <div className="admin-editor-actions"><ContentPreviewButton kind="faq" item={{q:edit.q,a:edit.a}}/><button className="btn btn--primary">{edit.id ? 'Сохранить' : 'Добавить вопрос'}</button><button type="button" className="btn btn--secondary" onClick={() => setEdit(null)}>Отмена</button></div>
    </form>}
    <ul className="admin-content-list">
      {added.map(x => <Row key={`a${x.id}`} title={x.q} note="Добавлен здесь"><button type="button" className="btn btn--secondary" onClick={() => setEdit({ id: x.id, q: x.q, a: x.a })}>Изменить</button><Remove what="вопрос" onYes={() => void call(run, 'faq', 'delete', { id: x.id }, 'Вопрос удалён')} /></Row>)}
      {built.map(s => { const key = faqKey(s.title); const off = hidden(site, 'faq', key); return <Row key={key} title={s.title} note={off ? 'Скрыт с сайта' : 'Со старого сайта'}>
        <button type="button" className={`btn ${off ? 'btn--primary' : 'btn--secondary'}`} onClick={() => void call(run, 'faq', off ? 'show' : 'hide', { key }, off ? 'Вопрос снова на сайте' : 'Вопрос скрыт')}>{off ? 'Вернуть' : 'Скрыть'}</button>
      </Row>; })}
    </ul>
  </section>;
}
