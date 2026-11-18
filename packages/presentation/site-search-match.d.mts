export type SearchEntry={title:string;path:string;kind:string;keywords?:string};
export function searchSite(entries:SearchEntry[],query:string,limit?:number):SearchEntry[];
