import './admin.css';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ProductPicker } from './personal';
import type { Product } from './content-types';
import { data, money, shortName, useStore } from './store';
import { pricesUnder, readSite, type ProductContent, type ProductOverride, type SiteSettings } from './site';
import { factOrder } from './catalog';
import { productCover } from './product-media.mjs';
import { BackLink, Icon } from './ui';

// «Управление сайтом» (/profile/?admin=1), only for administrator accounts; the server checks the role on every
// request (scripts/site-admin.mjs). Sections: the warehouse rate, a product's prices and stock, customer reviews,
// administrators. An expert comment's stars are set right on the product page (clickable stars an administrator sees).

type Overview = SiteSettings & {
  cbr: { rubPerUsd: number; date: string } | null;
  rateHistory: { rubPerUnit: number; from: number | null; at: string; by: string | null }[];
  reviews: { id: number; productId: string; rating: number; text: string; status: 'pending' | 'published' | 'hidden'; date: string; author: string; email: string }[];
  users: { email: string; name: string; role: string; createdAt: string }[];
};
type Tab = 'rate' | 'products' | 'reviews' | 'users';
const tabs: [Tab, string][] = [['rate', 'Курс у.е.'], ['products', 'Цены и наличие'], ['reviews', 'Отзывы'], ['users', 'Администраторы']];
const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const number = (v: number | null | undefined) => v === null || v === undefined ? '' : String(v).replace('.', ',');
const productName = (id: string) => { const p = data.products.find(x => x.id === id); return p ? shortName(p.name) : id; };

async function adminCall(path: string, body: unknown): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
  try {
    const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, body: await r.json().catch(() => null) };
  } catch { return { ok: false, body: { error: 'Нет связи с сервером. Попробуйте ещё раз.' } }; }
}

export function AdminPanel() {
  const { setSite, notify } = useStore();
  const [tab, setTab] = useState<Tab>('rate');
  // ?tab=reviews (from the bell notice) opens that section.
  useEffect(() => { const t = new URLSearchParams(location.search).get('tab'); if (tabs.some(([id]) => id === t)) setTab(t as Tab); }, []);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch('/api/admin/overview', { headers: { Accept: 'application/json' } }).then(async r => {
    const body = await r.json().catch(() => null);
    if (!r.ok) { setError(body?.error || 'Не удалось открыть раздел.'); return; }
    setOverview(body); setSite(readSite(body));
  }).catch(() => setError('Нет связи с сервером.'));
  useEffect(() => { void load(); }, []);
  /** Runs a change; on success applies the returned site settings (when there are any) and reloads the overview. */
  const run = async (path: string, body: unknown, done: string) => {
    const r = await adminCall(path, body);
    if (!r.ok) { notify(String(r.body?.error || 'Не удалось сохранить.')); return false; }
    if (r.body && 'products' in r.body) setSite(readSite(r.body));
    notify(done); await load(); return true;
  };
  const pending = overview?.reviews.filter(r => r.status === 'pending').length ?? 0;
  return <div className="admin" data-ds-id="admin-panel">
    <BackLink fallback="/profile/" label="Профиль" />
    <header className="admin-head"><span className="ds-kicker">Администратор</span><h1>Управление сайтом</h1></header>
    <nav className="admin-tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{id === 'reviews' && pending > 0 && <span className="admin-count">{pending}</span>}</button>)}</nav>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!overview && !error && <p className="ds-muted">Загружаем…</p>}
    {overview && tab === 'rate' && <RateSection overview={overview} run={run} />}
    {overview && tab === 'products' && <ProductsSection overview={overview} run={run} />}
    {overview && tab === 'reviews' && <ReviewsSection overview={overview} run={run} />}
    {overview && tab === 'users' && <UsersSection overview={overview} run={run} />}
  </div>;
}
type Run = (path: string, body: unknown, done: string) => Promise<boolean>;

