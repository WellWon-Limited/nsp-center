import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { data, money, priceOf, shortName, useStore } from '../../../packages/presentation/store';
import { BackLink, Icon } from '../../../packages/presentation/ui';
import { EmailInput, PhoneInput } from '../../../packages/presentation/contact-inputs';
import { customerEmailError, phoneError } from '../../../packages/presentation/contact-fields.mjs';
import { cartSummary, COURIER_RUB, FREE_COURIER_FROM } from './cart-summary.mjs';
import { deliveryDays, earliestSlot, type DeliveryDay } from './delivery-slots.mjs';
import './checkout.css';

// «Оформление заказа» (/checkout/): contacts, the way to receive the order with its address, a comment and the two
// consents with links to the documents — two columns, the order on the right staying in view (owner's choice of three
// layouts, 2026-11-17). Reached from the cart («Перейти к оформлению») with the ticked products, or from a product's
// «Купить сейчас» with that product alone. Payment is not connected yet: «Перейти к оплате» only checks the form
// (docs/ORDERS.md — ЮKassa comes later).

type Method = 'pickup' | 'courier' | 'cdek';
type Form = { firstName: string; lastName: string; phone: string; email: string; method: Method; city: string; street: string; house: string; flat: string; cdekPoint: string; cdekCode: string; cdekPrice: number | null; cdekDays: string; day: string; window: string; comment: string; offer: boolean; consent: boolean; mailing: boolean };
const UNSELECTED = 'nsp-center:cart-unselected';
const readUnselected = () => { try { const v = JSON.parse(localStorage.getItem(UNSELECTED) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } };

const methods: { id: Method; title: string; note: string }[] = [
  { id: 'pickup', title: 'Самовывоз', note: 'Санкт-Петербург, наб. Обводного канала, 64, корп. 2, офис 29/3' },
  { id: 'courier', title: 'Курьер по Санкт-Петербургу', note: 'В пределах КАД, пн–сб с 10:00 до 18:00; при заказе до 14:00 — в тот же день' },
  { id: 'cdek', title: 'СДЭК по России', note: 'В пункт выдачи или курьером, срок и цена — по тарифу СДЭК' },
];

/** «Купить сейчас» on a product (?buy=<id>&qty=<n>): the order is that product alone; the cart is not touched. */
function buyNow(url: string) {
  const q = new URL(url, 'http://nsp.local').searchParams; const p = data.products.find(x => x.id === q.get('buy'));
  return p ? { product: p, qty: Math.max(1, Math.min(99, Number(q.get('qty')) || 1)) } : null;
}
function useCheckout(url: string) {
  const { state, ready } = useStore();
  const buy = buyNow(url);
  const acc = state.signedIn ? state.account : null;
  const [form, setForm] = useState<Form>({ firstName: acc?.firstName ?? '', lastName: acc?.lastName ?? '', phone: acc?.phone ?? '', email: acc?.email ?? '', method: 'pickup', city: 'Санкт-Петербург', street: '', house: '', flat: '', cdekPoint: '', cdekCode: '', cdekPrice: null, cdekDays: '', day: '', window: '', comment: '', offer: false, consent: false, mailing: false });
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const rows = buy ? [buy.product] : data.products.filter(p => state.cart[p.id]);
  const items: Record<string, number> = buy ? { [buy.product.id]: buy.qty } : state.cart;
  const sum = useMemo(() => cartSummary(rows, items, ready && !buy ? readUnselected() : [], state.card), [rows, items, state.card, ready, buy]);
  const delivery = form.method === 'pickup' ? 0 : form.method === 'courier' ? sum.courier : form.cdekPrice;
  const contactsOk = Boolean(form.firstName.trim() && form.lastName.trim() && !phoneError(form.phone) && !customerEmailError(form.email));
  const addressOk = form.method === 'pickup' || (form.method === 'courier' ? Boolean(form.street.trim() && form.house.trim() && form.day && form.window) : Boolean(form.cdekCode || (form.city.trim() && form.cdekPoint.trim())));
  const consentsOk = form.offer && form.consent;
  return { state, ready, form, set, sum, items, buy, delivery, contactsOk, addressOk, consentsOk, ok: contactsOk && addressOk && consentsOk && sum.count > 0 };
}
type Checkout = ReturnType<typeof useCheckout>;

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`checkout-field${wide ? ' checkout-field--wide' : ''}`}><span>{label}</span>{children}</label>;
}
function Contacts({ c }: { c: Checkout }) {
  const { form, set } = c;
  return <div className="checkout-grid">
    <Field label="Имя"><input className="field" value={form.firstName} onChange={e => set('firstName')(e.target.value)} autoComplete="given-name" required /></Field>
    <Field label="Фамилия"><input className="field" value={form.lastName} onChange={e => set('lastName')(e.target.value)} autoComplete="family-name" required /></Field>
    <Field label="Телефон"><PhoneInput id="checkout-phone" value={form.phone} onChange={set('phone')} /></Field>
    <Field label="Почта — пришлём чек и статус заказа"><EmailInput id="checkout-email" value={form.email} onChange={set('email')} /></Field>
  </div>;
}
function Methods({ c }: { c: Checkout }) {
  const { form, set, sum } = c;
  const price = (m: Method) => m === 'pickup' ? 'бесплатно' : m === 'courier' ? (sum.courier ? money(COURIER_RUB) : 'бесплатно') : 'по тарифу';
  return <div className="checkout-methods" role="radiogroup" aria-label="Способ получения">{methods.map(m => <label key={m.id} className={`checkout-method${form.method === m.id ? ' is-on' : ''}`}><input type="radio" name="method" checked={form.method === m.id} onChange={() => set('method')(m.id)} /><span className="checkout-method-copy"><strong>{m.title}</strong><small>{m.note}</small></span><b>{price(m.id)}</b></label>)}</div>;
}
function Address({ c }: { c: Checkout }) {
  const { form, set, sum } = c;
  if (form.method === 'pickup') return <p className="checkout-note">Заберите заказ в пункте выдачи: пн–пт 10:00–19:00, сб 11:00–17:30. Мы напишем, когда он будет готов.</p>;
  if (form.method === 'courier') return <><Slots c={c} /><div className="checkout-grid">
    <Field label="Улица" wide><input className="field" value={form.street} onChange={e => set('street')(e.target.value)} autoComplete="address-line1" /></Field>
    <Field label="Дом, корпус"><input className="field" value={form.house} onChange={e => set('house')(e.target.value)} /></Field>
    <Field label="Квартира или офис"><input className="field" value={form.flat} onChange={e => set('flat')(e.target.value)} /></Field>
  </div>{sum.freeCourierLeft > 0 && <p className="checkout-note">До бесплатной доставки курьером осталось {money(sum.freeCourierLeft)} — она бесплатна от {money(FREE_COURIER_FROM)}.</p>}</>;
  return <CdekPoint c={c} />;
}
// Courier day and time (owner, 2026-11-17): five working days Monday to Saturday, 10:00–14:00 or 14:00–18:00; the
// earliest free window is chosen to begin with; a window of today that has already started is shown greyed out.
function Slots({ c }: { c: Checkout }) {
  const { form, set } = c;
  const [days] = useState<DeliveryDay[]>(() => deliveryDays());
  useEffect(() => { if (!form.day) { const e = earliestSlot(days); set('day')(e.date); set('window')(e.window); } }, [days, form.day, set]);
  const day = days.find(d => d.date === form.day) ?? days[0];
  const pick = (d: DeliveryDay) => { set('day')(d.date); if (!d.windows.find(w => w.id === form.window)?.free) set('window')(d.windows.find(w => w.free)?.id ?? ''); };
  return <div className="checkout-slots">
    <span className="checkout-slots-title">День доставки</span>
    <div className="checkout-days" role="radiogroup" aria-label="День доставки">{days.map(d => <button key={d.date} type="button" role="radio" aria-checked={form.day === d.date} className={form.day === d.date ? 'is-on' : ''} onClick={() => pick(d)}><strong>{d.label}</strong><small>{d.sub}</small></button>)}</div>
    <span className="checkout-slots-title">Время</span>
    <div className="checkout-windows" role="radiogroup" aria-label="Время доставки">{day?.windows.map(w => <button key={w.id} type="button" role="radio" aria-checked={form.window === w.id} disabled={!w.free} className={form.window === w.id ? 'is-on' : ''} onClick={() => set('window')(w.id)}>{w.label}</button>)}</div>
  </div>;
}
// CDEK pickup point on CDEK's own map (owner, 2026-11-17): the parcel goes as one box; until the products carry their
// weights each counts 150 g plus 100 g of packing. The chosen point, its tariff price and days come back here; the
// delivery is paid together with the order (docs/ORDERS.md). The map and its script load only when CDEK is chosen.
function CdekPoint({ c }: { c: Checkout }) {
  const { form, set, sum, items } = c;
  const [state, setState] = useState<'loading' | 'ready' | 'off'>('loading');
  const weight = 100 + sum.chosen.reduce((g, p) => g + 150 * (items[p.id] || 1), 0);
  useEffect(() => {
    let widget: { destroy(): void } | null = null, gone = false;
    fetch('/api/cdek?action=config').then(r => r.ok ? r.json() : null).then((cfg: { enabled?: boolean; yandexKey?: string } | null) => { if (gone) return; if (!cfg?.enabled || !cfg.yandexKey) { setState('off'); return; }
      return import('@cdek-it/widget').then(({ default: Widget }) => { if (gone) return;
        widget = new Widget({ root: 'cdek-map', apiKey: cfg.yandexKey, servicePath: '/api/cdek', from: { country_code: 'RU', city: 'Санкт-Петербург', code: 137 }, defaultLocation: 'Санкт-Петербург', goods: [{ width: 15, height: 10, length: 20, weight }], hideDeliveryOptions: { door: true, office: false }, tariffs: { office: [136, 234], pickup: [368] }, lang: 'rus', currency: 'RUB', onReady: () => setState('ready'),
          onChoose: (_mode: string, tariff: { delivery_sum: number; period_min: number; period_max: number }, address: { code?: string; address?: string; city?: string }) => {
            set('cdekCode')(address.code ?? ''); set('cdekPoint')([address.city, address.address].filter(Boolean).join(', ')); set('cdekPrice')(Math.round(tariff.delivery_sum));
            set('cdekDays')(tariff.period_min === tariff.period_max ? `${tariff.period_min}` : `${tariff.period_min}–${tariff.period_max}`);
          } } as never);
      }); }).catch(() => !gone && setState('off'));
    return () => { gone = true; widget?.destroy(); };
  }, [weight]);
  return <div className="checkout-cdek">
    {form.cdekCode ? <div className="checkout-cdek-chosen"><strong>{form.cdekPoint}</strong><span>{form.cdekPrice !== null ? money(form.cdekPrice) : ''}{form.cdekDays ? ` · ${form.cdekDays} дн.` : ''}</span><button type="button" className="text-button" onClick={() => { set('cdekCode')(''); set('cdekPoint')(''); set('cdekPrice')(null); }}>Выбрать другой пункт</button></div> : null}
    {state === 'off' ? <><div className="checkout-grid">
      <Field label="Город"><input className="field" value={form.city} onChange={e => set('city')(e.target.value)} autoComplete="address-level2" /></Field>
      <Field label="Пункт СДЭК или адрес"><input className="field" value={form.cdekPoint} onChange={e => set('cdekPoint')(e.target.value)} /></Field>
    </div><p className="checkout-note">Карта пунктов СДЭК сейчас недоступна — менеджер уточнит пункт и цену доставки.</p></>
      : <div id="cdek-map" className={`checkout-cdek-map${form.cdekCode ? ' is-hidden' : ''}`} aria-label="Карта пунктов выдачи СДЭК" aria-busy={state === 'loading'} />}
    <p className="checkout-note">Доставка СДЭК оплачивается вместе с заказом по тарифу СДЭК.</p>
  </div>;
}
function Comment({ c }: { c: Checkout }) {
  return <Field label="Комментарий к заказу — по желанию" wide><textarea className="field checkout-comment" value={c.form.comment} onChange={e => c.set('comment')(e.target.value)} rows={3} maxLength={500} placeholder="Например: позвоните за час до доставки" /></Field>;
}
function Consents({ c }: { c: Checkout }) {
  const { form, set } = c;
  return <div className="checkout-consents">
    <label><input type="checkbox" checked={form.offer} onChange={e => set('offer')(e.target.checked)} /><span>Я принимаю условия <a href="/company/privacy-policy/" target="_blank" rel="noopener">договора публичной оферты</a> и <a href="/company/refund/" target="_blank" rel="noopener">условия возврата</a></span></label>
    <label><input type="checkbox" checked={form.consent} onChange={e => set('consent')(e.target.checked)} /><span>Я даю <a href="/company/consent/" target="_blank" rel="noopener">согласие на обработку персональных данных</a> для оформления и доставки заказа</span></label>
    <label><input type="checkbox" checked={form.mailing} onChange={e => set('mailing')(e.target.checked)} /><span>Присылать новости и предложения — по желанию</span></label>
  </div>;
}
// The order's products as words and sums, no packshots (owner, 2026-11-17).
function Items({ c }: { c: Checkout }) {
  const { state, sum, items } = c;
  return <ul className="checkout-items">{sum.chosen.map(p => <li key={p.id}><span className="checkout-item-name">{shortName(p.name)}<small>{items[p.id]} шт.</small></span><strong>{money(priceOf(p, state.card) * items[p.id])}</strong></li>)}</ul>;
}
function Totals({ c }: { c: Checkout }) {
  const { state, sum, delivery } = c;
  return <div className="checkout-totals">
    <div><span>Товары, {sum.count} шт.</span><strong>{money(sum.retail)}</strong></div>
    {state.card && sum.saving > 0 && <div className="checkout-discount"><span>Скидка по карте</span><strong>−{money(sum.saving)}</strong></div>}
    <div><span>Доставка</span><strong>{delivery === null ? 'по тарифу СДЭК' : delivery ? money(delivery) : 'бесплатно'}</strong></div>
    <div className="checkout-total"><span>Итого</span><strong>{money(sum.total + (delivery ?? 0))}</strong></div>
  </div>;
}
function Pay({ c }: { c: Checkout }) {
  const { notify } = useStore();
  return <><button type="submit" className="btn btn--primary checkout-pay" disabled={!c.ok} onClick={() => c.ok && notify('Проверено. Оплата подключится после договора с ЮKassa')}>Перейти к оплате<Icon name="chevron" size={18} /></button>
    <p className="checkout-fine">Картой, SberPay, T-Pay или по СБП. Деньги спишутся, когда заказ соберут; чек придёт на почту.</p></>;
}
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return <section className="checkout-section"><h2><span className="checkout-step-n">{n}</span>{title}</h2>{children}</section>;
}

