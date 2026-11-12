import { OrdersSection } from './admin-orders';
import { FaqSection, JournalSection, PhotosSection, PromosSection, VideosSection, type ContentTab } from './admin-content';
import './admin.css';
import './admin-design.css';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { installHomeScrollEdges } from './home-scroll-edges.mjs';
import { ProductPicker } from './personal';
import type { Product } from './content-types';
import { data, money, shortName, useStore } from './store';
import { builtHidden, pricesUnder, readSite, type ProductContent, type ProductOverride, type SiteSettings } from './site';
import { factOrder } from './catalog';
import { productCover } from './product-media.mjs';
import { Icon, SiteBackdrop } from './ui';
import { Field, PasswordInput } from './auth';

// Site management (/admin/, research 2026-11-10): a separate staff account with its own sign-in and session, and only
// management here — no customer cabinet. The server checks the staff session on every request (scripts/site-admin.mjs).
// The desktop menu stays on the left. Compact screens use the same dropdown menu pattern as the customer site.
// An expert comment's stars are set right on the product page (clickable stars a signed-in member of staff sees).

type Overview = SiteSettings & {
  cbr: { rubPerUsd: number; date: string } | null;
  rateHistory: { rubPerUnit: number; from: number | null; at: string; by: string | null }[];
  reviews: { id: number; productId: string; rating: number; text: string; status: 'pending' | 'published' | 'hidden'; date: string; author: string; email: string }[];
  staff: { email: string; name: string; createdAt: string; lastLogin: string | null }[];
  customers: number;
};
type Tab = 'summary' | 'orders' | 'products' | 'rate' | 'reviews' | 'chat' | 'staff' | ContentTab;
// Icons as in the site's phone tab bar (home, catalog grid, chat, profile) and header (bag); groups with a heading.
const tabs: [Tab, string, string, string][] = [['summary', 'Сводка', 'home', 'Сводка'], ['orders', 'Заказы', 'bag', 'Заказы'], ['products', 'Товары', 'grid', 'Товары'], ['rate', 'Курс у.е.', 'sliders', 'Курс'], ['reviews', 'Отзывы', 'star', 'Отзывы'], ['chat', 'Чат-консультант', 'message', 'Чат'], ['staff', 'Сотрудники', 'user-separated', 'Команда'], ['promos', 'Акции', 'tag', 'Акции'], ['photos', 'Фотогалерея', 'image', 'Фото'], ['videos', 'Видеогалерея', 'play', 'Видео'], ['journal', 'Журнал', 'book', 'Журнал'], ['faq', 'Частые вопросы', 'help', 'Вопросы']];
const groups: [string, Tab[]][] = [['', ['summary']], ['Магазин', ['orders', 'products', 'rate']], ['Контент', ['promos', 'photos', 'videos', 'journal', 'faq']], ['Покупатели', ['reviews', 'chat']], ['Команда', ['staff']]];
const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const number = (v: number | null | undefined) => v === null || v === undefined ? '' : String(v).replace('.', ',');
const productName = (id: string) => { const p = data.products.find(x => x.id === id); return p ? shortName(p.name) : id; };

async function adminCall(path: string, body: unknown): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
  try {
    const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, body: await r.json().catch(() => null) };
  } catch { return { ok: false, body: { error: 'Нет связи с сервером. Попробуйте ещё раз.' } }; }
}

/** /admin/: the staff sign-in, or site management for a signed-in member of staff. */
export function AdminApp() {
  const { staff, setStaff } = useStore();
  const [checked, setChecked] = useState(false);
  useEffect(() => installHomeScrollEdges(window, document), []);
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('.admin-header');
    if (!header) return;
    const fit = () => document.documentElement.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
    fit(); const observer = new ResizeObserver(fit); observer.observe(header);
    return () => observer.disconnect();
  }, [checked, !!staff]);
  useEffect(() => {
    fetch('/api/admin/me', { headers: { Accept: 'application/json' } }).then(async r => { const b = r.ok ? await r.json().catch(() => null) : null; setStaff(b?.staff ?? null); }).catch(() => setStaff(null)).finally(() => setChecked(true));
  }, []);
  if (!checked) return <><SiteBackdrop/><div className="admin-app admin-app--loading" aria-busy="true" /></>;
  return <><SiteBackdrop/>{staff ? <AdminPanel /> : <StaffSignIn />}</>;
}

