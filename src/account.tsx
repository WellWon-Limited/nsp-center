import './account.css';
import { AdminPanel } from './admin';
import { useEffect, useState, type FormEvent } from 'react';
import { data, money, partnerSignupUrl, useStore, type Account } from './store';
import { Icon, ProductGrid } from './ui';
import { InstallAppCard } from './pwa';

// Signed-in profile of the demo account (see auth.tsx): the discount card under the greeting, then personal data,
// order drafts, the intake plan, the app install card (until the app is installed) and favourites, all kept in this browser.

const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const russianDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return y && m && d ? `${d} ${months[m - 1]} ${y}` : ''; };

function PersonalData({ account }: { account: Account }) {
  const { setState, notify } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ firstName: account.firstName, lastName: account.lastName, phone: account.phone });
  const save = (e: FormEvent) => {
    e.preventDefault();
    setState(s => s.account ? { ...s, name: draft.firstName.trim(), account: { ...s.account, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phone: draft.phone.trim() } } : s);
    setEditing(false); notify('Данные сохранены');
  };
  return <section className="account-card" data-ds-id="account-personal">
    <div className="account-card-head"><h2>Личные данные</h2>{!editing && <button className="text-button" onClick={() => setEditing(true)}>Изменить</button>}</div>
    {editing ? <form className="account-form" onSubmit={save}>
      <label>Имя<input className="field" value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))} required maxLength={60} autoComplete="given-name" /></label>
      <label>Фамилия<input className="field" value={draft.lastName} onChange={e => setDraft(d => ({ ...d, lastName: e.target.value }))} required maxLength={60} autoComplete="family-name" /></label>
      <label>Телефон<input className="field" type="tel" value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} maxLength={30} autoComplete="tel" /></label>
      <div className="account-form-actions"><button className="btn btn--primary">Сохранить</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Отмена</button></div>
    </form> : <dl className="account-data">
      <div><dt>Имя</dt><dd>{account.firstName} {account.lastName}</dd></div>
      <div><dt>Email</dt><dd>{account.email}</dd></div>
      <div><dt>Телефон</dt><dd>{account.phone || 'не указан'}</dd></div>
    </dl>}
  </section>;
}

// Code 128 (set B) bars for the card number, so the barcode on the card encodes the real number.
const code128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
function Barcode({ value }: { value: string }) {
  const codes = [...value].map(ch => ch.charCodeAt(0) - 32);
  const check = codes.reduce((sum, c, i) => sum + c * (i + 1), 104) % 103;
  const widths = [104, ...codes, check, 106].flatMap(c => [...code128[c]].map(Number));
  let x = 10; const bars: [number, number][] = [];
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push([x, w]); x += w; });
  return <svg className="discount-barcode" viewBox={`0 0 ${x + 10} 40`} preserveAspectRatio="none" role="img" aria-label={`Штрихкод карты ${value}`}>{bars.map(([bx, w]) => <rect key={bx} x={bx} y="0" width={w} height="40" />)}</svg>;
}
const DEMO_POINTS = 100;
const groupDigits = (id: string) => id.replace(/\B(?=(\d{3})+$)/g, ' ');

// The discount card right under the greeting: with a number — the card itself (discount, barcode, number); without —
// the same card shape with a field for the number and a link to get a card.
function DiscountCard({ account }: { account: Account }) {
  const { setState, notify } = useStore();
  const [id, setId] = useState('');
  const attach = (e: FormEvent) => {
    e.preventDefault();
    const partnerId = id.replace(/\D/g, '');
    if (!partnerId) return;
    setState(s => s.account ? { ...s, card: true, account: { ...s.account, partnerId } } : s);
    setId(''); notify('Дисконтная карта подключена');
  };
  const remove = () => {
    setState(s => s.account ? { ...s, card: false, account: { ...s.account, partnerId: '' } } : s);
    notify('Дисконтная карта удалена');
  };
  return <section className="discount-card" data-ds-id="account-card">
    <div className="discount-card-top"><span>Дисконтная карта</span><span>Nature’s Sunshine</span></div>
    {account.partnerId ? <>
      {/* The card shows the points balance, not the owner's name (it is their own cabinet). A fixed 100 until the partner
          system is connected and accrues points (owner, 2026-11-06). */}<div className="discount-card-main"><strong className="discount-card-points">{DEMO_POINTS} <span>баллов</span></strong><span className="discount-card-rate">−30%</span></div>
      <div className="discount-card-code"><Barcode value={account.partnerId} /><span>{groupDigits(account.partnerId)}</span></div>
      <div className="discount-card-foot"><span>Скидка до 30% на все товары в каталоге и корзине</span><button type="button" onClick={remove}>Удалить</button></div>
    </> : <>
      <div className="discount-card-main"><strong>Скидка до 30%</strong></div>
      <p className="discount-card-text">Добавьте номер карты (ID партнёра NSP) — в каталоге и корзине появятся цены по карте.</p>
      <form className="discount-card-form" onSubmit={attach}>
        <input className="field" inputMode="numeric" placeholder="Номер карты" aria-label="Номер дисконтной карты" value={id} onChange={e => setId(e.target.value)} />
        <button className="btn">Добавить</button>
      </form>
      <a className="discount-card-link" href={partnerSignupUrl} target="_blank" rel="noopener">Оформить дисконтную карту ↗</a>
    </>}
  </section>;
}