function TwoColumns({ c }: { c: Checkout }) {
  return <div className="checkout-v1">
    <div className="checkout-main">
      <div className="panel checkout-card"><Section n={1} title="Контакты"><Contacts c={c} /></Section></div>
      <div className="panel checkout-card"><Section n={2} title="Способ получения"><Methods c={c} /><Address c={c} /></Section></div>
      <div className="panel checkout-card"><Section n={3} title="Комментарий"><Comment c={c} /></Section></div>
    </div>
    <aside className="panel checkout-card checkout-side"><h2>Ваш заказ</h2><Items c={c} /><Totals c={c} /><Consents c={c} /><Pay c={c} /></aside>
  </div>;
}

export function Checkout({ url }: { url: string }) {
  const c = useCheckout(url);
  const submit = (e: FormEvent) => e.preventDefault();
  const back = c.buy ? <BackLink fallback={c.buy.product.path} label={shortName(c.buy.product.name)} fixed /> : <BackLink fallback="/cart/" label="Корзина" fixed />;
  if (!c.ready) return <div className="account-route-loading" aria-busy="true" aria-label="Загрузка" />;
  if (!c.sum.count) return <div className="checkout">{back}<div className="checkout-head"><h1>Оформление заказа</h1></div><p className="cart-empty empty-screen">В заказе пока нет товаров. <a href="/cart/">Вернуться в корзину</a></p></div>;
  return <form className="checkout" onSubmit={submit} data-ds-id="checkout" noValidate>
    {back}<div className="checkout-head"><h1>Оформление заказа</h1><p>Проверьте контакты и выберите, как получить заказ.</p></div>
    <TwoColumns c={c} />
  </form>;
}
