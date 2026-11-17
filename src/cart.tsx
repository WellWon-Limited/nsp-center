import './cart.css';
import { useEffect, useRef, useState } from 'react';
import type { Product } from './content-types';
import { data, money, priceOf, shortName, useStore } from './store';
import { LoyaltyStatus } from './loyalty';
import { cartSummary, FREE_COURIER_FROM } from './cart-summary.mjs';
import { CardOffer, Heading, Icon, ProductImage } from './ui';

// Cart with the marketplace logic (owner, 2026-11-10: "как на WB и Ozon", the look stays):
// - every product has a tick; the order is made of the ticked ones, "Выбрать все" and "Удалить выбранные" act on all;
// - a row shows the name, a heart (filled like on a catalog card) and a bin, the quantity and the line total (the struck
//   retail one with the card); minus stops at 1, and removal offers "Вернуть";
// - products that are out of stock go to their own list below: they are not ticked and not counted;
// - "Ваш заказ" counts the ticked products: pieces, sum, card discount, delivery terms with the free-courier threshold,
//   and the total; on a phone a bar with the total stays above the bottom navigation while the summary is off screen.
// Orders are not sent from the site yet: the button saves a draft of the ticked products in this browser.

const cartTubProducts = new Set(['nutri-burn', 'loclo', 'smartmeal-vanila-shake', 'total-nutrition-today']);
const UNSELECTED = 'nsp-center:cart-unselected';
const pieces = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'товар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'товара' : 'товаров'}`;
const inStock = (p: Product) => p.availability !== 'OutOfStock';

/** Ticks survive a reload: the ids the visitor unticked are kept in this browser; a newly added product is ticked. */
function useUnselected() {
  const [unselected, setUnselected] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem(UNSELECTED) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(UNSELECTED, JSON.stringify(unselected)); } catch { /* the ticks still work on this page */ } }, [unselected]);
  return [unselected, setUnselected] as const;
}

type Removed = { items: Record<string, number>; label: string };

export function Cart() {
  const { state, qty, setState, ready, favorite } = useStore();
  const [unselected, setUnselected] = useUnselected();
  const [removed, setRemoved] = useState<Removed | null>(null);
  const summary = useRef<HTMLElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);
  useEffect(() => { if (!removed) return; const t = setTimeout(() => setRemoved(null), 6000); return () => clearTimeout(t); }, [removed]);
  useEffect(() => {
    const el = summary.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSummaryVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el); return () => io.disconnect();
  }, [ready, Object.keys(state.cart).length > 0]);

  const rows = data.products.filter(p => state.cart[p.id]);
  const available = rows.filter(inStock), missing = rows.filter(p => !inStock(p));
  const { chosen, count, retail, total, saving, courier, freeCourierLeft: courierLeft } = cartSummary(rows, state.cart, unselected, state.card);
  const allChosen = available.length > 0 && chosen.length === available.length;

  const tick = (id: string, on: boolean) => setUnselected(u => on ? u.filter(x => x !== id) : [...new Set([...u, id])]);
  const tickAll = (on: boolean) => setUnselected(u => on ? u.filter(id => !available.some(p => p.id === id)) : [...new Set([...u, ...available.map(p => p.id)])]);
  const remove = (ids: string[]) => {
    if (!ids.length) return;
    const items = Object.fromEntries(ids.map(id => [id, state.cart[id]]));
    setState(s => { const cart = { ...s.cart }; for (const id of ids) delete cart[id]; return { ...s, cart }; });
    const one = ids.length === 1 ? data.products.find(p => p.id === ids[0]) : null;
    setRemoved({ items, label: one ? `«${shortName(one.name)}» удалён из корзины` : `Удалено: ${pieces(ids.length)}` });
  };
  const undo = () => { if (!removed) return; setState(s => ({ ...s, cart: { ...s.cart, ...removed.items } })); setRemoved(null); };

  const heading = <Heading title="Корзина" description="Отметьте продукты для заказа и проверьте количество." />;
  if (!ready) return <>{heading}<div className="account-route-loading" aria-busy="true" aria-label="Загрузка" /></>;
  if (!rows.length) return <>{heading}<p className="cart-empty empty-screen" data-ds-id="cart-empty">Ваша корзина пока пуста</p>{removed && <UndoBar removed={removed} onUndo={undo} />}</>;

  return <>{heading}
    <div className="cart-layout cart-layout--market">
      <div className="cart-lists">
        {available.length > 0 && <div className="panel cart-items" data-ds-id="cart-items">
          <div className="cart-toolbar">
            <label className="cart-check"><input type="checkbox" checked={allChosen} ref={el => { if (el) el.indeterminate = chosen.length > 0 && !allChosen; }} onChange={e => tickAll(e.target.checked)} /><span>Выбрать все</span></label>
            <button type="button" className="text-button cart-remove-chosen" disabled={!chosen.length} onClick={() => remove(chosen.map(p => p.id))}>Удалить выбранные</button>
          </div>
          {available.map(p => <CartRow key={p.id} product={p} quantity={state.cart[p.id]} card={state.card} chosen={!unselected.includes(p.id)} favorite={state.favorites.includes(p.id)}
            onTick={on => tick(p.id, on)} onQty={q => qty(p.id, q)} onFavorite={() => favorite(p.id)} onRemove={() => remove([p.id])} />)}
        </div>}
        {missing.length > 0 && <div className="panel cart-items cart-items--missing" data-ds-id="cart-missing">
          <div className="cart-toolbar"><h2>Нет в наличии · {missing.length}</h2><button type="button" className="text-button" onClick={() => remove(missing.map(p => p.id))}>Удалить все</button></div>
          <p className="cart-missing-note">Эти продукты закончились и в заказ не войдут. Можно оставить их здесь или перенести в избранное.</p>
          {missing.map(p => <CartRow key={p.id} product={p} quantity={state.cart[p.id]} card={state.card} missing favorite={state.favorites.includes(p.id)}
            onQty={() => {}} onFavorite={() => favorite(p.id)} onRemove={() => remove([p.id])} />)}
        </div>}
      </div>

      <aside ref={summary} className="panel order-summary" data-ds-id="cart-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Ваш заказ</h2>
        <div><span>Товары, {count} шт.</span><strong>{money(retail)}</strong></div>
        {state.card && saving > 0 && <div className="cart-discount"><span>Скидка по карте</span><strong>−{money(saving)}</strong></div>}
        {state.signedIn && state.account?.partnerId && <LoyaltyStatus />}
        {chosen.some(p => p.prices.source === 'price-list') && <CardOffer />}
        <div className="cart-delivery">
          <span>Доставка</span>
          <ul>
            <li><span>Самовывоз, Санкт-Петербург</span><strong>бесплатно</strong></li>
            <li><span>Курьер по Санкт-Петербургу в пределах КАД</span><strong>{courier ? money(courier) : 'бесплатно'}</strong></li>
            <li><span>CDEK по России и за КАД</span><strong>по тарифу</strong></li>
          </ul>
          {count > 0 && courierLeft > 0 && <p className="cart-free-left">До бесплатной доставки курьером осталось {money(courierLeft)}<span className="cart-free-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, total / FREE_COURIER_FROM * 100)}%` }} /></span></p>}
          <a href="/delivery/">Условия доставки</a>
        </div>
        <hr />
        <div className="total"><span>Итого</span><strong>{money(total)}</strong></div>
        {state.card && saving > 0 && <p className="cart-saving">Вы экономите {money(saving)}</p>}
        {/* The next step is the checkout page (owner, 2026-11-17; research: one dominant action, the marketplaces' «Перейти к оформлению»). */}
        {count ? <a className="btn btn--primary cart-checkout" href="/checkout/">Перейти к оформлению <Icon name="chevron" size={18} /></a> : <button type="button" className="btn btn--primary" disabled>Выберите товары</button>}
        <p className="fine-print">Способ получения и оплату выберете на следующем шаге.</p>
        <a href="/contacts/">Связаться для покупки <Icon name="chevron" size={18} /></a>
      </aside>
    </div>
    {!summaryVisible && count > 0 && <div className="cart-bar" data-ds-id="cart-bar"><div><span>{pieces(count)}</span><strong>{money(total)}</strong></div><a className="btn btn--primary" href="/checkout/">Оформить</a></div>}
    {removed && <UndoBar removed={removed} onUndo={undo} />}
  </>;
}

