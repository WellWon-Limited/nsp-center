import type { Category, Product } from './content-types';
export type NewProduct = { name: string; article: string; categoryPath: string; retailRub: number; partnerRub: number | null; availability: 'InStock' | 'OutOfStock' };
export function slugOf(name: string): string;
export function freeId(name: string, taken: Set<string>): string;
export function validateNewProduct(input: unknown, categories: Category[]): { value: NewProduct; error?: undefined } | { error: string; value?: undefined };
export function sectionsOf(categoryPath: string, categories: Category[]): Category[];
export function customProduct(id: string, data: NewProduct, categories: Category[], withPartner?: boolean): Product;
export function mergeCustom(products: Product[], categories: Category[], extras: Product[]): void;
