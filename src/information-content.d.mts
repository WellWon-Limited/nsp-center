export function plainInfo(value:string):string;
export function cleanInfoHtml(html:string):string;
export function faqSections(html:string):{level:number;title:string;html:string}[];
export function reviewSections(html:string):{name:string;html:string}[];
export function videoSections(html:string):{id:string;title:string;href:string;poster:string}[];
export function contactSections(html:string):{bankHtml:string;hoursHtml:string;storeHref:string};