function CartRow({ product: p, quantity, card, chosen = false, missing = false, favorite, onTick, onQty, onFavorite, onRemove }: { product: Product; quantity: number; card: boolean; chosen?: boolean; missing?: boolean; favorite: boolean; onTick?: (on: boolean) => void; onQty: (q: number) => void; onFavorite: () => void; onRemove: () => void }) {
  const name = shortName(p.name);
  const unit = priceOf(p, card), line = unit * quantity;
  const cardPrice = p.prices.partner !== null && p.prices.partner < p.prices.retail;
  return <article className={`cart-item cart-item--market${missing ? ' is-missing' : ''}${!missing && !chosen ? ' is-unchosen' : ''}`}>
    {missing ? <span className="cart-check cart-check--empty" aria-hidden="true" /> : <label className="cart-check"><input type="checkbox" checked={chosen} onChange={e => onTick?.(e.target.checked)} aria-label={`В заказ: ${name}`} /></label>}
    <a className={`cart-product-image${cartTubProducts.has(p.id) ? ' cart-product-image--tub' : ''}`} href={p.path}><ProductImage product={p} /></a>
    <div className="cart-product-copy">
      {p.card?.kicker && <span className="cart-kicker">{p.card.kicker}</span>}
      <a href={p.path}><h2>{name}</h2></a>
      {missing && <p className="cart-missing">Нет в наличии</p>}
      <div className="cart-row-actions">
        <button type="button" className={`cart-icon-button cart-favorite${favorite ? ' selected' : ''}`} aria-pressed={favorite} aria-label={`${favorite ? 'Убрать из' : 'Добавить в'} избранное: ${name}`} title={favorite ? 'В избранном' : 'В избранное'} onClick={onFavorite}><Icon name="heart" size={18} /></button>
        <button type="button" className="cart-icon-button" aria-label={`Удалить из корзины: ${name}`} title="Удалить" onClick={onRemove}><Icon name="trash" size={18} /></button>
      </div>
    </div>
    {!missing && <div className="quantity">
      <button type="button" disabled={quantity <= 1} onClick={() => onQty(quantity - 1)} aria-label={`Уменьшить: ${name}`}><Icon name="minus" size={16} /></button>
      <output aria-live="polite" aria-label={`Количество: ${name}`}>{quantity}</output>
      <button type="button" disabled={quantity >= 99} onClick={() => onQty(quantity + 1)} aria-label={`Увеличить: ${name}`}><Icon name="plus" size={16} /></button>
    </div>}
    <div className="cart-line-total">
      <strong>{money(line)}</strong>
      {card && cardPrice && <s className="cart-line-was">{money(p.prices.retail * quantity)}</s>}
    </div>
  </article>;
}

function UndoBar({ removed, onUndo }: { removed: Removed; onUndo: () => void }) {
  return <div className="cart-undo" role="status"><span>{removed.label}</span><button type="button" onClick={onUndo}>Вернуть</button></div>;
}
