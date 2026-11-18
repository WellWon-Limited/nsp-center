export type OrderStatus = 'new'|'processing'|'shipped'|'completed'|'cancelled';
export const orderStatusLabels: Record<OrderStatus,string>;
export const orderTransitions: Record<OrderStatus,OrderStatus[]>;
export function nextOrderStatuses(status:string,method?:string):OrderStatus[];
export function orderChangeError(from:string,to:string,method:string|undefined,correction:boolean,reason:string):string|null;