function RateSection({ overview, run }: { overview: Overview; run: Run }) {
  const current = overview.rate?.rubPerUnit ?? data.pricing.rubPerUnit;
  const [value, setValue] = useState(number(current));
  const [confirm, setConfirm] = useState(false);
  const next = Number(value.replace(',', '.'));
  const valid = Number.isFinite(next) && next > 0 && next <= 1000;
  const big = valid && Math.abs(next - current) / current > 0.2;
  const sample = data.products.find(p => p.prices.units && p.availability !== 'OutOfStock');
  const sampleAt = (rate: number) => sample ? pricesUnder(sample, { retail: sample.prices.retail, partner: sample.prices.partner }, { rate: { rubPerUnit: rate, updatedAt: '' }, products: {}, hiddenNotes: {} }, data.pricing.rubPerUnit).retail : 0;
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    if (big && !confirm) { setConfirm(true); return; }
    setConfirm(false);
    await run('/api/admin/rate', { rubPerUnit: next, previous: current }, `Курс сохранён: ${number(next)} ₽ за 1 у.е.`);
  };
  return <section className="admin-card" data-ds-id="admin-rate">
    <h2>Курс у.е.</h2>
    <p className="admin-lead">Цены в прайсе — в у.е. (долларах). Рубли на сайте = у.е. × курс. Новый курс сразу меняет все цены: каталог, товары, корзину, розничную и по карте.</p>
    <dl className="admin-facts">
      <div><dt>Сейчас на сайте</dt><dd>{number(current)} ₽ за 1 у.е.{!overview.rate && ' (из прайса)'}</dd></div>
      {overview.cbr && <div><dt>Курс ЦБ на {new Date(overview.cbr.date).toLocaleDateString('ru-RU')}</dt><dd>{number(overview.cbr.rubPerUsd)} ₽ за $ — для сравнения</dd></div>}
    </dl>
    <form className="admin-rate-form" onSubmit={save}>
      <label>Новый курс, ₽ за 1 у.е.<input className="field" inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setConfirm(false); }} /></label>
      <button className="btn btn--primary" disabled={!valid || next === current}>Сохранить</button>
    </form>
    {valid && next !== current && sample && <p className="admin-hint">Например, {shortName(sample.name)}: {money(sampleAt(current))} → {money(sampleAt(next))}</p>}
    {confirm && <div className="admin-confirm" role="alert"><p>Курс меняется с {number(current)} на {number(next)} — больше чем на 20%. Вы уверены?</p><button type="button" className="btn btn--primary" onClick={() => void save()}>Да, сохранить</button><button type="button" className="btn btn--secondary" onClick={() => setConfirm(false)}>Отмена</button></div>}
    <h3>История</h3>
    {overview.rateHistory.length ? <table className="admin-table"><thead><tr><th>Когда</th><th>Курс</th><th>Был</th><th>Кто</th></tr></thead><tbody>{overview.rateHistory.map((h, i) => <tr key={i}><td>{when(h.at)}</td><td>{number(h.rubPerUnit)} ₽</td><td>{h.from ? `${number(h.from)} ₽` : '—'}</td><td>{h.by ?? '—'}</td></tr>)}</tbody></table> : <p className="ds-muted">Курс ещё не меняли: действует курс из прайса.</p>}
  </section>;
}

function ProductsSection({ overview, run }: { overview: Overview; run: Run }) {
  const [picked, setPicked] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (picked) setOpen(picked); }, [picked]);
  const changed = data.products.filter(p => overview.products[p.id] && p.id !== picked);
  const product = data.products.find(p => p.id === picked);
  const row = (p: Product) => <li key={p.id}>
    <button type="button" className="admin-product-row" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
      <span><strong>{shortName(p.name)}</strong><small>Арт. {p.article ?? '—'}{overview.products[p.id] ? ' · изменён' : ''}</small></span>
      <span className="admin-product-prices">{money(p.prices.retail)}{p.prices.partner !== null && <small>по карте {money(p.prices.partner)}</small>}<small className={p.availability === 'OutOfStock' ? 'out' : 'in'}>{p.availability === 'OutOfStock' ? 'Нет в наличии' : 'В наличии'}</small></span>
    </button>
    {open === p.id && <ProductTabs key={p.id} product={p} override={overview.products[p.id]} run={run} />}
  </li>;
  return <section className="admin-card" data-ds-id="admin-products">
    <h2>Цены и наличие</h2>
    <p className="admin-lead">Выберите товар: впишите название или артикул, или откройте список стрелкой и пролистайте. Пустое поле цены — цена из прайса по текущему курсу. «Нет в наличии» включает кнопку «Сообщить о поступлении»; когда товар снова в наличии, ждущие покупатели получат уведомление.</p>
    <div className="admin-picker"><ProductPicker exclude={[]} value={picked} onChange={setPicked} placeholder="Название или артикул" label="Товар" /></div>
    {product && <ul className="admin-products">{row(product)}</ul>}
    <h3>{changed.length ? 'Изменённые товары' : product ? '' : 'Изменённых товаров пока нет'}</h3>
    <ul className="admin-products">{changed.map(row)}</ul>
  </section>;
}

