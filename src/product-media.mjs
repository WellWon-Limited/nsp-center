import {webpUrl} from '../packages/domain/webp.mjs';
import gallery from './product-gallery.json' with {type:'json'};
import images from './product-images.json' with {type:'json'};
import layouts from './product-image-layout.json' with {type:'json'};
import legacy from './product-image-overrides.json' with {type:'json'};
import masks from './product-packshot-masks.json' with {type:'json'};
const webpOverrides=Object.fromEntries(Object.entries(legacy).map(([path,replacement])=>[webpUrl(path),replacement]));
export const productImage=src=>legacy[src]||webpOverrides[src]||src;
// Display replacements are separate from the imported catalog and original gallery files.
// An administrator's photo (src/site.ts) comes first.
const rawCover=product=>product.adminImage!==undefined?product.adminImage:(images[product.id]?.image||(product.image?productImage(product.image):undefined));
export const productCover=product=>webpUrl(rawCover(product));
export function productGalleryImages(product){const cover=productCover(product);if(product.adminPhotos!==undefined)return product.adminPhotos.map(webpUrl);if(product.adminImage)return [webpUrl(product.adminImage)];return [...new Set([...(cover?[cover]:[]),...(gallery[product.id]?.images?.slice(1).map(x=>webpUrl(x.image))||[])])];}

export function productPackshotStyle(product){
 const m=layouts[product.id];if(!images[product.id]||!m||webpUrl(m.image)!==productCover(product))return undefined;
 const left=Math.max(0,m.left-m.width*.035),top=Math.max(0,m.top-m.height*.035);
 const width=Math.min(1,m.left+m.width*1.035)-left,height=Math.min(1,m.top+m.height*1.035)-top;
 const imageRatio=m.ratio*m.height/m.width,ratio=width/height*imageRatio;
 return {'--packshot-mask':masks[m.image]?`url("${masks[m.image]}")`:'none','--packshot-ratio':String(ratio),'--packshot-left':`${-left/width*100}%`,'--packshot-top':`${-top/height*100}%`,'--packshot-width':`${100/width}%`,'--packshot-height':`${100/height}%`};
}

/** Package quantity only; batch expiry dates are shown with full product information. */
export function productPackageLabel(product){
 return String(product.adminProperties?.['Объём']??product.adminPackage??gallery[product.id]?.package??product.properties?.['Объём']??'')
  .split(/(?:[,;·|]\s*)?(?:годен|годна|годны|годность|срок\s+годности|best\s+before|expiry)/iu)[0]
  .replace(/\s+по\s+.*$/iu,'').replace(/[\s,;·|:—–-]+$/u,'').trim();
}

/** Compact, factual package information shared by every catalog card. */
export function productPackagePresentation(product){
 const quantity=productPackageLabel(product);
 const raw=String(product.properties?.['Форма выпуска']||'');
 const form=/^порош/i.test(raw)?'Порошок':raw;
 const stem=form.toLowerCase().slice(0,5);
 return [quantity,form&&(!stem||!quantity.toLowerCase().includes(stem))?form:''].filter(Boolean).join(' · ');
}
