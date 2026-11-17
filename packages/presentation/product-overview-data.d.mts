import type {Product} from './content-types';
export function compositionSummary(product:Product):string;
export function releaseForm(product:Product):string;
export function overviewFacts(product:Product,packageInfo?:string):[string,string][];