function StaffSignIn() {
  const { setStaff } = useStore();
  // ?email= (from the customer sign-in that recognised a staff account) fills the email in.
  const [login, setLogin] = useState(() => typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      const b = await r.json().catch(() => null);
      if (r.ok && b?.staff) { history.replaceState(history.state, '', '/admin/'); setPassword(''); setStaff(b.staff); return; }
      setError(b?.error || 'Не удалось войти.');
    } catch { setError('Нет связи с сервером.'); } finally { setBusy(false); }
  };
  // The same card as the customers' sign-in (auth.tsx, auth.css): white card with the dark outline, the same fields,
  // the eye on the password, no green ring on the field being typed in (owner, 2026-11-10).
  return <div className="admin-signin" data-ds-id="admin-signin">
    <header className="site-header admin-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="NSP Center — на сайт"><span className="brand-mark"><img src="/icons/icon.svg" alt="" width="48" height="48" /></span><span>NSP<span className="brand-light"> Center</span></span></a>
      <span className="admin-header-label">Управление сайтом</span>
      <div className="admin-header-actions"><a className="admin-header-link" href="/">На сайт</a></div>
    </div></header>
    <main className="site-main site-main--account-route" id="main">
      <section className="auth admin-auth">
        <h1>Вход для сотрудников</h1>
        <p className="auth-switch">Управление сайтом NSP Center. Покупатели входят на сайте, в <a className="auth-link" href="/profile/">профиле</a>.</p>
        <form className="auth-form" onSubmit={submit}>
          <Field label="Email">{id => <input id={id} className="field" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="name@nsp-center.ru" value={login} onChange={e => setLogin(e.target.value.replace(/\s/g, ''))} required />}</Field>
          <Field label="Пароль">{id => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={setPassword} />}</Field>
          <button className="btn btn--primary auth-submit" disabled={busy || !login.trim() || !password}>{busy ? 'Входим…' : 'Войти'}</button>
          {/* As on the customers' sign-in (auth.tsx): a staff password is renewed by an administrator in «Сотрудники». */}
          <button type="button" className="auth-link auth-forgot" onClick={() => setForgot(true)}>Забыли пароль?</button>
        </form>
        {error && <div className="auth-notice auth-notice--error" role="alert"><Icon name="close" size={20} /><p>{error}</p></div>}
        {forgot && <div className="auth-notice" role="status"><Icon name="clock" size={20} /><p><strong>Обратитесь к администратору сайта.</strong> В разделе «Сотрудники» он выдаст вам новый пароль. Восстановление по почте появится позже.</p></div>}
      </section>
    </main>
  </div>;
}

