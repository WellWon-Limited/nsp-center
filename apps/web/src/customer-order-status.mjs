export const orderSteps=['new','processing','shipped','completed'];
export const orderStepsFor=method=>method==='pickup'?orderSteps.filter(step=>step!=='shipped'):orderSteps;
export {orderStatusLabels} from '../../../packages/domain/order-status.mjs';
export const activeOrder=order=>orderSteps.slice(0,-1).includes(order.status);
export function completedPurchases(orders){return orders.filter(o=>o.status==='completed').map(o=>({date:new Date(o.updatedAt||o.createdAt).toLocaleDateString('ru-RU'),products:Object.fromEntries(o.items.map(p=>[p.id,p.quantity]))}));}
