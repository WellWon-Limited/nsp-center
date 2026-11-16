import type {Product} from './content-types';
export function productCover(product:Pick<Product,'id'|'image'|'adminImage'>):string|undefined;
export function productGalleryImages(product:Pick<Product,'id'|'image'|'images'|'adminImage'|'adminPhotos'>):string[];

export function productImage(src:string):string;

export function productPackshotStyle(product:Pick<Product,'id'|'image'|'adminImage'>):Record<string,string>|undefined;

export function productPackageLabel(product:Pick<Product,'id'|'properties'|'adminProperties'|'adminPackage'>):string;

export function productPackagePresentation(product: import("./content-types").Product): string;
