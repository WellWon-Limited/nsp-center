import {QuickPurchase} from './quick-purchase';
import {useState} from 'react';
import type {Product} from './content-types';
import {useStore} from './store';
import {ProductCardCartButton} from './ui';
import './cart-button.css';
/** All product actions share the catalog cart quantity and its notifications. */
export function CartButton({product,buyNow=false}:{product:Product;buyNow?:boolean}){
 const {state}=useStore();
 const quantity=state.cart[product.id]||1;
 const [quickPurchase,setQuickPurchase]=useState(false);
 return <>
  <div className="cart-action-control"><ProductCardCartButton product={product}/></div>
  {buyNow&&<button type="button" className="btn product-buy-now" onClick={()=>setQuickPurchase(true)}>Купить сейчас</button>}
  {buyNow&&quickPurchase&&<QuickPurchase product={product} quantity={quantity} onClose={()=>setQuickPurchase(false)}/>}
 </>;
}
