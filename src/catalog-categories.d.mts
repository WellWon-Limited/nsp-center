import type {Category,Product} from './content-types';
export type ManagedCategory={path:string;name:string;parent:string;archived:boolean;redirectTo:string};
export type CatalogConfig={revision:number;categories:ManagedCategory[];assignments:Record<string,string>};
export function readCatalogConfig(value:unknown):CatalogConfig|null;
export function initialCatalogConfig(categories:Category[]):CatalogConfig;
export function resolveCatalog(categories:Category[],products:Product[],config:unknown):{categories:Category[];products:Product[];config:CatalogConfig};
export function applyCatalogConfig(categories:Category[],products:Product[],config:unknown):void;
export function visibleCategories(categories:Category[],products:Product[]):Category[];
export function changeCatalogConfig(config:CatalogConfig,operation:Record<string,unknown>,products:Product[]):{value:CatalogConfig;error?:undefined}|{error:string;status?:number;value?:undefined};
