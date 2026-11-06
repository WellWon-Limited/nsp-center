import overrides from './product-image-overrides.json';
import type { Product } from './content-types';

// Presentation-only copies: imported source media and product records remain intact.
export function productImage(src: string): string {
  return (overrides as Record<string, string>)[src] ?? src;
}
export function withProductImages(product: Product): Product {
  return {...product, image: product.image ? productImage(product.image) : product.image,
    images: product.images.map(productImage)};
}