export function AdminPanel() {
  const { setSite, notify, staff, setStaff } = useStore();
  const [tab, setTabState] = useState<Tab>('summary');
  const headerRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (e: PointerEvent) => { if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); menuToggleRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  useEffect(() => {
    const desktop = matchMedia('(min-width:960px)');
    const update = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', update);
    return () => desktop.removeEventListener('change', update);
  }, []);
  // Each entrance to staff management starts with the summary; a previous section is not restored.
  useEffect(() => { history.replaceState(history.state, '', '/admin/'); }, []);
  const setTab = (t: Tab) => { closeMenu(); setTabState(t); history.replaceState(history.state, '', t === 'summary' ? '/admin/' : `/admin/?section=${t}`); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => document.querySelector<HTMLElement>('.admin-title')?.focus({preventScroll: true})); };
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch('/api/admin/overview', { headers: { Accept: 'application/json' } }).then(async r => {
    const body = await r.json().catch(() => null);
    if (r.status === 401) { setStaff(null); return; }
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
  const signOut = async () => { await fetch('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null); setStaff(null); };
  const pending = overview?.reviews.filter(r => r.status === 'pending').length ?? 0;
  const title = tabs.find(([id]) => id === tab)?.[1] ?? '';
  return <div className="admin-app" data-ds-id="admin-panel">
    {/* The site's own header (logo and white bar), with management's actions instead of the shop's. */}
    <header ref={headerRef} className="site-header admin-header" data-ds-id="admin-header"><div className="header-inner">
      <a className="brand" href="/admin/" aria-label="NSP Center — управление сайтом"><span className="brand-mark"><img src="/icons/icon.svg" alt="" width="48" height="48" /></span><span>NSP<span className="brand-light"> Center</span></span></a>
      <span className="admin-header-label">Управление сайтом</span>
      <div className="admin-header-actions">
        <span className="admin-staff-name" title={staff?.email}><Icon name="user-separated" size={20} />{staff ? `${staff.firstName} ${staff.lastName}`.trim() : ''}</span>
        <a className="admin-header-link" href="/" target="_blank" rel="noopener">Открыть сайт</a>
        <button type="button" className="admin-header-link" onClick={() => void signOut()}>Выйти</button>
        <button ref={menuToggleRef} type="button" className="icon-btn admin-mobile-toggle" aria-label={menuOpen?'Закрыть меню разделов':'Разделы управления'} aria-expanded={menuOpen} aria-controls="admin-mobile-menu" onClick={() => setMenuOpen(v => !v)}><Icon name={menuOpen?'close':'menu'}/></button>
      </div>
    </div>
      {menuOpen&&<nav id="admin-mobile-menu" className="mobile-menu panel admin-mobile-menu" aria-label="Разделы управления">
        {tabs.map(([id,label])=><a key={id} href={id==='summary'?'/admin/':`/admin/?section=${id}`} aria-current={tab===id?'page':undefined} onClick={e=>{e.preventDefault();setTab(id);}}><span>{label}{id==='reviews'&&pending>0&&<span className="admin-count">{pending}</span>}</span><Icon name="chevron" size={17}/></a>)}
        <div className="admin-menu-footer"><a href="/" target="_blank" rel="noopener">Открыть сайт <Icon name="chevron" size={17}/></a><button type="button" onClick={()=>{closeMenu();void signOut();}}>Выйти <Icon name="chevron" size={17}/></button></div>
      </nav>}
    </header>
    <div className="admin-shell">
      <div className="admin-desktop-navigation"><AdminNavigation tab={tab} pending={pending} choose={setTab}/></div>

      <main className="admin" id="main">
        <h1 className="admin-title" tabIndex={-1}>{title}</h1>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {!overview && !error && tab !== 'orders' && tab !== 'chat' && <p className="ds-muted">Загружаем…</p>}
        {overview && tab === 'summary' && <SummarySection overview={overview} pending={pending} open={setTab} />}
        {tab === 'orders' && <OrdersSection />}
        {overview && tab === 'rate' && <RateSection overview={overview} run={run} />}
        {overview && tab === 'products' && <ProductsSection overview={overview} run={run} />}
        {overview && tab === 'reviews' && <ReviewsSection overview={overview} run={run} />}
        {tab === 'chat' && <ChatLogSection />}
        {overview && tab === 'promos' && <PromosSection site={overview} run={run} />}
        {overview && tab === 'photos' && <PhotosSection site={overview} run={run} />}
        {overview && tab === 'videos' && <VideosSection site={overview} run={run} />}
        {overview && tab === 'journal' && <JournalSection site={overview} run={run} />}
        {overview && tab === 'faq' && <FaqSection site={overview} run={run} />}
        {overview && tab === 'staff' && <StaffSection overview={overview} run={run} reload={() => void load()} />}
      </main>
    </div>
  </div>;
}


function AdminNavigation({tab, pending, choose}: {tab: Tab; pending: number; choose: (tab: Tab) => void}) {
  return <nav className="admin-sidebar" aria-label="Разделы управления">{groups.map(([heading, ids]) => <div className="admin-sidebar-group" key={heading || 'top'}>
        {heading && <span className="admin-sidebar-heading">{heading}</span>}
        {tabs.filter(([id]) => ids.includes(id)).map(([id, label, icon, short]) => <button key={id} type="button" aria-label={label} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => choose(id)}><Icon name={icon} size={22} /><span className="admin-nav-label">{label}</span><span className="admin-nav-short" aria-hidden="true">{short}</span>{id === 'reviews' && pending > 0 && <span className="admin-count">{pending}</span>}</button>)}
      </div>)}</nav>;
}

/** «Сводка»: what needs attention today, each card opens its section. */
function SummarySection({ overview, pending, open }: { overview: Overview; pending: number; open: (t: Tab) => void }) {
  const [orders, setOrders] = useState<Record<string, number> | null>(null);
  useEffect(() => { fetch('/api/admin/orders?status=all&page=1', { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(b => setOrders(b?.summary ?? null)).catch(() => setOrders(null)); }, []);
  const out = data.products.filter(p => p.availability === 'OutOfStock').length;
  const rate = overview.rate?.rubPerUnit ?? data.pricing.rubPerUnit;
  const cards: [Tab, string, string, string][] = [
    ['orders', 'Новые заказы', orders ? String(orders.new ?? 0) : '—', orders ? `В обработке: ${orders.processing ?? 0}` : 'Заказы с сайта пока не приходят'],
    ['reviews', 'Отзывы на проверке', String(pending), pending ? 'Ждут публикации' : 'Все отзывы проверены'],
    ['products', 'Нет в наличии', String(out), `из ${data.products.length} товаров`],
    ['rate', 'Курс у.е.', `${number(rate)} ₽`, overview.rate?.updatedAt ? `обновлён ${when(overview.rate.updatedAt)}` : 'по прайсу'],
    ['staff', 'Покупателей', String(overview.customers), `Сотрудников: ${overview.staff.length}`],
  ];
  const waiting = overview.reviews.filter(r => r.status === 'pending').slice(0, 3);
  return <>
    <div className="admin-summary" data-ds-id="admin-summary">{cards.map(([id, label, value, note]) => <button key={label} type="button" className="admin-summary-card" onClick={() => open(id)}><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</div>
    <section className="admin-card admin-attention" data-ds-id="admin-attention">
      <h2>Требует внимания</h2>
      {waiting.length ? <ul className="admin-attention-list">{waiting.map(r => <li key={r.id}><span><strong>{productName(r.productId)}</strong><small>{r.author} · {'★'.repeat(r.rating)} · {when(r.date)}</small></span><button type="button" className="text-button" onClick={() => open('reviews')}>Проверить</button></li>)}</ul>
        : <p className="ds-muted">Новых отзывов нет. Заказы с сайта появятся в «Заказах», когда подключим оформление заказа.</p>}
    </section>
  </>;
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
  // Changed: own prices or stock, or brought back to the site by hand (it stays open here after «Вернуть на сайт»).
  const changed = data.products.filter(p => (overview.products[p.id] || overview.visibility?.[p.id] === false) && !p.hidden && p.id !== picked);
  const hidden = data.products.filter(p => p.hidden && p.id !== picked);
  const product = data.products.find(p => p.id === picked);
  const row = (p: Product) => <li key={p.id}>
    <button type="button" className="admin-product-row" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
      <span><strong>{shortName(p.name)}</strong><small>Арт. {p.article ?? '—'}{p.hidden ? ' · скрыт с сайта' : overview.products[p.id] ? ' · изменён' : overview.visibility?.[p.id] === false ? ' · возвращён на сайт' : ''}</small></span>
      <span className="admin-product-prices">{money(p.prices.retail)}{p.prices.partner !== null && <small>по карте {money(p.prices.partner)}</small>}<small className={p.availability === 'OutOfStock' ? 'out' : 'in'}>{p.availability === 'OutOfStock' ? 'Нет в наличии' : 'В наличии'}</small></span>
    </button>
    {open === p.id && <ProductTabs key={p.id} product={p} override={overview.products[p.id]} run={run} />}
  </li>;
  return <section className="admin-card" data-ds-id="admin-products">
    <h2>Цены и наличие</h2>
    <p className="admin-lead">Выберите товар: впишите название или артикул, или откройте список стрелкой и пролистайте. Пустое поле цены — цена из прайса по текущему курсу. «Нет в наличии» включает кнопку «Сообщить о поступлении»; когда товар снова в наличии, ждущие покупатели получат уведомление.</p>
    <NewProduct run={run} onCreated={setPicked} />
    <div className="admin-picker"><ProductPicker exclude={[]} value={picked} onChange={setPicked} placeholder="Название или артикул" label="Товар" withHidden /></div>
    {product && <ul className="admin-products">{row(product)}</ul>}
    <h3>{changed.length ? 'Изменённые товары' : product ? '' : 'Изменённых товаров пока нет'}</h3>
    <ul className="admin-products">{changed.map(row)}</ul>
    {hidden.length > 0 && <><h3>Скрыты с сайта</h3><p className="admin-hint-muted">Покупатели не видят их в каталоге, поиске и чате; по старой ссылке страница товара говорит, что его нет в продаже. Откройте товар, чтобы вернуть его на сайт.</p><ul className="admin-products">{hidden.map(row)}</ul></>}
  </section>;
}

type EditTab = 'price' | 'about' | 'facts' | 'docs' | 'photo';
const editTabs: [EditTab, string][] = [['price', 'Цены и наличие'], ['about', 'Название и описание'], ['facts', 'Состав и применение'], ['docs', 'Сертификаты'], ['photo', 'Фото']];
/** A product's editor: prices and stock, and the card's content (everything a visitor sees on the product page). */
function ProductTabs({ product: p, override, run }: { product: Product; override?: ProductOverride; run: Run }) {
  const [tab, setTab] = useState<EditTab>('price');
  return <div className="admin-editor">
    <Visibility product={p} run={run} />
    <nav className="admin-subtabs" role="tablist">{editTabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'price' ? <ProductEditor product={p} override={override} run={run} /> : <ContentEditor product={p} tab={tab} run={run} />}
  </div>;
}

/** «Новая карточка»: the essentials only — name, article, section, prices and stock. The card is created hidden and
 *  opens in the usual editor below, where its description, composition, certificates and photo are filled in; then
 *  «Показать на сайте» opens it to customers (scripts/site-admin.mjs /api/admin/new-product, src/custom-product.mjs). */
function NewProduct({ run, onCreated }: { run: Run; onCreated: (id: string) => void }) {
  const empty = { name: '', article: '', categoryPath: '', retailRub: '', partnerRub: '', availability: 'InStock' };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const sections = data.categories.filter(c => c.path !== '/catalog/').map(c => ({ path: c.path, label: c.parent && c.parent !== '/catalog/' ? `${data.categories.find(x => x.path === c.parent)?.name ?? ''} › ${c.name}` : c.name })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const before = new Set(data.products.map(p => p.id));
    if (!await run('/api/admin/new-product', { product: f }, `Карточка создана: ${f.name.trim()}. Заполните описание и фото, затем покажите её на сайте`)) return;
    const created = data.products.find(p => !before.has(p.id));
    setF(empty); setOpen(false);
    if (created) onCreated(created.id);
  };
  if (!open) return <button type="button" className="btn btn--primary admin-new-product-open" onClick={() => setOpen(true)}><Icon name="plus" size={18} />Новая карточка товара</button>;
  return <form className="admin-editor admin-new-product" onSubmit={save} data-ds-id="admin-new-product">
    <h3>Новая карточка товара</h3>
    <div className="admin-editor-grid">
      <label>Название<input className="field" value={f.name} onChange={e => set('name')(e.target.value)} placeholder="Например: Крем для рук (Hand Cream)" required /></label>
      <label>Артикул<input className="field" value={f.article} onChange={e => set('article')(e.target.value)} placeholder="Необязательно" /></label>
      <label>Раздел каталога<select className="field" value={f.categoryPath} onChange={e => set('categoryPath')(e.target.value)} required><option value="">Выберите раздел</option>{sections.map(c => <option key={c.path} value={c.path}>{c.label}</option>)}</select></label>
      <label>Розничная цена, ₽<input className="field" inputMode="numeric" value={f.retailRub} onChange={e => set('retailRub')(e.target.value)} required /></label>
      <label>Цена по карте, ₽<input className="field" inputMode="numeric" value={f.partnerRub} onChange={e => set('partnerRub')(e.target.value)} placeholder="Необязательно" /></label>
    </div>
    <div className="admin-choice" role="radiogroup" aria-label="Наличие">{([['InStock', 'В наличии'], ['OutOfStock', 'Нет в наличии']] as const).map(([v, label]) => <button type="button" key={v} role="radio" aria-checked={f.availability === v} className={f.availability === v ? 'active' : ''} onClick={() => set('availability')(v)}>{label}</button>)}</div>
    <p className="admin-hint-muted">Карточка появится скрытой: покупатели её не увидят, пока вы не добавите описание и фото и не нажмёте «Показать на сайте». Цены в рублях не меняются при смене курса у.е.</p>
    <div className="admin-editor-actions"><button className="btn btn--primary">Создать карточку</button><button type="button" className="btn btn--secondary" onClick={() => { setF(empty); setOpen(false); }}>Отмена</button></div>
  </form>;
}

/** Shown to customers or hidden: a hidden product leaves the catalog, search, home, theme pages and the chat (src/site.ts);
 *  its page stays at its address and says it is not on sale. The switch works at once, nothing else to save. */
function Visibility({ product: p, run }: { product: Product; run: Run }) {
  const hidden = Boolean(p.hidden);
  return <div className={`admin-visibility${hidden ? ' is-hidden' : ''}`}>
    <p>{hidden ? <><strong>Скрыт с сайта.</strong> Покупатели не видят товар в каталоге, поиске и чате.{builtHidden(p) ? ' Эта линейка больше не поставляется.' : p.custom ? ' Новая карточка: заполните описание и фото во вкладках ниже, затем покажите её.' : ''}</> : <><strong>Виден покупателям.</strong> Скройте, если товар больше не продаётся, — вернуть можно в любой момент.</>}</p>
    <button type="button" className={`btn ${hidden ? 'btn--primary' : 'btn--secondary'}`} onClick={() => void run('/api/admin/visibility', { productId: p.id, hidden: !hidden }, hidden ? `${p.custom ? 'Показали' : 'Вернули'} на сайте: ${shortName(p.name)}` : `Скрыли с сайта: ${shortName(p.name)}`)}>{hidden ? p.custom ? 'Показать на сайте' : 'Вернуть на сайт' : 'Скрыть с сайта'}</button>
    {p.custom && <DeleteCard product={p} run={run} />}
  </div>;
}

/** Only a card created here can be deleted (built cards are hidden instead); asks once more before deleting. */
function DeleteCard({ product: p, run }: { product: Product; run: Run }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" className="btn btn--secondary" onClick={() => setSure(true)}>Удалить карточку</button>;
  return <span className="admin-confirm admin-delete-confirm"><span>Удалить «{shortName(p.name)}» со всем описанием и фото?</span><button type="button" className="btn btn--primary" onClick={() => void run('/api/admin/delete-product', { productId: p.id }, `Карточка удалена: ${shortName(p.name)}`)}>Да, удалить</button><button type="button" className="btn btn--secondary" onClick={() => setSure(false)}>Нет</button></span>;
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

/** A confirmation in its own window over the page: Escape or a click outside cancels. Also used by the profile's sign-out. */
export function ConfirmDialog({ title, confirm, children, onConfirm, onCancel, danger = true }: { title: string; confirm: string; children?: ReactNode; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); }; addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [onCancel]);
  return <div className="admin-dialog-backdrop" onClick={onCancel}>
    <div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" onClick={e => e.stopPropagation()}>
      <h2 id="admin-dialog-title">{title}</h2>
      {children}
      <div className="admin-editor-actions"><button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} autoFocus onClick={onConfirm}>{confirm}</button><button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button></div>
    </div>
  </div>;
}

/** «Сотрудники»: staff accounts are separate from customers — added here with their own email and a one-time password
 *  shown once (pass it on and ask to keep it), removed when they no longer work with the site. */
function StaffSection({ overview, run, reload }: { overview: Overview; run: Run; reload: () => void }) {
  const { staff: me, notify } = useStore();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [removing, setRemoving] = useState('');
  const [resetting, setResetting] = useState('');
  const [renewed, setRenewed] = useState(false);
  const reset = async (target: string) => {
    const r = await adminCall('/api/admin/staff', { email: target, reset: true });
    if (!r.ok) { notify(String(r.body?.error || 'Не удалось выдать пароль.')); return; }
    setRenewed(true); setIssued({ email: String(r.body?.email), password: String(r.body?.password) });
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const [firstName = '', ...rest] = name.trim().split(/\s+/);
    const r = await adminCall('/api/admin/staff', { email, firstName, lastName: rest.join(' ') });
    if (!r.ok) { notify(String(r.body?.error || 'Не удалось добавить.')); return; }
    setRenewed(false); setIssued({ email: String(r.body?.email), password: String(r.body?.password) }); setEmail(''); setName(''); reload();
  };
  return <section className="admin-card" data-ds-id="admin-staff">
    <p className="admin-lead">Сотрудник входит на странице управления сайтом (nsp-center.ru/admin/) по своей почте. Это отдельный аккаунт: покупки на сайте он делает обычным аккаунтом покупателя. Покупателей на сайте: {overview.customers}.</p>
    <ul className="admin-users">{overview.staff.map(u => <li key={u.email}><span><strong>{u.name || u.email}</strong><small>{u.email}{u.lastLogin ? ` · входил ${when(u.lastLogin)}` : ' · ещё не входил'}</small></span><span className="admin-user-actions"><button type="button" className="btn btn--secondary" onClick={() => setResetting(u.email)}>Новый пароль</button>{u.email.toLowerCase() !== me?.email.toLowerCase() && <button type="button" className="btn btn--secondary" onClick={() => setRemoving(u.email)}>Удалить</button>}</span></li>)}</ul>
    <h3>Добавить сотрудника</h3>
    <form className="admin-staff-form" onSubmit={add}>
      <label>Имя и фамилия<input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Петров" maxLength={120} /></label>
      <label>Почта сотрудника<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@nsp-center.ru" required /></label>
      <button className="btn btn--primary" disabled={!email.trim()}>Добавить</button>
    </form>
    {issued && <div className="admin-confirm" role="status"><p>{renewed ? <>Новый пароль для {issued.email}: </> : <>Сотрудник {issued.email} добавлен. Пароль для первого входа: </>}<code>{issued.password}</code></p><span>Пароль показан один раз. Передайте его лично или по телефону, не в переписке.</span><button type="button" className="btn btn--secondary" onClick={() => setIssued(null)}>Готово</button></div>}
    {resetting && <ConfirmDialog title="Выдать новый пароль?" confirm="Выдать" onCancel={() => setResetting('')} onConfirm={() => { const e = resetting; setResetting(''); void reset(e); }}>
      <p className="ds-muted">Старый пароль {resetting} перестанет работать, сайт покажет новый один раз.</p>
    </ConfirmDialog>}
    {removing && <ConfirmDialog title="Удалить сотрудника?" confirm="Удалить" onCancel={() => setRemoving('')} onConfirm={() => { const e = removing; setRemoving(''); void run('/api/admin/staff', { email: e, remove: true }, `${e} больше не сотрудник`); }}>
      <p className="ds-muted">{removing} больше не сможет входить в управление сайтом.</p>
    </ConfirmDialog>}
  </section>;
}

/** «Чат»: what visitors asked the consultation agent in the last 30 days and what it answered (scripts/ai-agent.mjs).
 *  Questions are kept without the account, so a visitor is not named. */
/** «Чат-консультант»: what visitors ask in the site chat and what it answered (scripts/site-admin.mjs /api/admin/chat-log),
 *  newest first; «Без ответа» lists the questions the chat could not answer, so the shop sees what to add. */
type ChatEntry = { at: string; question: string; answer: string; products: string; answered: boolean };
function ChatLogSection() {
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all');
  const [log, setLog] = useState<{ counts: { today: number; week: number; month: number; unanswered: number }; entries: ChatEntry[] } | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let off = false; setError(false);
    fetch(`/api/admin/chat-log${filter === 'unanswered' ? '?filter=unanswered' : ''}`, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then(b => { if (!off) setLog(b); }).catch(() => { if (!off) setError(true); });
    return () => { off = true; };
  }, [filter]);
  const tiles: [string, number | undefined][] = [['Сегодня', log?.counts.today], ['За 7 дней', log?.counts.week], ['За 30 дней', log?.counts.month], ['Без ответа за 30 дней', log?.counts.unanswered]];
  return <section className="admin-card" data-ds-id="admin-chat">
    <p className="admin-lead">Вопросы, которые посетители задают в чате на сайте, и ответы чата. Имя, почта и телефон посетителя не сохраняются; записи хранятся 90 дней.</p>
    <div className="admin-chat-stats">{tiles.map(([label, n]) => <div key={label}><strong>{n ?? '—'}</strong><span>{label}</span></div>)}</div>
    <div className="admin-choice" role="radiogroup" aria-label="Какие вопросы показать">{([['all', 'Все вопросы'], ['unanswered', 'Без ответа']] as const).map(([v, label]) => <button type="button" key={v} role="radio" aria-checked={filter === v} className={filter === v ? 'active' : ''} onClick={() => { setFilter(v); setOpen(null); }}>{label}</button>)}</div>
    {error && <p className="admin-error" role="alert">Не удалось загрузить вопросы. Обновите страницу.</p>}
    {!log && !error && <p className="ds-muted">Загружаем…</p>}
    {log && !log.entries.length && <p className="ds-muted">{filter === 'unanswered' ? 'Вопросов без ответа нет.' : 'Вопросов пока не было.'}</p>}
    <ul className="admin-chat-log">{log?.entries.map((e, i) => <li key={`${e.at}-${i}`} className={e.answered ? '' : 'is-unanswered'}>
      <p className="admin-review-meta">{when(e.at)}{e.answered ? '' : ' · чат не смог ответить'}</p>
      <p className="admin-chat-question">{e.question}</p>
      <button type="button" className="admin-chat-answer" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{e.answer}</span></button>
      {e.products && <p className="admin-review-meta">Товары в ответе: {e.products.split(',').map(productName).join(', ')}</p>}
    </li>)}</ul>
  </section>;
}
