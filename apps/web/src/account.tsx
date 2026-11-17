import {Barcode} from '../../../packages/presentation/discount-barcode';
import {CardApplicationPage,CardApplicationStatus,useCardApplication} from '../../../packages/presentation/card-application';
import './account.css';
import { ConfirmDialog } from '../../../packages/presentation/confirm-dialog';
import { useEffect, useState, type FormEvent } from 'react';
import { data, useStore, type Account } from '../../../packages/presentation/store';
import { Icon, ProductGrid } from '../../../packages/presentation/ui';
import { InstallAppCard } from '../../../packages/presentation/pwa';
import { PhoneInput } from '../../../packages/presentation/contact-inputs';
import { phoneError } from '../../../packages/presentation/contact-fields.mjs';
import {useCustomerOrders} from './customer-orders';
import {completedPurchases,activeOrder} from './customer-order-status.mjs';
import { purchasedIds } from './purchased-ids.mjs';

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
    if (phoneError(draft.phone)) { notify(phoneError(draft.phone)); return; }
    setState(s => s.account ? { ...s, name: draft.firstName.trim(), account: { ...s.account, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phone: draft.phone.trim() } } : s);
    setEditing(false); notify('Данные сохранены');
  };
  return <section className="account-card" data-ds-id="account-personal">
    <div className="account-card-head"><h2>Личные данные</h2>{!editing && <button className="text-button" onClick={() => setEditing(true)}>Изменить</button>}</div>
    {editing ? <form className="account-form" onSubmit={save}>
      <label>Имя<input className="field" value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))} required maxLength={60} autoComplete="given-name" /></label>
      <label>Фамилия<input className="field" value={draft.lastName} onChange={e => setDraft(d => ({ ...d, lastName: e.target.value }))} required maxLength={60} autoComplete="family-name" /></label>
      <div className="account-form-field"><label htmlFor="account-phone">Телефон</label><PhoneInput id="account-phone" value={draft.phone} onChange={phone => setDraft(d => ({ ...d, phone }))} /></div>
      <div className="account-form-actions"><button className="btn btn--primary">Сохранить</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Отмена</button></div>
    </form> : <dl className="account-data">
      <div><dt>Имя</dt><dd>{account.firstName} {account.lastName}</dd></div>
      <div><dt>Email</dt><dd>{account.email}</dd></div>
      <div><dt>Телефон</dt><dd>{account.phone || 'не указан'}</dd></div>
    </dl>}
  </section>;
}

const DEMO_POINTS = 100;
const groupDigits = (id: string) => id.replace(/\B(?=(\d{3})+$)/g, ' ');

// The discount card right under the greeting: with a number — the card itself (discount, barcode, number); without —
// the same card shape with a field for the number and a link to get a card.
function DiscountCard({ account }: { account: Account }) {
  const { setState, notify,accounts } = useStore();
  const [busy,setBusy]=useState(false),[attachError,setAttachError]=useState('');
  const [id, setId] = useState('');
  const {application,setApplication,loaded,error:applicationError}=useCardApplication();
  const attach = async(e: FormEvent) => {
    e.preventDefault();if(busy)return;
    const partnerId=id.replace(/\D/g,'');if(!/^\d{6,12}$/.test(partnerId)){setAttachError('Введите номер карты: от 6 до 12 цифр.');return}
    if(accounts!=='server'){setAttachError('Войдите в аккаунт, чтобы отправить номер администратору на проверку.');return}
    setBusy(true);setAttachError('');
    try{const response=await fetch('/api/card-application',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'attach',requestedPartnerId:partnerId})});const body=await response.json();if(body.application)setApplication(body.application);if(!response.ok)throw Error(body.error||'Не удалось отправить номер.');setId('');notify('Номер карты отправлен на проверку. Скидка появится после подтверждения.')}catch(e){setAttachError(e instanceof Error?e.message:'Нет связи с сервером. Повторите попытку.')}finally{setBusy(false)}
  };
  const remove = () => {
    setState(s => s.account ? { ...s, card: false, account: { ...s.account, partnerId: '' } } : s);
    notify('Дисконтная карта удалена');
  };
  return <div className="discount-card-area"><div className="discount-card-scale"><section className={`discount-card${application&&application.status!=='rejected'?' discount-card--requested':''}`} data-ds-id="account-card">
    <div className="discount-card-top"><span>Дисконтная карта</span><span>Nature’s Sunshine</span></div>
    {account.partnerId ? <>
      {/* The card shows the points balance, not the owner's name (it is their own cabinet). A fixed 100 until the partner
          system is connected and accrues points (owner, 2026-11-06). */}<div className="discount-card-main">{account.server||application?.status==='approved'?<strong>Ваша карта NSP</strong>:<strong className="discount-card-points">{DEMO_POINTS} <span>баллов</span></strong>}<span className="discount-card-rate">−30%</span></div>
      <div className="discount-card-code"><Barcode value={account.partnerId} /><span>{groupDigits(account.partnerId)}</span></div>
      <div className="discount-card-foot"><span>Скидка до 30% на все товары в каталоге и корзине</span>{application?.status!=='approved'&&<button type="button" onClick={remove}>Удалить</button>}</div>
    </> : <>
      <div className="discount-card-main"><strong>Скидка до 30%</strong></div>
      <p className="discount-card-text">Добавьте номер карты (ID партнёра NSP). Цены по карте появятся после проверки администратором.</p>
      <div className="discount-card-code"><Barcode value={account.partnerId||'0000000'}/><span>{account.partnerId?groupDigits(account.partnerId):'Номер после подтверждения'}</span></div>


    </>}
  </section></div>{attachError&&<p role="alert" className="contact-error">{attachError}</p>}{(!account.partnerId||application)&&<section className="account-card account-card--application" data-ds-id="account-card-application">{application?<CardApplicationStatus application={application}/>:<><h2>Оформить дисконтную карту</h2><p>Заполните заявку — после оформления и проверки номер карты появится в личном кабинете.</p></>}      {(!application||application.status==='rejected'&&application.data.mode==='attach')&&loaded&&!applicationError&&<form className="discount-card-form" onSubmit={attach}>
        <input className="field" inputMode="numeric" placeholder="Номер карты" aria-label="Номер дисконтной карты" value={id} onChange={e => setId(e.target.value)} />
        <button className="btn" disabled={busy}>{busy?'Отправляем…':'Проверить'}</button>
      </form>}<a className="discount-card-link" href="/profile/?card=apply">{application?'Посмотреть заявку':'Оформить карту'} <Icon name="chevron" size={18}/></a></section>}</div>;
}