export function AccountPage({ account }: { account: Account }) {
  const { state, logout, pendingReviews } = useStore();
  // An administrator's «Управление сайтом» opens in place of the account (/profile/?admin=1). The account renders only in
  // the browser (the profile waits for the store), so the address is read at once and the account never flashes first.
  const adminView = Boolean(account.admin) && typeof location !== 'undefined' && new URLSearchParams(location.search).get('admin') === '1';
  const favorites = data.products.filter(p => state.favorites.includes(p.id));
  const waiting = data.products.filter(p => state.waitlist.some(x => x.id === p.id));
  const done = state.intake.filter(x => x.done).length;
  const created = russianDate(account.createdAt);
  // Entering the account (after sign-in or registration) starts at the top of the page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  if (adminView) return <AdminPanel />;
  return <div className="account" data-ds-id="account">
    <header className="account-head">
      <span className="ds-kicker">Личный кабинет</span>
      <h1>Здравствуйте, {account.firstName}!</h1>
      {created && <p className="ds-muted">Аккаунт создан {created}</p>}
    </header>

    <DiscountCard account={account} />
    {account.admin && <a className="admin-entry" href="/profile/?admin=1" data-ds-id="admin-entry"><span><strong>Управление сайтом</strong><small>{pendingReviews ? `Новых отзывов на проверку: ${pendingReviews}` : 'Заказы, курс у.е., цены и наличие, отзывы'}</small></span>{pendingReviews > 0 && <span className="admin-count">{pendingReviews}</span>}<Icon name="arrow" size={20} /></a>}

    <div className="account-stack">
      <PersonalData account={account} />
      <section className="account-card account-card--row" data-ds-id="account-orders">
        <div>
          <h2>Мои заказы</h2>
          {state.orders.length ? <ul className="account-orders">{state.orders.map(o => <li key={o.id}><span><strong>{o.date}</strong><small>{o.items} шт. · черновик</small></span><strong>{money(o.total)}</strong></li>)}</ul>
            : <p className="ds-muted">Заказов пока нет. Соберите корзину и сохраните заказ.</p>}
        </div>
        <a className="account-link" href="/cart/">В корзину <Icon name="arrow" size={16} /></a>
      </section>
      <section className="account-card account-card--row" data-ds-id="account-plan">
        <div>
          <h2>План приёма</h2>
          <p className="ds-muted">{state.intake.length ? `Сегодня отмечено ${done} из ${state.intake.length}` : 'Добавьте продукты и время приёма — сайт будет напоминать о плане.'}</p>
        </div>
        <a className="account-link" href="/health/">Открыть план <Icon name="arrow" size={16} /></a>
      </section>
      <InstallAppCard />
    </div>

    <section className="account-favorites" data-ds-id="account-favorites">
      <h2 className="account-section-title">Избранное</h2>
      {favorites.length ? <ProductGrid products={favorites} /> : <p className="account-waitlist-empty">Пока пусто</p>}
    </section>

    <section className="account-favorites" data-ds-id="account-waitlist">
      <h2 className="account-section-title">Лист ожидания</h2>
      {waiting.length ? <ProductGrid products={waiting}/> : <p className="account-waitlist-empty">Пока пусто</p>}
    </section>
    <button className="account-logout" onClick={() => { void logout(); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Выйти из аккаунта</button>
  </div>;
}
