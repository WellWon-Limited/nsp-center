export const orderSteps:string[];
export const orderStatusLabels:Record<string,string>;
export function activeOrder(order:{status:string}):boolean;
export function completedPurchases(orders:{status:string;createdAt:string;updatedAt?:string;items:{id:string;quantity:number}[]}[]):{date:string;products:Record<string,number>}[];

export function orderStepsFor(method?:string):string[];
