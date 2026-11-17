import {ConfirmDialog} from '../../src/confirm-dialog';
import {siteUrl} from './links';
import {ADMIN_PATH} from '../../src/admin-path.mjs';
import {ProductPreviewButton} from './admin-preview';
import {CardApplicationsSection} from './admin-card-applications';
import {CategoriesSection} from './admin-categories';
import {RequiredLabel,RequiredHint,useUnsavedProduct,AdminBackButton} from './admin-form';
import {ProductMediaEditor, ProductAssetFields, type ProductAssets} from './admin-product-media';
import {customProduct} from '../../src/custom-product.mjs';
import type {ProductKnowledge} from '../../src/product-knowledge-types';
import {KnowledgeEditor} from './admin-knowledge';
import { DISCOUNT_PERCENTS, readProductBadges, type ProductBadges } from '../../src/product-badges.mjs';
import { OrdersSection } from './admin-orders';
import { FaqSection, JournalSection, PhotosSection, PromosSection, VideosSection, type ContentTab } from './admin-content';
import './admin.css';
import './admin-design.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { installHomeScrollEdges } from '../../src/home-scroll-edges.mjs';
import type { Product } from '../../src/content-types';
import { data, money, shortName, useStore } from '../../src/store';
import { builtHidden, pricesUnder, readSite, type ProductOverride, type ProductContent, type SiteSettings } from '../../src/site';
import { Icon, SiteBackdrop } from '../../src/ui';
import { Field, PasswordInput } from '../../src/auth';

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
  cardApplications: number;
};
type Tab = 'card-applications' | 'summary' | 'orders' | 'products' | 'categories' | 'rate' | 'reviews' | 'chat' | 'staff' | ContentTab;
// Icons as in the site's phone tab bar (home, catalog grid, chat, profile) and header (bag); groups with a heading.
const tabs: [Tab, string, string, string][] = [['summary', 'Сводка', 'home', 'Сводка'], ['orders', 'Заказы', 'bag', 'Заказы'], ['card-applications', 'Дисконтные карты', 'user-separated', 'Карты'], ['products', 'Товары', 'grid', 'Товары'], ['categories', 'Категории', 'grid', 'Категории'], ['rate', 'Курс у.е.', 'sliders', 'Курс'], ['reviews', 'Отзывы', 'star', 'Отзывы'], ['chat', 'Чат-консультант', 'message', 'Чат'], ['staff', 'Сотрудники', 'user-separated', 'Команда'], ['promos', 'Акции', 'tag', 'Акции'], ['photos', 'Фотогалерея', 'image', 'Фото'], ['videos', 'Видеогалерея', 'play', 'Видео'], ['journal', 'Журнал', 'book', 'Журнал'], ['faq', 'Частые вопросы', 'help', 'Вопросы']];
const groups: [string, Tab[]][] = [['', ['summary']], ['Магазин', ['orders', 'products', 'categories', 'rate']], ['Контент', ['promos', 'photos', 'videos', 'journal', 'faq']], ['Покупатели', ['card-applications', 'reviews', 'chat']], ['Команда', ['staff']]];
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
      if (r.ok && b?.staff) { history.replaceState(history.state, '', ADMIN_PATH); setPassword(''); setStaff(b.staff); return; }
      setError(b?.error || 'Не удалось войти.');
    } catch { setError('Нет связи с сервером.'); } finally { setBusy(false); }
  };
  // The same card as the customers' sign-in (auth.tsx, auth.css): white card with the dark outline, the same fields,
  // the eye on the password, no green ring on the field being typed in (owner, 2026-11-10).
  return <div className="admin-signin" data-ds-id="admin-signin">
    <header className="site-header admin-header"><div className="header-inner">
      <a className="brand" href={siteUrl()} aria-label="NSP Center — на сайт"><span className="brand-mark"><img src="/icons/icon.svg" alt="" width="48" height="48" /></span><span>NSP<span className="brand-light"> Center</span></span></a>
      <span className="admin-header-label">Управление сайтом</span>
      <div className="admin-header-actions"><a className="admin-header-link" href={siteUrl()}>На сайт</a></div>
    </div></header>
    <main className="site-main site-main--account-route" id="main">
      <section className="auth admin-auth">
        <h1>Вход для сотрудников</h1>
        <p className="auth-switch">Управление сайтом NSP Center.</p>
        <form className="auth-form" onSubmit={submit}>
          <Field label="Email">{id => <input id={id} className="field" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Введите email" value={login} onChange={e => setLogin(e.target.value.replace(/\s/g, ''))} required />}</Field>
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
  const [tab, setTabState] = useState<Tab>(()=>{const requested=new URLSearchParams(location.search).get('section');return tabs.some(([id])=>id===requested)?requested as Tab:'summary'});
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
  // Sign-in starts at summary; reloading an authenticated URL preserves the current section.
  const setTab = (t: Tab) => { closeMenu(); setTabState(t); history.replaceState(history.state, '', t === 'summary' ? ADMIN_PATH : `${ADMIN_PATH}?section=${t}`); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => document.querySelector<HTMLElement>('.admin-title')?.focus({preventScroll: true})); };
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
  const run = async (path: string, body: unknown, done: string, onError?:(message:string)=>void) => {
    const r = await adminCall(path, body);
    if (!r.ok) { const message=String(r.body?.error || 'Не удалось сохранить.');notify(message);onError?.(message);return false; }
    if (r.body && 'products' in r.body) setSite(readSite(r.body));
    notify(done); await load(); return true;
  };
  const signOut = async () => { await fetch('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null); setStaff(null); };
  const pending = overview?.reviews.filter(r => r.status === 'pending').length ?? 0;
  const title = tabs.find(([id]) => id === tab)?.[1] ?? '';
  return <div className="admin-app" data-ds-id="admin-panel">
    {/* The site's own header (logo and white bar), with management's actions instead of the shop's. */}
    <header ref={headerRef} className="site-header admin-header" data-ds-id="admin-header"><div className="header-inner">
      <a className="brand" href={ADMIN_PATH} aria-label="NSP Center — управление сайтом"><span className="brand-mark"><img src="/icons/icon.svg" alt="" width="48" height="48" /></span><span>NSP<span className="brand-light"> Center</span></span></a>
      <span className="admin-header-label">Управление сайтом</span>
      <div className="admin-header-actions">
        <span className="admin-staff-name" title={staff?.email}><Icon name="user-separated" size={20} />{staff ? `${staff.firstName} ${staff.lastName}`.trim() : ''}</span>
        <a className="admin-header-link" href={siteUrl()} target="_blank" rel="noopener">Открыть сайт</a>
        <button type="button" className="admin-header-link" onClick={() => void signOut()}>Выйти</button>
        <button ref={menuToggleRef} type="button" className="icon-btn admin-mobile-toggle" aria-label={menuOpen?'Закрыть меню разделов':'Разделы управления'} aria-expanded={menuOpen} aria-controls="admin-mobile-menu" onClick={() => setMenuOpen(v => !v)}><Icon name={menuOpen?'close':'menu'}/></button>
      </div>
    </div>
      {menuOpen&&<nav id="admin-mobile-menu" className="mobile-menu panel admin-mobile-menu" aria-label="Разделы управления">
        {tabs.map(([id,label])=><a key={id} href={id==='summary'?ADMIN_PATH:`${ADMIN_PATH}?section=${id}`} aria-current={tab===id?'page':undefined} onClick={e=>{e.preventDefault();setTab(id);}}><span>{label}{id==='reviews'&&pending>0&&<span className="admin-count">{pending}</span>}</span><Icon name="chevron" size={17}/></a>)}
        <div className="admin-menu-footer"><a href={siteUrl()} target="_blank" rel="noopener">Открыть сайт <Icon name="chevron" size={17}/></a><button type="button" onClick={()=>{closeMenu();void signOut();}}>Выйти <Icon name="chevron" size={17}/></button></div>
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
        {tab === 'card-applications' && <CardApplicationsSection onChange={()=>void load()}/>}
        {overview && tab === 'rate' && <RateSection overview={overview} run={run} />}
        {overview && tab === 'products' && <ProductsSection overview={overview} run={run} />}
        {overview && tab === 'categories' && <CategoriesSection site={overview} run={run} />}
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
  const hiddenCount = data.products.filter(p => p.hidden).length;
  const visibleCount = data.products.length - hiddenCount;
  const inStock = data.products.filter(p => !p.hidden && p.availability !== 'OutOfStock').length;
  const out = visibleCount - inStock;
  const rate = overview.rate?.rubPerUnit ?? data.pricing.rubPerUnit;
  const cards: [Tab, string, string, string][] = [
    ['orders', 'Новые заказы', orders ? String(orders.new ?? 0) : '—', orders ? `В обработке: ${orders.processing ?? 0}` : 'Заказы с сайта пока не приходят'],
    ['card-applications', 'Заявки на карты', String(overview.cardApplications??0), 'Оформление карт в NSP'],
    ['reviews', 'Отзывы на проверке', String(pending), pending ? 'Ждут публикации' : 'Все отзывы проверены'],
    ['products', 'В наличии', String(inStock), 'Видны на сайте и доступны к покупке'],
    ['products', 'Нет в наличии', String(out), 'Видны на сайте, ожидают поступления'],
    ['products', 'Скрыто с сайта', String(hiddenCount), `Всего карточек: ${data.products.length}`],
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
      <label>Новый курс, ₽ за 1 у.е.<input className="field" required inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setConfirm(false); }} /></label>
      <button className="btn btn--primary" disabled={!valid || next === current}>Сохранить</button>
    </form>
    {valid && next !== current && sample && <p className="admin-hint">Например, {shortName(sample.name)}: {money(sampleAt(current))} → {money(sampleAt(next))}</p>}
    {confirm && <div className="admin-confirm" role="alert"><p>Курс меняется с {number(current)} на {number(next)} — больше чем на 20%. Вы уверены?</p><button type="button" className="btn btn--primary" onClick={() => void save()}>Да, сохранить</button><button type="button" className="btn btn--secondary" onClick={() => setConfirm(false)}>Отмена</button></div>}
    <h3>История</h3>
    {overview.rateHistory.length ? <table className="admin-table"><thead><tr><th>Когда</th><th>Курс</th><th>Был</th><th>Кто</th></tr></thead><tbody>{overview.rateHistory.map((h, i) => <tr key={i}><td>{when(h.at)}</td><td>{number(h.rubPerUnit)} ₽</td><td>{h.from ? `${number(h.from)} ₽` : '—'}</td><td>{h.by ?? '—'}</td></tr>)}</tbody></table> : <p className="ds-muted">Курс ещё не меняли: действует курс из прайса.</p>}
  </section>;
}

/** Sections as on the site: the catalog's top sections, each followed by its own subsections. */
function catalogSections() {
  const visit=(parent:string,depth=0):{path:string;label:string}[]=>data.categories.filter(c=>c.parent===parent).flatMap(c=>[{path:c.path,label:`${'— '.repeat(depth)}${c.name.trim()}`},...visit(c.path,depth+1)]);
  return visit('/catalog/');
}
const PAGE_SIZE = 40;

function ProductsSection({ overview, run }: { overview: Overview; run: Run }) {
  const [picked, setPicked] = useState('');
  const [editingProductId,setEditingProductId]=useState<string|null>(()=>new URLSearchParams(location.search).get('product'));
  const [creating,setCreating]=useState(()=>new URLSearchParams(location.search).get('new')==='1');
  useEffect(() => { if (picked) setEditingProductId(picked); }, [picked]);
  // Filters (owner, 2026-11-13): a section as on the site, then a name or article within it; hidden cards are included.
  const [section, setSection] = useState(()=>new URLSearchParams(location.search).get('category')||'');
  const [query, setQuery] = useState(()=>new URLSearchParams(location.search).get('q')||'');
  useEffect(()=>{const params=new URLSearchParams(location.search);params.set('section','products');for(const [key,value] of Object.entries({product:creating?'':editingProductId||'',new:creating?'1':'',category:section,q:query})){if(value)params.set(key,value);else params.delete(key)}if(!creating&&!editingProductId)params.delete('editorTab');history.replaceState(history.state,'',ADMIN_PATH+'?'+params.toString())},[creating,editingProductId,section,query]);
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => { setShown(PAGE_SIZE); }, [section, query]);
  const sections = useMemo(catalogSections, []);
  const filtering = Boolean(section || query.trim());
  const found = useMemo(() => {
    const inSection = section ? new Set(data.categories.find(c => c.path === section)?.products ?? []) : null;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.products.filter(p => (!inSection || inSection.has(p.path)) && words.every(w => `${p.name} ${p.article ?? ''}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [filtering, section, query]);
  // Changed: own prices or stock, or brought back to the site by hand (it stays open here after «Вернуть на сайт»).
  const visible = data.products.filter(p => !p.hidden);
  const hidden = data.products.filter(p => p.hidden);
  const row = (p: Product) => <li key={p.id}>
    <button type="button" className="admin-product-row" onClick={()=>{setEditingProductId(p.id);window.scrollTo({top:0,behavior:'instant'})}}>
      <span><strong>{shortName(p.name)}</strong><small>Арт. {p.article ?? '—'}{p.hidden ? ' · скрыт с сайта' : (overview.products[p.id] || overview.knowledge?.[p.id]) ? ' · изменён' : overview.visibility?.[p.id] === false ? ' · возвращён на сайт' : ''}</small></span>
      <span className="admin-product-prices">{money(p.prices.retail)}{p.prices.partner !== null && <small>по карте {money(p.prices.partner)}</small>}<small className={p.availability === 'OutOfStock' ? 'out' : 'in'}>{p.availability === 'OutOfStock' ? 'Нет в наличии' : 'В наличии'}</small></span>
    </button>

  </li>;
  if(creating)return <section className="admin-product-workspace" data-ds-id="admin-new-product-workspace"><AdminBackButton onClick={()=>setCreating(false)}>К товарам</AdminBackButton><header><div><h1>Новая карточка товара</h1><p>Заполните сведения, найдите материалы в лекциях и прикрепите источники.</p></div><span>Черновик</span></header><NewProduct run={run} onCreated={id=>{rememberEditorTab('price');setPicked(id);setEditingProductId(id);setCreating(false)}} onCancel={()=>setCreating(false)}/></section>;
  const knowledgeProduct=editingProductId?data.products.find(p=>p.id===editingProductId):null;
  if(knowledgeProduct)return <section className="admin-product-workspace" data-ds-id="admin-product-workspace"><AdminBackButton onClick={()=>{setEditingProductId(null);window.scrollTo({top:0,behavior:'instant'})}}>К товарам</AdminBackButton><header><div><h1>Редактор товара</h1><p className="admin-editing-product-name"><strong>{shortName(knowledgeProduct.name)}</strong></p></div><span>{knowledgeProduct.hidden?'Скрыт с сайта':'На сайте'}</span></header><ProductTabs key={knowledgeProduct.id} product={knowledgeProduct} override={overview.products[knowledgeProduct.id]} run={run} initialTab="price"/></section>;
  return <section className="admin-card" data-ds-id="admin-products">
    <h2>Цены и наличие</h2>
    <p className="admin-lead">Все товары доступны ниже: сначала скрытые, затем видимые на сайте. Раздел и поиск помогут найти нужную карточку. Пустое поле цены — цена из прайса по текущему курсу. «Нет в наличии» включает кнопку «Сообщить о поступлении»; когда товар снова в наличии, ждущие покупатели получат уведомление.</p>
    <button type="button" className="btn btn--primary admin-new-product-open" onClick={()=>{setCreating(true);window.scrollTo({top:0,behavior:'instant'})}}><Icon name="plus" size={18}/>Новая карточка товара</button>
    <div className="admin-product-filters" data-ds-id="admin-product-filters">
      <label>Раздел<select className="field" value={section} onChange={e => setSection(e.target.value)}><option value="">Все разделы</option>{sections.map(c => <option key={c.path} value={c.path}>{c.label}</option>)}</select></label>
      <label>Поиск<input className="field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Название или артикул" enterKeyHint="search" /></label>
      {filtering && <button type="button" className="btn btn--secondary" onClick={() => { setSection(''); setQuery(''); }}>Сбросить</button>}
    </div>
    {filtering ? <>
      <h3>{found.length ? `Найдено: ${found.length}` : 'Ничего не найдено'}</h3>
      {!found.length && <p className="admin-hint-muted">Проверьте название или артикул, или выберите «Все разделы».</p>}
      <ul className="admin-products">{found.slice(0, shown).map(row)}</ul>
      {found.length > shown && <button type="button" className="btn btn--secondary admin-more" onClick={() => setShown(n => n + PAGE_SIZE)}>Показать ещё {Math.min(PAGE_SIZE, found.length - shown)}</button>}
    </> : <>
      {hidden.length > 0 && <><h3>Скрыты с сайта</h3><ul className="admin-products">{hidden.map(row)}</ul></>}
      <h3>Видны на сайте · {visible.length}</h3><ul className="admin-products">{visible.slice(0,shown).map(row)}</ul>
      {visible.length>shown&&<button type="button" className="btn btn--secondary admin-more" onClick={()=>setShown(n=>n+PAGE_SIZE)}>Показать ещё {Math.min(PAGE_SIZE,visible.length-shown)}</button>}
    </>}
  </section>;
}

function rememberEditorTab(tab:string){const params=new URLSearchParams(location.search);params.set('editorTab',tab);history.replaceState(history.state,'',ADMIN_PATH+'?'+params.toString())}

type EditTab = 'price' | 'about' | 'facts' | 'docs' | 'photo' | 'videos';
const editTabs: [EditTab, string][] = [['price', 'Цены, наличие и метки'], ['about', 'Название и описание'], ['facts', 'Состав и применение'], ['docs', 'Сертификаты'], ['photo', 'Фото'], ['videos', 'Видео']];
/** A product's editor: prices and stock, and the card's content (everything a visitor sees on the product page). */
function ProductTabs({ product: p, override, run, initialTab='price' }: { product: Product; override?: ProductOverride; run: Run; initialTab?:EditTab }) {
  const panel=useRef<HTMLDivElement>(null),[loadingHeight,setLoadingHeight]=useState(0);
  const [tab, setTab] = useState<EditTab>(()=>{const requested=new URLSearchParams(location.search).get('editorTab');return editTabs.some(([id])=>id===requested)?requested as EditTab:initialTab});
  const [priceDraft,setPriceDraft]=useState<Product>(p),[knowledgeDraft,setKnowledgeDraft]=useState<{knowledge:ProductKnowledge;content:ProductContent}|null>(null),[mediaDraft,setMediaDraft]=useState<ProductContent>({});
  const preview=<ProductPreviewButton product={{...priceDraft,...(knowledgeDraft?{knowledge:knowledgeDraft.knowledge,experts:knowledgeDraft.knowledge.experts??p.experts}:{})}} content={{...knowledgeDraft?.content,...mediaDraft}}/>;
  return <div className="admin-editor">
    <RequiredHint/>
    <Visibility product={p} run={run} />
    <nav className="admin-subtabs" role="tablist">{editTabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => {setLoadingHeight(panel.current?.getBoundingClientRect().height||0);setTab(id);rememberEditorTab(id)}}>{label}</button>)}</nav>
    <div ref={panel} className="admin-product-tab-body">
      <div style={{display:tab==='price'?undefined:'none'}}><ProductEditor product={p} override={override} run={run} onPreviewChange={setPriceDraft} preview={tab==='price'?preview:undefined}/></div>
      <div style={{display:tab==='about'||tab==='facts'?undefined:'none'}}><KnowledgeEditor product={p} run={run} mode={tab==='facts'?'facts':'about'} loadingMinHeight={loadingHeight} onPreviewChange={setKnowledgeDraft} preview={tab==='about'||tab==='facts'?preview:undefined}/></div>
      <div style={{display:['docs','photo','videos'].includes(tab)?undefined:'none'}}><ProductMediaEditor product={p} tab={tab==='docs'||tab==='videos'?tab:'photo'} run={run} onPreviewChange={setMediaDraft} preview={['docs','photo','videos'].includes(tab)?preview:undefined}/></div>
    </div>
  </div>;
}

/** «Новая карточка»: the essentials only — name, article, section, prices and stock. The card is created hidden and
 *  opens in the usual editor below, where its description, composition, certificates and photo are filled in; then
 *  «Показать на сайте» opens it to customers (scripts/site-admin.mjs /api/admin/new-product, src/custom-product.mjs). */
function BadgeEditor({value,onChange}:{value:ProductBadges;onChange:(value:ProductBadges)=>void}) {
 return <fieldset className="admin-badge-editor"><legend>Метки товара</legend>
  <label>Скидка<select className="field" value={value.discountPercent} onChange={e=>onChange({...value,discountPercent:Number(e.target.value)})}><option value={0}>Без скидки</option>{DISCOUNT_PERCENTS.map(n=><option key={n} value={n}>−{n}%</option>)}</select></label>
  <div className="admin-badge-checks"><label><input type="checkbox" checked={value.isNew} onChange={e=>onChange({...value,isNew:e.target.checked})}/>Новинка</label><label><input type="checkbox" checked={value.isHit} onChange={e=>onChange({...value,isHit:e.target.checked})}/>Хит продаж</label></div>
  <p className="admin-hint-muted">Метки видны на карточках товара по всему сайту. «Нет в наличии» появляется автоматически по наличию. Метка скидки обозначает акцию; итоговую цену укажите в полях цены выше.</p>
 </fieldset>;
}

function NewProduct({run,onCreated,onCancel}:{run:Run;onCreated:(id:string)=>void;onCancel:()=>void}){
 const categoryField=useRef<HTMLSelectElement>(null);
 const panel=useRef<HTMLDivElement>(null),[loadingHeight,setLoadingHeight]=useState(0);
 const [f,setF]=useState({name:'',article:'',categoryPath:'',retailRub:'',partnerRub:'',availability:'InStock',badges:readProductBadges(null)});
 const [tab,setTab]=useState<EditTab>(()=>{const requested=new URLSearchParams(location.search).get('editorTab');return editTabs.some(([id])=>id===requested)?requested as EditTab:'price'}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [knowledge,setKnowledge]=useState<ProductKnowledge>({about:[],highlights:[],benefit:'',recommendations:[],pairs:[],sources:[],experts:[]});
 const [properties,setProperties]=useState<Record<string,string>>({});
 const [assets,setAssets]=useState<ProductAssets>({photos:[],documents:[],videos:[]});
 const [showImmediately,setShowImmediately]=useState(true);
 useLayoutEffect(()=>{if(tab==='price'&&error&&!f.categoryPath)categoryField.current?.focus();},[tab,error,f.categoryPath]);
 const draftSnapshot=JSON.stringify([f,knowledge,properties,assets,showImmediately]);const initialDraft=useRef(draftSnapshot);useUnsavedProduct(draftSnapshot!==initialDraft.current);
 const set=(key:keyof typeof f)=>(value:string)=>setF(x=>({...x,[key]:value}));
 const sections=data.categories.filter(c=>c.path!=='/catalog/').map(c=>({path:c.path,label:c.parent&&c.parent!=='/catalog/'?`${data.categories.find(x=>x.path===c.parent)?.name??''} › ${c.name}`:c.name})).sort((a,b)=>a.label.localeCompare(b.label,'ru'));
 const draftProduct=customProduct('new-draft',{...f,retailRub:Number(f.retailRub)||1,partnerRub:null,availability:f.availability==='OutOfStock'?'OutOfStock':'InStock'},data.categories);
 const hasKnowledge=Boolean(knowledge.about.some(s=>s.trim())||knowledge.sources.length||knowledge.recommendations.length||knowledge.pairs.length||knowledge.experts?.length);
 const save=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;setError('');
  if(!f.categoryPath){setTab('price');setError('Выберите категорию товара. Карточка появится именно в этой категории.');categoryField.current?.focus();return}
  if(f.name.trim().length<2||!f.retailRub.trim()){setTab('price');setError('Укажите название, раздел каталога и розничную цену.');return}
  if(!assets.photos.length){setTab('photo');rememberEditorTab('photo');setError('Добавьте хотя бы одно фото товара.');return}
  setBusy(true);const before=new Set(data.products.map(p=>p.id));
  try{
   if(!await run('/api/admin/new-product',{product:f,publish:showImmediately,content:{summary:knowledge.benefit,properties,...assets,image:assets.photos[0]||''},...(hasKnowledge?{knowledge}:{})},`Карточка создана: ${f.name.trim()}. ${showImmediately?'Товар появился в каталоге.':'Она скрыта от покупателей.'}`)){setError('Карточка не создана. Проверьте сообщение об ошибке и заполненные поля.');return}
   const created=data.products.find(p=>!before.has(p.id));if(created)onCreated(created.id);
  }finally{setBusy(false)}
 };
 return <form className="admin-new-product-workspace-form" onSubmit={save} noValidate data-ds-id="admin-new-product">
  <RequiredHint/>
  <nav className="admin-subtabs" role="tablist" aria-label="Новая карточка товара">{([['price','Цены, наличие и метки'],['about','Название и описание'],['facts','Состав и применение'],['photo','Фото'],['docs','Сертификаты'],['videos','Видео']] as const).map(([id,label])=><button type="button" role="tab" key={id} aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>{setLoadingHeight(panel.current?.getBoundingClientRect().height||0);setTab(id);rememberEditorTab(id)}}>{label}</button>)}</nav>
  <div ref={panel} className="admin-product-tab-body">{error&&<p className="admin-error" role="alert">{error}</p>}
  {tab==='price'&&<section className="knowledge-paper new-product-basic"><h2>Основные сведения</h2><div className="admin-editor-grid">
   <label><RequiredLabel>Название</RequiredLabel><input className="field" required minLength={2} maxLength={200} value={f.name} onChange={e=>set('name')(e.target.value)} placeholder="Название товара"/></label>
   <label>Артикул<input className="field" value={f.article} onChange={e=>set('article')(e.target.value)} placeholder="Необязательно"/></label>
   <label><RequiredLabel>Категория товара</RequiredLabel><select ref={categoryField} className="field" required aria-invalid={Boolean(error&&!f.categoryPath)} value={f.categoryPath} onChange={e=>set('categoryPath')(e.target.value)}><option value="">Выберите категорию</option>{sections.map(c=><option key={c.path} value={c.path}>{c.label}</option>)}</select></label>
   <label><RequiredLabel>Розничная цена, ₽</RequiredLabel><input className="field" required inputMode="numeric" value={f.retailRub} onChange={e=>set('retailRub')(e.target.value)}/></label>
   <label>Цена по карте, ₽<input className="field" inputMode="numeric" value={f.partnerRub} onChange={e=>set('partnerRub')(e.target.value)} placeholder="Необязательно"/></label>
  </div><BadgeEditor value={f.badges} onChange={badges=>setF(x=>({...x,badges}))}/><div className="admin-choice" role="radiogroup" aria-label="Наличие">{(['InStock','OutOfStock'] as const).map(value=><button type="button" role="radio" key={value} aria-checked={f.availability===value} className={f.availability===value?'active':''} onClick={()=>set('availability')(value)}>{value==='InStock'?'В наличии':'Нет в наличии'}</button>)}</div></section>}
  {(tab==='about'||tab==='facts')&&<KnowledgeEditor product={draftProduct} run={run} mode={tab} loadingMinHeight={loadingHeight} draftValue={knowledge} onDraftChange={setKnowledge} contentValue={{name:f.name,properties}} onContentChange={value=>{setProperties(value.properties);setF(x=>({...x,name:value.name}))}}/>}
  {(tab==='photo'||tab==='docs'||tab==='videos')&&<section className="knowledge-paper"><ProductAssetFields tab={tab} value={assets} onChange={setAssets}/></section>}
  </div><label className="new-product-publish"><input type="checkbox" checked={showImmediately} onChange={e=>setShowImmediately(e.target.checked)}/>Показать в каталоге сразу после создания</label>
  <footer className="knowledge-savebar"><p>{showImmediately?'После создания товар появится в каталоге в общем формате карточек.':'Карточка сохранится скрытой. Её можно будет показать на сайте позже.'}</p><div className="admin-editor-actions"><button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button><ProductPreviewButton product={{...draftProduct,knowledge,experts:knowledge.experts??[]}} content={{name:f.name,about:knowledge.about,highlights:knowledge.highlights,summary:knowledge.benefit,properties,photos:assets.photos,image:assets.photos[0],documents:assets.documents,videos:assets.videos}}/><button className="btn btn--primary" disabled={busy}>{busy?'Создаём…':'Создать карточку'}</button></div></footer>
 </form>;
}

/** Shown to customers or hidden: a hidden product leaves the catalog, search, home, theme pages and the chat (src/site.ts);
 *  its page stays at its address and says it is not on sale. The switch works at once, nothing else to save. */
function Visibility({ product: p, run }: { product: Product; run: Run }) {
  const hidden = Boolean(p.hidden);
  return <div className={`admin-visibility${hidden ? ' is-hidden' : ''}`}>
    <p>{hidden ? <><strong>Скрыт с сайта.</strong> Покупатели не видят товар в каталоге, поиске и чате.{builtHidden(p) ? ' Эта линейка больше не поставляется.' : p.custom ? ' Новая карточка: заполните описание и фото во вкладках ниже, затем покажите её.' : ''}</> : <><strong>Виден покупателям.</strong> Скройте, если товар больше не продаётся, — вернуть можно в любой момент.</>}</p>
    <button type="button" className="btn btn--primary admin-visibility-toggle" onClick={() => void run('/api/admin/visibility', { productId: p.id, hidden: !hidden }, hidden ? `${p.custom ? 'Показали' : 'Вернули'} на сайте: ${shortName(p.name)}` : `Скрыли с сайта: ${shortName(p.name)}`)}>{hidden ? p.custom ? 'Показать на сайте' : 'Вернуть на сайт' : 'Скрыть с сайта'}</button>
    {p.custom && <DeleteCard product={p} run={run} />}
  </div>;
}

/** Only a card created here can be deleted (built cards are hidden instead); asks once more before deleting. */
function DeleteCard({ product: p, run }: { product: Product; run: Run }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" className="btn btn--secondary" onClick={() => setSure(true)}>Удалить карточку</button>;
  return <span className="admin-confirm admin-delete-confirm"><span>Удалить «{shortName(p.name)}» со всем описанием и фото?</span><button type="button" className="btn btn--primary" onClick={() => void run('/api/admin/delete-product', { productId: p.id }, `Карточка удалена: ${shortName(p.name)}`)}>Да, удалить</button><button type="button" className="btn btn--secondary" onClick={() => setSure(false)}>Нет</button></span>;
}

function ProductEditor({ product: p, override: o, run, onPreviewChange,preview }: { product: Product; override?: ProductOverride; run: Run; onPreviewChange:(product:Product)=>void;preview?:ReactNode }) {
  const {site}=useStore();
  const [f, setF] = useState({ retailUnits: number(o?.retailUnits), partnerUnits: number(o?.partnerUnits), retailRub: number(o?.retailRub), partnerRub: number(o?.partnerRub), availability: o?.availability ?? (p.availability === 'OutOfStock' ? 'OutOfStock' : 'InStock'), badges: readProductBadges(o?.badges ?? p.badges) });
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const [saved,setSaved]=useState(()=>JSON.stringify(f));useUnsavedProduct(JSON.stringify(f)!==saved);
  const save = async(e: FormEvent) => { e.preventDefault(); if(await run('/api/admin/product', { productId: p.id, ...f }, `Сохранено: ${shortName(p.name)}`))setSaved(JSON.stringify(f)); };
  const units = p.prices.units;
  const numeric=(raw:string)=>raw.trim()?Number(raw.replace(',','.')):null;
  const previewSite=readSite({...site,products:{...site?.products,[p.id]:{...o,retailUnits:numeric(f.retailUnits),partnerUnits:numeric(f.partnerUnits),retailRub:numeric(f.retailRub),partnerRub:numeric(f.partnerRub)}}});
  const previewPrices=pricesUnder(p,p.prices,previewSite,data.pricing.rubPerUnit);
  useEffect(()=>{onPreviewChange({...p,availability:f.availability,badges:f.badges,prices:{...p.prices,...previewPrices}})},[JSON.stringify(f),JSON.stringify(previewPrices),p,onPreviewChange]);
  return <form className="admin-price" onSubmit={save}>
    <div className="admin-editor-grid">
      <label>Розничная, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.retail)} по прайсу` : 'нет в прайсе'} value={f.retailUnits} onChange={e => set('retailUnits')(e.target.value)} /></label>
      <label>По карте, у.е.<input className="field" inputMode="decimal" placeholder={units ? `${number(units.partner)} по прайсу` : 'нет в прайсе'} value={f.partnerUnits} onChange={e => set('partnerUnits')(e.target.value)} /></label>
      <label>Розничная, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.retailRub} onChange={e => set('retailRub')(e.target.value)} /></label>
      <label>По карте, ₽ — вместо расчёта<input className="field" inputMode="numeric" placeholder="не задана" value={f.partnerRub} onChange={e => set('partnerRub')(e.target.value)} /></label>
    </div>
    <BadgeEditor value={f.badges} onChange={badges=>setF(x=>({...x,badges}))}/>
    <div className="admin-choice" role="radiogroup" aria-label="Наличие">{([['InStock', 'В наличии'], ['OutOfStock', 'Нет в наличии']] as const).map(([v, label]) => <button type="button" key={v} role="radio" aria-checked={f.availability === v} className={f.availability === v ? 'active' : ''} onClick={() => set('availability')(v)}>{label}</button>)}</div>
    <div className="admin-editor-actions">{preview}<button className="btn btn--primary">Сохранить</button>{o && <button type="button" className="btn btn--secondary" onClick={() => void run('/api/admin/product', { productId: p.id, reset: true }, `Как в прайсе: ${shortName(p.name)}`)}>Вернуть как в прайсе</button>}<a href={siteUrl(p.path)} className="admin-link">Открыть товар</a></div>
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
    <p className="admin-lead">Сотрудник входит на странице управления сайтом (nsp-center.ru{ADMIN_PATH}) по своей почте. Это отдельный аккаунт: покупки на сайте он делает обычным аккаунтом покупателя. Покупателей на сайте: {overview.customers}.</p>
    <ul className="admin-users">{overview.staff.map(u => <li key={u.email}><span><strong>{u.name || u.email}</strong><small>{u.email}{u.lastLogin ? ` · входил ${when(u.lastLogin)}` : ' · ещё не входил'}</small></span><span className="admin-user-actions"><button type="button" className="btn btn--secondary" onClick={() => setResetting(u.email)}>Новый пароль</button>{u.email.toLowerCase() !== me?.email.toLowerCase() && <button type="button" className="btn btn--secondary" onClick={() => setRemoving(u.email)}>Удалить</button>}</span></li>)}</ul>
    <h3>Добавить сотрудника</h3>
    <RequiredHint/><form className="admin-staff-form" onSubmit={add}>
      <label>Имя и фамилия<input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Петров" maxLength={120} /></label>
      <label><RequiredLabel>Почта сотрудника</RequiredLabel><input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Введите email" required /></label>
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