export function AccountPage({ account }: { account: Account }) {
  const { state, logout, notify } = useStore();
  const {orders}=useCustomerOrders();
  const active=orders.filter(activeOrder).length;
  const bought = purchasedIds(completedPurchases(orders), new Set(data.products.map(p => p.id))).length;
  const [leaving, setLeaving] = useState(false);
  const favorites = data.products.filter(p => state.favorites.includes(p.id));
  const waiting = data.products.filter(p => state.waitlist.some(x => x.id === p.id));
  const done = state.intake.filter(x => x.done).length;
  const created = russianDate(account.createdAt);
  // Entering the account (after sign-in or registration) starts at the top of the page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  if(new URLSearchParams(location.search).get('card')==='apply')return <CardApplicationPage account={account}/>;
  return <div className="account" data-ds-id="account">
    <header className="account-head">
      <span className="ds-kicker">Личный кабинет</span>
      <h1>Здравствуйте, {account.firstName}!</h1>
      {created && <p className="ds-muted">Аккаунт создан {created}</p>}
    </header>

    <DiscountCard account={account} />

    <div className="account-stack">
      <PersonalData account={account} />
      <section className="account-card account-card--row" data-ds-id="account-active-orders"><div><h2>Мои заказы</h2><p className="ds-muted">{active?`Активных заказов: ${active}`:'Активных заказов пока нет'}</p></div><a className="account-link" href="/profile/orders/">Перейти к заказам <Icon name="chevron" size={16}/></a></section>
      <section className="account-card account-card--row" data-ds-id="account-orders">
        <div>
          <h2>Мои покупки</h2>
          {/* The same products as "Мои покупки" (apps/web/src/purchased-ids.mjs), so the two never disagree. */}
          {bought ? <p className="ds-muted">{bought} {bought % 10 === 1 && bought % 100 !== 11 ? 'товар' : bought % 10 >= 2 && bought % 10 <= 4 && (bought % 100 < 12 || bought % 100 > 14) ? 'товара' : 'товаров'}</p>
            : <p className="ds-muted">Покупок ещё не было</p>}
        </div>
        <a className="account-link" href="/profile/purchases/">Перейти к покупкам <Icon name="chevron" size={16} /></a>
      </section>
      <section className="account-card account-card--row" data-ds-id="account-plan">
        <div>
          <h2>План приёма</h2>
          <p className="ds-muted">{state.intake.length ? `Сегодня отмечено ${done} из ${state.intake.length}` : 'Добавьте продукты и время приёма — сайт будет напоминать о плане.'}</p>
        </div>
        <a className="account-link" href="/health/">Открыть план <Icon name="chevron" size={16} /></a>
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
    {/* Sign-out stays on the profile, which then shows the sign-in form (research 2026-11-10: the app's profile tab keeps
        its place); a confirmation guards against a stray tap, and a short message says it worked. */}
    <button className="account-logout" onClick={() => setLeaving(true)}>Выйти из аккаунта</button>
    {leaving && <ConfirmDialog title="Выйти из аккаунта?" confirm="Выйти" danger={false} onCancel={() => setLeaving(false)} onConfirm={() => { setLeaving(false); void logout().then(() => notify('Вы вышли из аккаунта')); window.scrollTo({ top: 0, behavior: 'instant' }); }}>
      <p className="ds-muted">Корзина и избранное останутся в аккаунте и вернутся, когда вы снова войдёте. На этом устройстве их видно не будет.</p>
    </ConfirmDialog>}
  </div>;
}
