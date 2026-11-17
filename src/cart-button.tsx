import type {Product} from './content-types';
import {useStore} from './store';
import {ProductCardCartButton} from './ui';
import './cart-button.css';
/** All product actions share the catalog cart quantity and its notifications. */
export function CartButton({product,buyNow=false}:{product:Product;buyNow?:boolean}){
 const {state}=useStore();
 const quantity=state.cart[product.id]||1;
 return <>
  <div className="cart-action-control"><ProductCardCartButton product={product}/></div>
  {/* «Купить сейчас»: the checkout page with this product alone (owner, 2026-11-17), the cart stays as it is. */}
  {buyNow&&<a className="btn product-buy-now" href={`/checkout/?buy=${encodeURIComponent(product.id)}&qty=${quantity}`}>Купить сейчас</a>}
 </>;
}
