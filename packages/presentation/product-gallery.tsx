import {productGalleryImages,productPackageLabel} from './product-media.mjs';
import {useState} from 'react';
import type {Product} from './content-types';
import {ProductImage,ProductBadges,Icon} from './ui';
import {useStore} from './store';

export const packageInfo=(product:Product)=>productPackageLabel(product);

/** The catalogue and product page share the same clean packshot, crop and silhouette. */
export function ProductGallery({product:p}:{product:Product}){
 const {state,favorite}=useStore(),[current,setCurrent]=useState(0);
 const images=productGalleryImages(p),index=Math.min(current,Math.max(0,images.length-1));
 const selected=index===0?p:{...p,adminImage:images[index]};
 return <div className="product-gallery panel"><div className="main-product-image product-gallery--canonical" data-ds-id="product-gallery"><ProductBadges product={p} stockMarker={false}/>
  <div className="product-gallery-packshot"><ProductImage product={selected} detail/></div>
  <button className={`icon-btn favorite ${state.favorites.includes(p.id)?'selected':''}`} type="button" aria-label={`${state.favorites.includes(p.id)?'Убрать из':'Добавить в'} избранное: ${p.name}`} aria-pressed={state.favorites.includes(p.id)} onClick={()=>favorite(p.id)}><Icon name="heart" size={20}/></button>
  {images.length>1&&<div className="product-gallery-thumbnails" role="group" aria-label="Фотографии товара">{images.map((src,i)=><button key={src} type="button" aria-label={i===0?'Главное фото':`Фото ${i+1}`} aria-pressed={index===i} onClick={()=>setCurrent(i)}><ProductImage product={i===0?p:{...p,adminImage:src}}/></button>)}</div>}
 </div></div>;
}