type EditTab = 'price' | 'about' | 'facts' | 'docs' | 'photo';
const editTabs: [EditTab, string][] = [['price', 'Цены и наличие'], ['about', 'Название и описание'], ['facts', 'Состав и применение'], ['docs', 'Сертификаты'], ['photo', 'Фото']];
/** A product's editor: prices and stock, and the card's content (everything a visitor sees on the product page). */
function ProductTabs({ product: p, override, run }: { product: Product; override?: ProductOverride; run: Run }) {
  const [tab, setTab] = useState<EditTab>('price');
  return <div className="admin-editor">
    <nav className="admin-subtabs" role="tablist">{editTabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'price' ? <ProductEditor product={p} override={override} run={run} /> : <ContentEditor product={p} tab={tab} run={run} />}
  </div>;
}

type Base = { name: string; about: string[]; highlights: string[]; description: string; properties: Record<string, string>; documents: { name: string; url: string }[] };
const paragraphs = (s: string) => s.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
/** Name, description, composition, certificates and photo of a card. It starts from what the card shows now (the
 *  administrator's earlier changes, else the built card) and saves the whole content at once. */
function ContentEditor({ product: p, tab, run }: { product: Product; tab: Exclude<EditTab, 'price'>; run: Run }) {
  const { notify } = useStore();
  const [base, setBase] = useState<Base | null>(null);
  const [saved, setSaved] = useState<ProductContent | null>(null);
  const [f, setF] = useState<{ name: string; about: string; highlights: string; properties: Record<string, string>; documents: { name: string; url: string }[]; image: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    fetch(`/api/product-content?id=${encodeURIComponent(p.id)}`, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then((b: { base: Base | null; content: ProductContent | null } | null) => {
      if (off || !b?.base) return;
      const c = b.content ?? {};
      setBase(b.base); setSaved(b.content);
      setF({ name: c.name ?? b.base.name, about: (c.about ?? (b.base.about.length ? b.base.about : paragraphs(b.base.description))).join('\n\n'), highlights: (c.highlights ?? b.base.highlights).join('\n'), properties: Object.fromEntries(factOrder.map(([key]) => [key, c.properties?.[key] ?? b.base!.properties[key] ?? ''])), documents: c.documents ?? b.base.documents, image: c.image ?? '' });
    }).catch(() => { /* shown as loading */ });
    return () => { off = true; };
  }, [p.id]);
  if (!f || !base) return <p className="ds-muted">Загружаем карточку…</p>;
  const set = <K extends keyof NonNullable<typeof f>>(k: K, v: NonNullable<typeof f>[K]) => setF(x => x && { ...x, [k]: v });
  const upload = async (file: File, kind: 'image' | 'document') => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/upload?product=${encodeURIComponent(p.id)}&kind=${kind}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      const b = await r.json().catch(() => null);
      if (!r.ok) { notify(b?.error || 'Не удалось загрузить файл.'); return null; }
      return b as { url: string; name: string };
    } catch { notify('Нет связи с сервером.'); return null; } finally { setBusy(false); }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const props = Object.fromEntries(Object.entries(f.properties).filter(([k, v]) => v.trim() !== (base.properties[k] ?? '').trim()));
    const content: ProductContent = {
      ...(f.name.trim() !== base.name ? { name: f.name.trim() } : {}),
      ...(paragraphs(f.about).join('\n\n') !== (base.about.length ? base.about : paragraphs(base.description)).join('\n\n') ? { about: paragraphs(f.about) } : {}),
      ...(lines(f.highlights).join('\n') !== base.highlights.join('\n') ? { highlights: lines(f.highlights) } : {}),
      ...(Object.keys(props).length ? { properties: props } : {}),
      ...(JSON.stringify(f.documents) !== JSON.stringify(base.documents) ? { documents: f.documents } : {}),
      ...(f.image ? { image: f.image } : {}),
    };
    if (await run('/api/admin/content', Object.keys(content).length ? { productId: p.id, content } : { productId: p.id, reset: true }, `Сохранено: ${shortName(f.name)}`)) setSaved(Object.keys(content).length ? content : null);
  };
  const reset = async () => { if (await run('/api/admin/content', { productId: p.id, reset: true }, `Как было: ${shortName(base.name)}`)) { setSaved(null); setF({ name: base.name, about: (base.about.length ? base.about : paragraphs(base.description)).join('\n\n'), highlights: base.highlights.join('\n'), properties: Object.fromEntries(factOrder.map(([key]) => [key, base.properties[key] ?? ''])), documents: base.documents, image: '' }); } };
  const cover = f.image || productCover({ ...p, adminImage: undefined });
  return <form className="admin-content" onSubmit={save}>
    {tab === 'about' && <>
      <label>Название<input className="field" value={f.name} onChange={e => set('name', e.target.value)} /></label>
      <label>Описание — абзацы через пустую строку<textarea className="field" rows={8} value={f.about} onChange={e => set('about', e.target.value)} /></label>
      <label>Главное о продукте — по одному пункту в строке<textarea className="field" rows={4} value={f.highlights} onChange={e => set('highlights', e.target.value)} /></label>
    </>}
    {tab === 'facts' && factOrder.map(([key, label]) => <label key={key}>{label}<textarea className="field" rows={key.startsWith('Состав') || key === 'Применение' ? 4 : 2} placeholder="Пусто — пункт не показывается" value={f.properties[key]} onChange={e => set('properties', { ...f.properties, [key]: e.target.value })} /></label>)}
    {tab === 'docs' && <>
      <div className="admin-docs">{f.documents.map((d, i) => <figure key={d.url}><img src={d.url} alt={`Сертификат, страница ${i + 1}`} loading="lazy" /><button type="button" className="btn btn--secondary" onClick={() => set('documents', f.documents.filter((_, j) => j !== i))}>Убрать</button></figure>)}</div>
      {!f.documents.length && <p className="ds-muted">Сертификатов нет — вкладка «Сертификаты» на странице товара не показывается.</p>}
      <label className="admin-file">Добавить скан сертификата (JPG, PNG, WEBP)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const up = await upload(file, 'document'); if (up) set('documents', [...f.documents, up]); }} /></label>
    </>}
    {tab === 'photo' && <>
      <div className="admin-photo">{cover && <img src={cover} alt={p.name} />}</div>
      <label className="admin-file">Загрузить другое фото (JPG, PNG, WEBP)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const up = await upload(file, 'image'); if (up) set('image', up.url); }} /></label>
      {f.image && <button type="button" className="btn btn--secondary" onClick={() => set('image', '')}>Вернуть исходное фото</button>}
    </>}
    <p className="admin-hint-muted">Изменения видны на сайте после «Сохранить». Новый файл сохраняется вместе с карточкой.</p>
    <div className="admin-editor-actions"><button className="btn btn--primary" disabled={busy}>{busy ? 'Загружаем файл…' : 'Сохранить'}</button>{saved && <button type="button" className="btn btn--secondary" onClick={() => void reset()}>Вернуть всё как было</button>}<a href={p.path} className="admin-link">Открыть товар</a></div>
  </form>;
}

