import gallery from './product-gallery.json' with {type:'json'};
import images from './product-images.json' with {type:'json'};
import layouts from './product-image-layout.json' with {type:'json'};
import legacy from './product-image-overrides.json' with {type:'json'};
import masks from './product-packshot-masks.json' with {type:'json'};
export const productImage=src=>legacy[src]||src;
// Display replacements are separate from the imported catalog and original gallery files.
// An administrator's photo (src/site.ts) comes first.
export const productCover=product=>product.adminImage!==undefined?product.adminImage:(images[product.id]?.image||(product.image?productImage(product.image):undefined));
export function productGalleryImages(product){const cover=productCover(product);if(product.adminPhotos!==undefined)return product.adminPhotos;if(product.adminImage)return [product.adminImage];return [...new Set([...(cover?[cover]:[]),...(gallery[product.id]?.images?.slice(1).map(x=>x.image)||[])])];}

export function productPackshotStyle(product){
 const m=layouts[product.id];if(!images[product.id]||!m||m.image!==productCover(product))return undefined;
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
