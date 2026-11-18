import '../../packages/presentation/styles';
import '../../apps/web/src/order-confirmation.css';
import '../../apps/web/src/catalog-design-variants.css';
import './payment.css';
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SiteBackdrop,Icon,Heading} from '../../packages/presentation/ui';
import {StoreProvider} from '../../packages/presentation/store';

// Isolated review screens: no payment or account requests and no production route.
const states={
 pending:{title:'Проверяем оплату',intro:'Заказ сохранён. Ожидаем подтверждение платёжного сервиса.',label:'Ожидает подтверждения',icon:'clock',amount:'Сумма заказа',next:'Не оплачивайте заказ повторно',text:'Подтверждение может прийти чуть позже. Вы можете вернуться к заказу и проверить результат.',action:'Проверить статус'},
 delayed:{title:'Подтверждение задерживается',intro:'Пока не удалось получить окончательный результат оплаты.',label:'Результат уточняется',icon:'clock',amount:'Сумма заказа',next:'Если деньги списались',text:'Не повторяйте оплату. Проверьте статус позже или свяжитесь с нами — мы сверим платёж по номеру заказа.',action:'Проверить статус'},
 failed:{title:'Не удалось оплатить заказ',intro:'Платёж не завершён. Ваш заказ сохранён.',label:'Не оплачен',icon:'close',amount:'К оплате',next:'Можно попробовать ещё раз',text:'Повторите оплату или выберите другой способ на странице оплаты. Новый заказ оформлять не нужно. Если в банке видно списание, сначала свяжитесь с нами.',action:'Повторить оплату'},
} as const;
type State=keyof typeof states;
const key=new URLSearchParams(location.search).get('state') as State;
const state:State=key in states?key:'pending';
const copy=states[state];
const w=window as typeof window & {__paymentHeader:string};
function PaymentPreview(){
 const [notice,setNotice]=useState('');

 return <StoreProvider><SiteBackdrop/><div dangerouslySetInnerHTML={{__html:w.__paymentHeader}}/><main className="site-main"><section className="order-confirmation order-confirmation--1 payment-review"><Heading eyebrow="NSP Center" title={copy.title} description={copy.intro}/><section className="panel order-confirmation-summary payment-result" aria-label="Результат операции">
 <div className="order-confirmation-title"><span className={`order-confirmation-check payment-mark payment-mark--${state}`}><Icon name={copy.icon} size={24}/></span><div><h2>Заказ № 647204</h2><p>{copy.label}</p></div></div>
 <div className="order-confirmation-details payment-details"><div className="order-confirmation-items"><h3>Ваш заказ</h3><ul><li><span>Хлорофилл жидкий<small>1 шт.</small></span><strong>3 849 ₽</strong></li><li><span>Омега 3 ПНЖК<small>1 шт.</small></span><strong>4 900 ₽</strong></li><li><span>Самовывоз<small>Санкт-Петербург</small></span><strong>Бесплатно</strong></li></ul><div className="order-confirmation-total"><span>{copy.amount}</span><strong>8 749 ₽</strong></div></div>
 <div className="order-confirmation-receiving"><h3>{copy.next}</h3><p>{copy.text}</p><p className="payment-order-help">Для обращения достаточно номера заказа: <strong>647204</strong>.</p></div></div>
 <div className="order-confirmation-actions"><button className="btn btn--primary" onClick={()=>setNotice(state==='failed'?'В рабочей версии здесь откроется PayKeeper для повторной оплаты этого заказа. Сейчас это макет.':state==='pending'||state==='delayed'?'Демонстрация: статус не запрашивается у платёжного сервиса.':'Демонстрация: карточка настоящего заказа здесь не открывается.')}>{copy.action}<Icon name={state==='pending'||state==='delayed'?'clock':'chevron'} size={18}/></button><button className="text-link" onClick={()=>setNotice('В рабочей версии здесь откроется обращение по заказу № 647204. Сейчас это макет.')}>Вопрос по заказу <Icon name="chevron" size={16}/></button></div><p className="payment-feedback" role="status" aria-live="polite">{notice}</p>
 </section><p className="payment-review-note">Макет для согласования · данные вымышлены · платежи не выполняются</p></section></main></StoreProvider>
}
document.title=copy.title+' — NSP Center';
createRoot(document.getElementById('root')!).render(<PaymentPreview/>);
