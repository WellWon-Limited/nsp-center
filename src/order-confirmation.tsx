import {data} from './store';
import {Heading, Icon, ProductCard} from './ui';
import './order-confirmation.css';

export type ConfirmedOrder = {
  id: string;
  total: number;
  paid: boolean;
  items: {id: string; name: string; quantity: number; price: number}[];
  customer: {email: string};
  pickupAddress?: string;
};

/** Render only with an order returned by the server; returning from a payment page is not proof of payment. */
export function OrderConfirmation({order,variant=1}: {order: ConfirmedOrder;variant?:number}) {
  const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
  const bought=new Set(order.items.map(p=>p.id));
  const recommendations=data.products.filter(p=>!p.hidden&&p.availability!=='OutOfStock'&&!bought.has(p.id)).slice(0,4);
  return <section className={`order-confirmation order-confirmation--${variant}`}>
    <Heading eyebrow="NSP Center" title={order.paid?'Спасибо за заказ!':'Заказ оформлен'} description={order.paid?'Оплата прошла успешно. Заказ передан в обработку.':'Статус оплаты уточняется. Проверьте его в личном кабинете.'}/>
    <div className="panel order-confirmation-summary">
      <div className="order-confirmation-title"><span className="order-confirmation-check"><Icon name="check" size={24}/></span><div><h2>Заказ № {order.id}</h2><p>{order.paid?'Оплачен':'Ожидает подтверждения оплаты'}</p></div></div>
      <div className="order-confirmation-details"><div className="order-confirmation-items"><h3>Ваш заказ</h3><ul>{order.items.map(p=><li key={p.id}><span>{p.name}<small>{p.quantity} шт.</small></span><strong>{money(p.price*p.quantity)}</strong></li>)}</ul><div className="order-confirmation-total"><span>{order.paid?'Оплачено':'Итого'}</span><strong>{money(order.total)}</strong></div></div><div className="order-confirmation-receiving"><h3>Получение</h3><p>Самовывоз</p><p>{order.pickupAddress||data.site.address}</p><p className="ds-muted">Дождитесь подтверждения готовности заказа.</p></div></div>
      <div className="order-confirmation-actions"><a className="btn btn--primary" href="/profile/orders/">Мои заказы</a><a className="text-link" href="/consultation/">Вопрос по заказу <Icon name="chevron" size={16}/></a></div>
    </div>
    {recommendations.length>0&&<section className="order-confirmation-recommendations"><div className="section-heading"><h2>Вам может понравиться</h2><a href="/catalog/">Весь каталог <Icon name="chevron" size={16}/></a></div><div className="product-grid">{recommendations.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
  </section>;
}
