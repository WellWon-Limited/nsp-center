import './admin.css';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ProductPicker } from './personal';
import type { Product } from './content-types';
import { data, money, shortName, useStore } from './store';
import { pricesUnder, readSite, type ProductOverride, type SiteSettings } from './site';
import { BackLink, Icon } from './ui';

// «Управление сайтом» (/profile/?admin=1), only for administrator accounts; the server checks the role on every
// request (scripts/site-admin.mjs). Sections: the warehouse rate, a product's prices and stock, customer reviews,
// administrators. Expert comments are hidden right on the product page (the «Скрыть» button an administrator sees).

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
  const sampleAt = (rate: number) => sample ? pricesUnder(sample, { retail: sample.prices.retail, partner: sample.prices.partner, availability: null, availability_text: null }, { rate: { rubPerUnit: rate, updatedAt: '' }, products: {}, hiddenNotes: {} }, data.pricing.rubPerUnit).retail : 0;
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
    {open === p.id && <ProductEditor key={p.id} product={p} override={overview.products[p.id]} run={run} />}
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

function ProductEditor({ product: p, override: o, run }: { product: Product; override?: ProductOverride; run: Run }) {
  const [f, setF] = useState({ retailUnits: number(o?.retailUnits), partnerUnits: number(o?.partnerUnits), retailRub: number(o?.retailRub), partnerRub: number(o?.partnerRub), availability: o?.availability ?? '' });
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const save = (e: FormEvent) => { e.preventDefault(); void run('/api/admin/product', { productId: p.id, ...f }, `Сохранено: ${shortName(p.name)}`); };
  const units = p.prices.units;
  return <form className="admin-editor" onSubmit={save}>
    <div className="admin-editor-grid">
      <label>Розничная, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.retail)} по прайсу` : 'нет в прайсе'} value={f.retailUnits} onChange={e => set('retailUnits')(e.target.value)} /></label>
      <label>По карте, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.partner)} по прайсу` : 'нет в прайсе'} value={f.partnerUnits} onChange={e => set('partnerUnits')(e.target.value)} /></label>
      <label>Розничная, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.retailRub} onChange={e => set('retailRub')(e.target.value)} /></label>
      <label>По карте, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.partnerRub} onChange={e => set('partnerRub')(e.target.value)} /></label>
    </div>
    <div className="admin-choice" role="radiogroup" aria-label="Наличие">{([['', 'Как в каталоге'], ['InStock', 'В наличии'], ['OutOfStock', 'Нет в наличии']] as const).map(([v, label]) => <button type="button" key={v} role="radio" aria-checked={f.availability === v} className={f.availability === v ? 'active' : ''} onClick={() => set('availability')(v)}>{label}</button>)}</div>
    <div className="admin-editor-actions"><button className="btn btn--primary">Сохранить</button>{o && <button type="button" className="btn btn--secondary" onClick={() => void run('/api/admin/product', { productId: p.id, reset: true }, `Как в прайсе: ${shortName(p.name)}`)}>Вернуть как в прайсе</button>}<a href={p.path} className="admin-link">Открыть товар</a></div>
  </form>;
}

function ReviewsSection({ overview, run }: { overview: Overview; run: Run }) {
  const [removing, setRemoving] = useState<Overview['reviews'][number] | null>(null);
  const label = { pending: 'Ждёт проверки', published: 'Опубликован', hidden: 'Скрыт' };
  return <section className="admin-card" data-ds-id="admin-reviews">
    <h2>Отзывы покупателей</h2>
    <p className="admin-lead">Новый отзыв появляется на сайте только после того, как вы его опубликуете. Комментарии экспертов скрываются прямо на странице товара — кнопкой «Скрыть», её видит только администратор.</p>
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
