import {productImage} from './product-media.mjs';
export {productImage} from './product-media.mjs';
import type { Product } from './content-types';

// Presentation-only copies: imported source media and product records remain intact.
export function withProductImages(product: Product): Product {
  return {...product, image: product.image ? productImage(product.image) : product.image,
    images: product.images.map(productImage)};
}
