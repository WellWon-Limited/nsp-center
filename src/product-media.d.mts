import type {Product} from './content-types';
export function productCover(product:Pick<Product,'id'|'image'|'adminImage'>):string|undefined;
export function productGalleryImages(product:Pick<Product,'id'|'image'|'images'|'adminImage'>):string[];

export function productImage(src:string):string;

export function productPackshotStyle(product:Pick<Product,'id'|'image'|'adminImage'>):Record<string,string>|undefined;
