import './account.css';
import { useEffect, useState, type FormEvent } from 'react';
import { data, money, partnerSignupUrl, useStore, type Account } from './store';
import { Icon, ProductGrid } from './ui';

// Signed-in profile of the demo account (see auth.tsx): personal data, order drafts, the
// intake plan, the discount card and favourites, all kept in this browser.

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
  return <section className="account-card account-card--card" data-ds-id="account-card">
    <h2>Дисконтная карта</h2>
    {account.partnerId ? <>
      <p className="account-card-number">№ {account.partnerId}</p>
      <p className="ds-muted">В каталоге и корзине действуют цены по карте.</p>
      <button type="button" className="account-card-remove" onClick={remove}>Удалить карту</button>
    </> : <>
      <p className="ds-muted">Добавьте номер карты (ID партнёра NSP), чтобы видеть цены по карте.</p>
      <form className="account-inline" onSubmit={attach}>
        <input className="field" inputMode="numeric" placeholder="Номер карты" aria-label="Номер дисконтной карты" value={id} onChange={e => setId(e.target.value)} />
        <button className="btn btn--primary">Добавить</button>
      </form>
      <a className="partner-signup" href={partnerSignupUrl} target="_blank" rel="noopener">Оформить дисконтную карту ↗</a>
    </>}
  </section>;
}

export function AccountPage({ account }: { account: Account }) {
  const { state, setState } = useStore();
  const favorites = data.products.filter(p => state.favorites.includes(p.id));
  const done = state.intake.filter(x => x.done).length;
  const created = russianDate(account.createdAt);
  // Entering the account (after sign-in or registration) starts at the top of the page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  return <div className="account" data-ds-id="account">
    <header className="account-head">
      <span className="ds-kicker">Личный кабинет</span>
      <h1>Здравствуйте, {account.firstName}!</h1>
      {created && <p className="ds-muted">Аккаунт создан {created}</p>}
    </header>

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
      <DiscountCard account={account} />
    </div>

    <section className="account-favorites" data-ds-id="account-favorites">
      <h2 className="account-section-title">Избранное</h2>
      {favorites.length ? <ProductGrid products={favorites} /> : <div className="account-card account-empty">
        <span className="account-empty-icon" aria-hidden="true"><Icon name="heart" size={34} /></span>
        <div><h3>Здесь будет то, что вам понравилось</h3><p className="ds-muted">Отмечайте товары сердечком в каталоге — они соберутся в этом списке.</p></div>
        <a className="btn btn--primary" href="/catalog/">Выбрать продукты <Icon name="arrow" size={18} /></a>
      </div>}
    </section>

    <button className="account-logout" onClick={() => setState(s => ({ ...s, signedIn: false }))}>Выйти из аккаунта</button>
  </div>;
}
