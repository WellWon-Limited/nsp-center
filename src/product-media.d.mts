import type {Product} from './content-types';
export function productCover(product:Pick<Product,'id'|'image'>):string|undefined;
export function productGalleryImages(product:Pick<Product,'id'|'image'|'images'>):string[];

export function productImage(src:string):string;

export function productPackshotStyle(product:Pick<Product,'id'|'image'>):Record<string,string>|undefined;
