import {useEffect,useState} from 'react';
import {AuthScreen} from './auth';
import {data,useStore} from '../../../packages/presentation/store';
import {Heading,Icon} from '../../../packages/presentation/ui';
import {productCover} from '../../../packages/presentation/product-media.mjs';
import {activeOrder,orderSteps,orderStatusLabels} from './customer-order-status.mjs';
import './customer-orders.css';
export type CustomerOrder={id:string;total:number;status:string;createdAt:string;updatedAt:string;items:{id:string;name:string;quantity:number;price:number}[]};
export function useCustomerOrders(){
 const {state,sessionReady}=useStore();const email=state.signedIn?state.account?.email:'';
 const [result,setResult]=useState<{email:string;orders:CustomerOrder[];error:string;loading:boolean}>({email:'',orders:[],error:'',loading:true});
 useEffect(()=>{if(!sessionReady)return;const abort=new AbortController();if(!email){setResult({email:'',orders:[],error:'',loading:false});return;}
 const load=async()=>{try{const r=await fetch('/api/account/orders',{headers:{Accept:'application/json'},cache:'no-store',signal:abort.signal});if(!r.ok)throw Error('Не удалось загрузить заказы. Попробуйте обновить страницу.');const b=await r.json();setResult({email,orders:b.orders,error:'',loading:false});}catch(e){if(!abort.signal.aborted)setResult({email,orders:[],error:(e as Error).message,loading:false});}};
 void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>{abort.abort();window.removeEventListener('focus',focus)};
 },[email,sessionReady]);
 return result.email===email?result:{email,orders:[],error:'',loading:true};
}
export function OrderList({orders,variant=1}:{orders:CustomerOrder[];variant?:number}){
 const shown=orders.filter(activeOrder);
 return <div className={`customer-order-list customer-order-list--${variant}`}>{shown.map(order=><article className="panel customer-order" key={order.id}>
  <header><div><h2>Заказ № {order.id}</h2><p>От {new Date(order.createdAt).toLocaleDateString('ru-RU')}</p></div><span className="pill pill--mint">{orderStatusLabels[order.status]}</span></header>
  <ol className="customer-order-steps" aria-label="Этапы заказа">{orderSteps.map((step,i)=><li key={step} className={i<=orderSteps.indexOf(order.status)?'is-reached':''} aria-current={step===order.status?'step':undefined}><span>{i<orderSteps.indexOf(order.status)?<Icon name="check" size={14}/>:i+1}</span>{orderStatusLabels[step]}</li>)}</ol>
  <ul className="customer-order-items">{order.items.map(item=>{const p=data.products.find(p=>p.id===item.id);return <li key={item.id}>{p&&<a href={p.path}><img src={productCover(p)} alt="" width="64" height="64"/></a>}<div>{p?<a href={p.path}>{item.name}</a>:item.name}<p>{item.quantity} шт.</p></div><strong>{new Intl.NumberFormat('ru-RU').format(item.price*item.quantity)} ₽</strong></li>})}</ul>
  <footer><strong>Итого {new Intl.NumberFormat('ru-RU').format(order.total)} ₽</strong><a href="/consultation/" className="text-link">Вопрос по заказу <Icon name="chevron" size={16}/></a></footer>
 </article>)}</div>;
}
export function CustomerOrders(){const {state,ready,sessionReady}=useStore();const {orders,error,loading}=useCustomerOrders();if(!ready||!sessionReady)return <div className="account-route-loading" aria-busy="true"/>;if(!state.signedIn||!state.account)return <AuthScreen/>;return <section className="customer-orders-page"><Heading eyebrow="NSP Center" title="Мои заказы" description="Активные заказы и этапы их выполнения."/>{loading?<p role="status">Загружаем заказы…</p>:error?<p role="alert">{error}</p>:orders.some(activeOrder)?<OrderList orders={orders}/>:<section className="empty-screen"><p>Активных заказов пока нет</p></section>}</section>}
