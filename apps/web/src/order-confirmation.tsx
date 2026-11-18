import {orderStatusLabels,type OrderStatus} from '../../../packages/domain/order-status.mjs';
import {data} from '../../../packages/presentation/store';
import {Heading, Icon, ProductCard} from '../../../packages/presentation/ui';
import './order-confirmation.css';

export type ConfirmedOrder = {
  id: string;
  total: number;
  paid: boolean;
  status?:OrderStatus;
  subtotal?:number;
  discount?:number;
  deliveryPrice?:number|null;
  history?:{type:string;status:OrderStatus;at:string}[];
  items: {id: string; name: string; quantity: number; price: number}[];
  customer: {email: string};
  pickupAddress?: string;
  paymentStatus?: string;
  canViewOrders?: boolean;
  delivery?: {method:string;pickupAddress?:string;city?:string;street?:string;house?:string;flat?:string;point?:string;day?:string;window?:string;priceStatus?:string};
};

/** Render only with an order returned by the server; returning from a payment page is not proof of payment. */
export function OrderConfirmation({order,variant=1,detail=false}: {order: ConfirmedOrder;variant?:number;detail?:boolean}) {
  const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
  const savedOnly=order.paymentStatus==='not_connected';
  const delivery=order.delivery;
  const deliveryLabel=delivery?.method==='courier'?'Курьер':delivery?.method==='cdek'?'СДЭК':'Самовывоз';
  const address=delivery?.method==='courier'?[delivery.city,delivery.street,delivery.house,delivery.flat].filter(Boolean).join(', '):delivery?.method==='cdek'?[delivery.city,delivery.point].filter(Boolean).join(', '):delivery?.pickupAddress||order.pickupAddress||(delivery?'Адрес самовывоза уточняется':data.site.address);
  const bought=new Set(order.items.map(p=>p.id));
  const recommendations=data.products.filter(p=>!p.hidden&&p.availability!=='OutOfStock'&&!bought.has(p.id)).slice(0,4);
  return <section className={`order-confirmation order-confirmation--${variant}`}>
    <Heading eyebrow="NSP Center" title={detail?'Ваш заказ':order.paid?'Спасибо за заказ!':'Заказ оформлен'} description={order.paid?'Оплата прошла успешно. Заказ передан в обработку.':savedOnly?'Заказ сохранён. Онлайн-оплата пока не подключена, деньги не списывались.':'Статус оплаты уточняется. Проверьте его в личном кабинете.'}/>
    <div className="panel order-confirmation-summary">
      <div className="order-confirmation-title"><span className="order-confirmation-check"><Icon name="check" size={24}/></span><div><h2>Заказ № {order.id}</h2>{detail&&order.status&&<p>{orderStatusLabels[order.status]}</p>}<p>{order.paid?'Оплачен':savedOnly?'Не оплачен':'Ожидает подтверждения оплаты'}</p></div></div>
      <div className="order-confirmation-details"><div className="order-confirmation-items"><h3>Ваш заказ</h3><ul>{order.items.map(p=><li key={p.id}><span>{p.name}<small>{p.quantity} шт.</small></span><strong>{money(p.price*p.quantity)}</strong></li>)}</ul>{order.subtotal!==undefined&&<div className="order-amounts"><p><span>Товары до скидки</span><strong>{money(order.subtotal+(order.discount??0))}</strong></p>{!!order.discount&&<p><span>Скидка</span><strong>−{money(order.discount)}</strong></p>}<p><span>Доставка</span><strong>{order.deliveryPrice===null?'Требует расчёта':money(order.deliveryPrice??0)}</strong></p></div>}<div className="order-confirmation-total"><span>{order.paid?'Оплачено':delivery?.priceStatus==='requires_quote'?'Товары, без доставки':'Итого'}</span><strong>{money(order.total)}</strong></div></div><div className="order-confirmation-receiving"><h3>Получение</h3><p>{deliveryLabel}</p><p>{address}</p>{delivery?.day && <p>{delivery.day} · {delivery.window}</p>}<p className="ds-muted">{savedOnly ? delivery?.priceStatus==='requires_quote' ? 'Стоимость доставки СДЭК ещё не рассчитана.' : 'Оформление сохранено. Оплата и отправка уведомлений пока не подключены.' : 'Дождитесь подтверждения готовности заказа.'}</p></div></div>
      <div className="order-confirmation-actions">{order.canViewOrders!==false?<a className="btn btn--primary" href="/profile/orders/">Мои заказы</a>:<a className="btn btn--primary" href="/catalog/">В каталог</a>}<a className="text-link" href="/consultation/">Вопрос по заказу <Icon name="chevron" size={16}/></a></div>
    </div>
    {!!order.history?.length&&<section className="panel order-history"><h2>История заказа</h2><ol>{order.history.map((e,i)=><li key={i}><time dateTime={e.at}>{new Date(e.at).toLocaleString('ru-RU')}</time> — {orderStatusLabels[e.status]}</li>)}</ol></section>}
    {recommendations.length>0&&<section className="order-confirmation-recommendations"><div className="section-heading"><h2>Вам может понравиться</h2><a href="/catalog/">Весь каталог <Icon name="chevron" size={16}/></a></div><div className="product-grid">{recommendations.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
  </section>;
}
