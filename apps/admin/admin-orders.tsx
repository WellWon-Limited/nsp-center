import {nextOrderStatuses} from '../../packages/domain/order-status.mjs';
import { useEffect, useState, type FormEvent } from 'react';
import { money, useStore } from '../../packages/presentation/store';

const statuses = [['new', 'Новые'], ['processing', 'В обработке'], ['shipped', 'Отправлены'], ['completed', 'Выполнены'], ['cancelled', 'Отменены']] as const;
type Status = typeof statuses[number][0];
const orderStatusLabels: Record<Status, string> = {new: 'Новый', processing: 'В обработке', shipped: 'Отправлен', completed: 'Выполнен', cancelled: 'Отменён'};
type Order = { id: string; customer: { name: string; email: string; phone: string; comment?:string }; paymentStatus?:string; delivery?:{method:string;pickupAddress?:string;city?:string;street?:string;house?:string;flat?:string;point?:string;day?:string;window?:string;priceStatus?:string}; deliveryPrice?:number|null; history?:{type:string;from:string|null;to:string;actorRole:string;at:string;reason?:string;correction?:boolean}[]; items: { name: string; quantity: number; price: number }[]; total: number; status: Status; note: string; createdAt: string; updatedAt: string };
type Orders = { orders: Order[]; summary: Record<Status, number>; total: number; page: number; pageSize: number };
const date = (v: string) => new Date(v).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function OrdersSection() {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, refresh] = useState(0);
  const [data, setData] = useState<Orders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ status, q: search, page: String(page) });
    fetch(`/api/admin/orders?${params}`, { signal: abort.signal, headers: { Accept: 'application/json' } }).then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Не удалось загрузить заказы.');
      if (!abort.signal.aborted) setData(body);
    }).catch(e => { if (!abort.signal.aborted) setError(e.message || 'Нет связи с сервером.'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [status, search, page, revision]);
  const choose = (value: string) => { setStatus(value); setPage(1); };
  const all = data ? Object.values(data.summary).reduce((a, b) => a + b, 0) : 0;
  return <section className="admin-card admin-orders" data-ds-id="admin-orders" aria-busy={loading}>
    <div className="admin-orders-heading"><h2>Обработка заказов</h2><button className="btn btn--secondary" type="button" disabled={loading} onClick={() => refresh(n => n + 1)}>Обновить</button></div>
    <div className="admin-order-stats"><button type="button" className={status === 'all' ? 'active' : ''} aria-pressed={status === 'all'} onClick={() => choose('all')}><span>Всего заказов</span><strong>{data ? all : '—'}</strong></button>{statuses.map(([id, label]) => <button type="button" key={id} data-order-status={id} className={status === id ? 'active' : ''} aria-pressed={status === id} onClick={() => choose(id)}><span>{label}</span><strong>{data ? data.summary[id] : '—'}</strong></button>)}</div>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(1); }}><input className="field" type="search" aria-label="Номер заказа, имя, телефон или почта" placeholder="Номер, имя, телефон или почта" value={query} onChange={e => setQuery(e.target.value)} /><button className="btn btn--primary">Найти</button></form>
    {error ? <div role="alert"><p className="admin-error">{error}</p><button type="button" className="btn btn--secondary" onClick={() => refresh(n => n + 1)}>Повторить</button></div> : loading ? <p role="status" className="ds-muted">Загружаем заказы…</p> : data && <>
      {!data.orders.length ? <p className="admin-orders-empty">{all ? 'По вашему запросу заказов нет.' : 'Заказов пока нет.'}</p> : <div className="admin-order-list">{data.orders.map(o => <OrderCard key={`${o.id}:${o.updatedAt}`} order={o} saved={() => refresh(n => n + 1)} />)}</div>}
      {data.total > data.pageSize && <nav className="admin-orders-pagination" aria-label="Страницы заказов"><button className="btn btn--secondary" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Назад</button><span>{page} / {Math.ceil(data.total / data.pageSize)}</span><button className="btn btn--secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(n => n + 1)}>Далее</button></nav>}
    </>}
  </section>;
}
function OrderCard({ order: o, saved }: { order: Order; saved: () => void }) {
  const { notify } = useStore();
  const [status, setStatus] = useState(o.status);
  const [note, setNote] = useState(o.note);
  const [busy, setBusy] = useState(false);
  const [correction,setCorrection] = useState(false);
  const [reason,setReason] = useState('');
  const reasonRequired = correction || status === 'cancelled' && status !== o.status;
  const allowed = new Set([o.status,...nextOrderStatuses(o.status,o.delivery?.method)]);
  const [error, setError] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status, note, reason, correction, updatedAt: o.updatedAt }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Не удалось сохранить заказ.');
      notify('Заказ обновлён'); saved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Нет связи с сервером.'); } finally { setBusy(false); }
  };
  return <details className="admin-order"><summary><span><strong>Заказ №{o.id}</strong><small>{date(o.createdAt)} · {o.customer.name}</small></span><span><strong>{money(o.total)}</strong><small className="admin-order-status" data-order-status={o.status}>{orderStatusLabels[o.status]}</small></span></summary>
    <div className="admin-order-body"><div className="admin-order-contact"><strong>{o.customer.name}</strong><span>{o.customer.phone || 'Телефон не указан'}</span><span>{o.customer.email}</span></div><ul className="admin-order-items">{o.items.map((item, i) => <li key={i}><span>{item.name}<small>{item.quantity} шт. × {money(item.price)}</small></span><strong>{money(item.quantity * item.price)}</strong></li>)}</ul>
      {o.paymentStatus==='not_connected'&&<p>Не оплачен · онлайн-оплата не подключена</p>}
      {o.delivery?.method&&<p><strong>Получение: </strong>{o.delivery.method==='pickup'?'Самовывоз':o.delivery.method==='courier'?'Курьер':'СДЭК'} · {[o.delivery.pickupAddress,o.delivery.city,o.delivery.street,o.delivery.house,o.delivery.flat,o.delivery.point,o.delivery.day,o.delivery.window].filter(Boolean).join(', ')}<br/>Доставка: {o.delivery.priceStatus==='requires_quote'?'требует расчёта':money(o.deliveryPrice??0)}</p>}
      {o.customer.comment&&<p><strong>Комментарий покупателя: </strong>{o.customer.comment}</p>}
      {!!o.history?.length&&<div><h3>История заказа</h3><ol>{o.history.map((event,i)=><li key={i}>{date(event.at)} — {event.type==='created'?'Заказ оформлен':event.type==='note_changed'?'Изменён комментарий сотрудника':`Статус: ${orderStatusLabels[event.from as Status]??event.from} → ${orderStatusLabels[event.to as Status]??event.to}`} ({event.actorRole==='admin'?'сотрудник':event.actorRole==='guest'?'гость':'покупатель'}){event.correction?' · Исправление':''}{event.reason?` · Причина: ${event.reason}`:''}</li>)}</ol></div>}
      <form className="admin-content" onSubmit={save}><label><input type="checkbox" checked={correction} onChange={e=>{setCorrection(e.target.checked);setStatus(o.status);setReason('');}}/> Исправить ошибочно установленный статус</label><label>Статус заказа<select className="field" value={status} onChange={e => setStatus(e.target.value as Status)}>{statuses.filter(([id])=>correction||allowed.has(id)).map(([id]) => <option value={id} key={id}>{orderStatusLabels[id]}</option>)}</select></label>{reasonRequired&&<label>{correction?'Причина исправления':'Причина отмены'}<textarea className="field" rows={2} value={reason} maxLength={1000} minLength={5} required onChange={e=>setReason(e.target.value)} placeholder="Объясните, почему меняете статус"/></label>}<label>Комментарий для администратора<textarea className="field" rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="btn btn--primary" disabled={busy || reasonRequired && reason.trim().length<5 || status === o.status && note === o.note}>{busy ? 'Сохраняем…' : 'Сохранить изменения'}</button></form>
    </div></details>;
}
