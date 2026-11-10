import './purchases.css';
import { useState } from 'react';
import { data, shortName, useStore } from './store';
import { Heading, Icon, ProductCard } from './ui';
import { orderDate, purchased } from './purchased-ids.mjs';

// "Мои покупки", like "Покупки" on Wildberries: what the visitor has already ordered as catalog cards (price, heart,
// "В корзину") with the date of the latest order (and "(2)" when ordered twice), the catalog's search field, newest first.
export function Purchases() {
  const { state, ready } = useStore();
  const [q, setQ] = useState('');
  const byId = new Map(data.products.map(p => [p.id, p]));
  const all = purchased(state.orders, new Set(byId.keys())).map(x => ({ ...x, product: byId.get(x.id)! }));
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter(({ product: p }) => `${p.name} ${p.article} ${p.card?.kicker ?? ''} ${p.properties['Назначение'] ?? ''}`.toLowerCase().includes(needle)) : all;
  return <>
    <Heading title="Мои покупки" description="Товары из ваших заказов. Добавьте нужные в корзину снова." />
    {!ready ? <div className="account-route-loading" aria-busy="true" aria-label="Загрузка" />
      : !all.length ? <section className="purchases-empty" data-ds-id="purchases-empty"><p>Покупок ещё не было</p></section>
      : <>
        <div className="purchases-search" data-ds-id="purchases-search">
          <label className="search-field"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти в покупках: название, артикул" aria-label="Поиск по покупкам" />{q && <button className="icon-btn icon-btn--sm" onClick={() => setQ('')} aria-label="Очистить поиск"><Icon name="close" size={16} /></button>}</label>
        </div>
        {shown.length ? <div className="product-grid purchases-grid">{shown.map(({ id, date, times, product }) => <div className="purchase-item" key={id} data-ds-id="purchase-item">
          <p className="purchase-date" aria-label={`${shortName(product.name)}: последний заказ ${orderDate(date)}${times > 1 ? `, всего заказов: ${times}` : ''}`}><Icon name="bag" size={15} />Заказ от {orderDate(date)}{times > 1 && <span>({times})</span>}</p>
          <ProductCard product={product} />
        </div>)}</div>
          : <p className="cart-empty">В покупках нет «{q.trim()}». <button type="button" className="text-button" onClick={() => setQ('')}>Показать все</button></p>}
      </>}
  </>;
}
