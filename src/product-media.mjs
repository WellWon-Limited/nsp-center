import images from './product-images.json' with {type:'json'};
import layouts from './product-image-layout.json' with {type:'json'};
import legacy from './product-image-overrides.json' with {type:'json'};
export const productImage=src=>legacy[src]||src;
// Display replacements are separate from the imported catalog and original gallery files.
export const productCover=product=>images[product.id]?.image||(product.image?productImage(product.image):undefined);
export function productGalleryImages(product){const cover=productCover(product);return cover?[cover]:[];}

export function productPackshotStyle(product){
 const m=layouts[product.id];if(!images[product.id]||!m||m.image!==productCover(product))return undefined;
 const left=Math.max(0,m.left-m.width*.035),top=Math.max(0,m.top-m.height*.035);
 const width=Math.min(1,m.left+m.width*1.035)-left,height=Math.min(1,m.top+m.height*1.035)-top;
 const imageRatio=m.ratio*m.height/m.width,ratio=width/height*imageRatio;
 return {'--packshot-ratio':String(ratio),'--packshot-left':`${-left/width*100}%`,'--packshot-top':`${-top/height*100}%`,'--packshot-width':`${100/width}%`,'--packshot-height':`${100/height}%`};
}