function ProductEditor({ product: p, override: o, run }: { product: Product; override?: ProductOverride; run: Run }) {
  const [f, setF] = useState({ retailUnits: number(o?.retailUnits), partnerUnits: number(o?.partnerUnits), retailRub: number(o?.retailRub), partnerRub: number(o?.partnerRub), availability: o?.availability ?? (p.availability === 'OutOfStock' ? 'OutOfStock' : 'InStock') });
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const save = (e: FormEvent) => { e.preventDefault(); void run('/api/admin/product', { productId: p.id, ...f }, `Сохранено: ${shortName(p.name)}`); };
  const units = p.prices.units;
  return <form className="admin-price" onSubmit={save}>
    <div className="admin-editor-grid">
      <label>Розничная, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.retail)} по прайсу` : 'нет в прайсе'} value={f.retailUnits} onChange={e => set('retailUnits')(e.target.value)} /></label>
      <label>По карте, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.partner)} по прайсу` : 'нет в прайсе'} value={f.partnerUnits} onChange={e => set('partnerUnits')(e.target.value)} /></label>
      <label>Розничная, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.retailRub} onChange={e => set('retailRub')(e.target.value)} /></label>
      <label>По карте, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.partnerRub} onChange={e => set('partnerRub')(e.target.value)} /></label>
    </div>
    <div className="admin-choice" role="radiogroup" aria-label="Наличие">{([['InStock', 'В наличии'], ['OutOfStock', 'Нет в наличии']] as const).map(([v, label]) => <button type="button" key={v} role="radio" aria-checked={f.availability === v} className={f.availability === v ? 'active' : ''} onClick={() => set('availability')(v)}>{label}</button>)}</div>
    <div className="admin-editor-actions"><button className="btn btn--primary">Сохранить</button>{o && <button type="button" className="btn btn--secondary" onClick={() => void run('/api/admin/product', { productId: p.id, reset: true }, `Как в прайсе: ${shortName(p.name)}`)}>Вернуть как в прайсе</button>}<a href={p.path} className="admin-link">Открыть товар</a></div>
  </form>;
}

