import {productImage} from './product-media.mjs';
export {productImage} from './product-media.mjs';
import type { Product } from './content-types';
// HP Fighter's imported facts repeated 5-HTP. Corrected from https://www.nsp.com.ru/catalog/body/917.
import factCorrections from '../catalog/source/product-fact-corrections.json';

// Presentation-only copies: imported source media and product records remain intact.
export function withProductImages(product: Product): Product {
  return {...product, properties:{...product.properties,...(factCorrections as Record<string,Record<string,string>>)[product.id],...product.adminProperties}, image: product.image ? productImage(product.image) : product.image,
    images: product.images.map(productImage)};
}
