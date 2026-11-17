import {useEffect,useRef} from 'react';
import type {Product} from '../../../packages/presentation/content-types';
import {money,priceOf,shortName,useStore} from '../../../packages/presentation/store';
import {Icon} from '../../../packages/presentation/ui';

export function QuickPurchase({product,quantity,onClose}:{product:Product;quantity:number;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),{state}=useStore(),unit=priceOf(product,state.card);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();return()=>{if(dialog.open)dialog.close()}},[]);
 return <dialog ref={ref} className="quick-purchase" aria-labelledby="quick-purchase-title" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}>
  <button className="quick-purchase-close" type="button" aria-label="Закрыть окно оплаты" onClick={onClose}><Icon name="close" size={20}/></button>
  <span className="quick-purchase-kicker">БЫСТРАЯ ПОКУПКА</span><h2 id="quick-purchase-title">Оплата заказа</h2>
  <div className="quick-purchase-product"><span>{shortName(product.name)}</span><strong>{money(unit)}</strong></div>
  <div className="quick-purchase-line"><span>Количество</span><strong>{quantity} шт.</strong></div>
  <fieldset><legend>Способ оплаты</legend><label><input type="radio" name="quick-payment" value="card" defaultChecked/>Банковской картой</label><label><input type="radio" name="quick-payment" value="sbp"/>СБП</label></fieldset>
  <div className="quick-purchase-line quick-purchase-total"><span>Итого</span><strong>{money(unit*quantity)}</strong></div>
  <button className="btn quick-purchase-pay" type="button" disabled>Оплатить {money(unit*quantity)}</button>
  <p className="fine-print">Это демонстрационное окно. Онлайн-оплата пока не подключена, деньги не списываются.</p>
 </dialog>;
}
