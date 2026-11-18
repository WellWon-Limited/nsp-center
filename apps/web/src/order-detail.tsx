import {useEffect,useState} from 'react';
import {useStore} from '../../../packages/presentation/store';
import {Heading} from '../../../packages/presentation/ui';
import {OrderConfirmation,type ConfirmedOrder} from './order-confirmation';

/** The URL contains only an order number; a guest capability stays in the fragment, never in server logs. */
export function OrderDetail({url}:{url:string}) {
 const {state,sessionReady}=useStore();
 const id=new URL(url,'http://local').searchParams.get('id')??'';
 const [order,setOrder]=useState<ConfirmedOrder|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [revision,retry]=useState(0);
 const [copied,setCopied]=useState('');const [guest,setGuest]=useState(false);
 useEffect(()=>{const changed=()=>retry(n=>n+1);window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 useEffect(()=>{
  if(!sessionReady)return;
  const abort=new AbortController();setLoading(true);setOrder(null);setError('');
  const token=new URLSearchParams(window.location.hash.slice(1)).get('access')??'';
  setGuest(Boolean(token));
  const load=async()=>{
   try {
    if(!/^\d{1,18}$/.test(id))throw Error('Проверьте ссылку на заказ.');
    const response=await fetch(`/api/orders/${id}`,{cache:'no-store',headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},signal:abort.signal});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Не удалось загрузить заказ.');
    if(!abort.signal.aborted)setOrder(result.order);
   } catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Нет связи с сервером.');}
   finally{if(!abort.signal.aborted)setLoading(false);}
  };
  void load();return()=>abort.abort();
 },[id,sessionReady,state.signedIn,state.account?.email,revision]);
 if(loading)return <p role="status" className="account-route-loading">Загружаем заказ…</p>;
 if(error)return <section className="panel"><Heading title="Заказ недоступен"/><p role="alert">{error}</p><div className="order-confirmation-actions"><button type="button" className="btn btn--secondary" onClick={()=>retry(n=>n+1)}>Попробовать ещё раз</button><a className="btn btn--primary" href="/profile/">Войти в аккаунт</a></div></section>;
 return order&&<>
  {guest&&<section className="panel order-access"><p>Сохраните эту ссылку, чтобы вернуться к заказу. Она даёт доступ к заказу — передавайте её только тем, кому доверяете.</p><button className="btn btn--secondary" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied('Ссылка скопирована.');}catch{setCopied('Скопируйте ссылку из адресной строки.');}}}>Скопировать ссылку</button>{copied&&<p role="status">{copied}</p>}</section>}
  <OrderConfirmation order={order} detail/>
 </>;
}
