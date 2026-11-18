export const orderStatusLabels = {new:'Заказ оформлен',processing:'Собираем заказ',shipped:'Передан в доставку',completed:'Получен',cancelled:'Отменён'};
export const orderTransitions = {new:['processing','cancelled'],processing:['shipped','cancelled'],shipped:['completed'],completed:[],cancelled:[]};
export function nextOrderStatuses(status, method) {
  if (status === 'processing' && method === 'pickup') return ['completed','cancelled'];
  return orderTransitions[status] ?? [];
}
export function orderChangeError(from, to, method, correction, reason) {
  if (!(to in orderStatusLabels)) return 'Неизвестный статус заказа.';
  if (correction && (from === to || reason.trim().length < 5)) return 'Для исправления статуса укажите причину — не менее 5 знаков.';
  if (from === to) return null;
  if (to === 'cancelled' && reason.trim().length < 5) return 'Укажите причину отмены — не менее 5 знаков.';
  if (!correction && !nextOrderStatuses(from, method).includes(to)) return 'Такой переход недоступен. Для исправления ошибки включите исправление статуса и укажите причину.';
  return null;
}