function ReviewsSection({ overview, run }: { overview: Overview; run: Run }) {
  const [removing, setRemoving] = useState<Overview['reviews'][number] | null>(null);
  const label = { pending: 'Ждёт проверки', published: 'Опубликован', hidden: 'Скрыт' };
  return <section className="admin-card" data-ds-id="admin-reviews">
    <h2>Отзывы покупателей</h2>
    <p className="admin-lead">Новый отзыв появляется на сайте только после того, как вы его опубликуете. Звёзды у комментариев экспертов администратор меняет прямо на странице товара, во вкладке «Отзывы».</p>
    {!overview.reviews.length && <p className="ds-muted">Отзывов пока нет.</p>}
    <ul className="admin-reviews">{overview.reviews.map(r => <li key={r.id} className={`admin-review admin-review--${r.status}`}>
      <header><strong>{productName(r.productId)}</strong><span className="admin-status">{label[r.status]}</span></header>
      <p className="admin-review-meta">{r.author} ({r.email}) · {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {when(r.date)}</p>
      <p>{r.text}</p>
      <div className="admin-editor-actions">
        {r.status !== 'published' && <button type="button" className="btn btn--primary" onClick={() => void run('/api/admin/review', { id: r.id, status: 'published' }, 'Отзыв опубликован')}>Опубликовать</button>}
        <button type="button" className="btn btn--secondary" onClick={() => setRemoving(r)}>Удалить</button>
      </div>
    </li>)}</ul>
    {removing && <ConfirmDialog title="Удалить отзыв?" confirm="Удалить" onCancel={() => setRemoving(null)} onConfirm={() => { const r = removing; setRemoving(null); void run('/api/admin/review', { id: r.id, status: 'deleted' }, 'Отзыв удалён'); }}>
      <p>Вы действительно хотите удалить отзыв {removing.author} о товаре «{productName(removing.productId)}»?</p>
      <blockquote>{removing.text}</blockquote>
      <p className="ds-muted">Восстановить его будет нельзя.</p>
    </ConfirmDialog>}
  </section>;
}

/** A confirmation in its own window over the page: Escape or a click outside cancels. */
function ConfirmDialog({ title, confirm, children, onConfirm, onCancel }: { title: string; confirm: string; children: ReactNode; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); }; addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [onCancel]);
  return <div className="admin-dialog-backdrop" onClick={onCancel}>
    <div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" onClick={e => e.stopPropagation()}>
      <h2 id="admin-dialog-title">{title}</h2>
      {children}
      <div className="admin-editor-actions"><button type="button" className="btn btn--danger" autoFocus onClick={onConfirm}>{confirm}</button><button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button></div>
    </div>
  </div>;
}

function UsersSection({ overview, run }: { overview: Overview; run: Run }) {
  const { state } = useStore();
  const me = state.account?.email.toLowerCase();
  const admins = overview.users.filter(u => u.role === 'admin');
  const [q, setQ] = useState('');
  const others = overview.users.filter(u => u.role !== 'admin' && q.trim() && (u.email.toLowerCase().includes(q.trim().toLowerCase()) || u.name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 20);
  return <section className="admin-card" data-ds-id="admin-users">
    <h2>Администраторы</h2>
    <p className="admin-lead">Администратор видит этот раздел и может менять курс, цены, наличие и отзывы. Сначала человек регистрируется на сайте, потом вы находите его здесь по почте. Всего аккаунтов: {overview.users.length}.</p>
    <ul className="admin-users">{admins.map(u => <li key={u.email}><span><strong>{u.name}</strong><small>{u.email}</small></span>{u.email.toLowerCase() !== me && <button type="button" className="btn btn--secondary" onClick={() => void run('/api/admin/user', { email: u.email, role: 'customer' }, `${u.email} больше не администратор`)}>Убрать права</button>}</li>)}</ul>
    <h3>Назначить администратора</h3>
    <label className="admin-search"><Icon name="search" size={18} /><input className="field" placeholder="Почта или имя" value={q} onChange={e => setQ(e.target.value)} /></label>
    <ul className="admin-users">{others.map(u => <li key={u.email}><span><strong>{u.name}</strong><small>{u.email}</small></span><button type="button" className="btn btn--primary" onClick={() => void run('/api/admin/user', { email: u.email, role: 'admin' }, `${u.email} теперь администратор`)}>Сделать администратором</button></li>)}</ul>
    {q.trim() && !others.length && <p className="ds-muted">Такого покупателя нет.</p>}
  </section>;
}
