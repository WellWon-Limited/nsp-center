import { checkoutOrder, guestTokenHash, orderUrl } from './order-read.mjs';
import { createHash } from 'node:crypto';
import { customerEmailError, phoneError, formatPhone } from '../../packages/domain/contact-fields.mjs';
import { pricesUnder } from '../../packages/domain/product-prices.mjs';
import { COURIER_RUB, FREE_COURIER_FROM } from '../../packages/domain/delivery-prices.mjs';
import { deliveryDays } from '../../packages/domain/delivery-slots.mjs';

const fail = (error, status = 400) => Object.assign(new Error(error), { orderStatus: status });
const text = (v, max = 200) => typeof v === 'string' && v.length <= max ? v.trim() : '';

export function checkoutInput(body) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.key ?? '')) throw fail('Обновите страницу оформления заказа.');
  const f = body?.form;
  if (!f || !text(f.firstName, 100) || !text(f.lastName, 100) || typeof f.email !== 'string' || f.email.length > 254 || customerEmailError(f.email) || typeof f.phone !== 'string' || f.phone.length > 40 || phoneError(f.phone)) throw fail('Проверьте имя, фамилию, телефон и почту.');
  if (f.offer !== true || f.consent !== true) throw fail('Подтвердите условия заказа и согласие на обработку данных.');
  if (!['pickup', 'courier', 'cdek'].includes(f.method)) throw fail('Выберите способ получения.');
  const delivery = { method: f.method, city: text(f.city), street: text(f.street), house: text(f.house, 50), flat: text(f.flat, 50), day: text(f.day, 10), window: text(f.window, 10), point: text(f.cdekPoint, 500), code: text(f.cdekCode, 100) };
  if (f.method === 'courier' && (!delivery.city || !delivery.street || !delivery.house || !delivery.day || !delivery.window)) throw fail('Укажите адрес и время доставки.');
  if (f.method === 'cdek' && (!delivery.city || !delivery.point)) throw fail('Укажите город и пункт СДЭК.');
  if (typeof f.comment !== 'string' || f.comment.length > 500) throw fail('Комментарий — не больше 500 знаков.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) throw fail('Выберите от 1 до 100 наименований товаров.');
  const items = body.items.map(i => {
    if (!i || typeof i.id !== 'string' || !/^[\w-]{1,120}$/.test(i.id) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99) throw fail('Проверьте товары и их количество.');
    return { id: i.id, quantity: i.quantity };
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(items.map(i => i.id)).size !== items.length) throw fail('Товар повторяется в заказе.');
  if (!Number.isSafeInteger(body.expectedSubtotalKopecks) || body.expectedSubtotalKopecks < 0) throw fail('Обновите сумму заказа.');
  return { key: body.key.toLowerCase(), customer: { name: `${f.firstName.trim()} ${f.lastName.trim()}`, firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone: formatPhone(f.phone), email: f.email.trim().toLowerCase(), comment: f.comment.trim() }, delivery, consents: { offer: true, personalData: true, mailing: f.mailing === true, version: 'checkout-2026-11-18' }, items, expectedSubtotalKopecks: body.expectedSubtotalKopecks };
}

/** No provider calls here. The complete unpaid order and its history commit together. */
export async function saveCheckout({ pool, loadCatalog, buildRate, pickupAddress }, user, body) {
  const input = checkoutInput(body);
  const guestToken = user ? '' : body.guestToken;
  if (!user && !guestTokenHash(guestToken)) throw fail('Обновите страницу, чтобы создать защищённую ссылку на заказ.');
  if (!user) input.guestTokenHash = guestTokenHash(guestToken);
  const hash = createHash('sha256').update(JSON.stringify({ ...input, userId: user?.id ?? null })).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Serialize retries before checking catalog prices: a committed order is immutable even after a price change.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [input.key]);
    const { rows: [existing] } = await client.query('select * from order_read where checkout_key = $1', [input.key]);
    if (existing) {
      if (existing.request_hash !== hash) throw fail('Этот запрос уже использован для другого заказа. Обновите страницу.', 409);
      await client.query('commit');
      return { order: checkoutOrder(existing), orderUrl: orderUrl(existing.id,guestToken), repeated: true };
    }
    if (input.delivery.method === 'courier' && !deliveryDays().some(d => d.date === input.delivery.day && d.windows.some(w => w.id === input.delivery.window && w.free))) throw fail('Выбранное время доставки уже недоступно. Выберите другое.', 409);
    const { products, settings } = await loadCatalog(client);
    const items = input.items.map(i => {
      const p = products.find(p => p.id === i.id);
      if (!p || (settings.visibility?.[p.id] ?? p.hidden) || (settings.products?.[p.id]?.availability ?? p.availability) === 'OutOfStock') throw fail('Один из товаров больше недоступен. Обновите корзину.', 409);
      const prices = pricesUnder(p, p.prices, settings, buildRate);
      const price = user?.partner_id && prices.partner !== null ? prices.partner : prices.retail;
      if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(prices.retail) || prices.retail < price) throw fail('Не удалось проверить цену товара. Обратитесь в магазин.', 409);
      return { id: p.id, article: p.article ?? null, name: settings.cards?.[p.id]?.name ?? p.name ?? p.id, quantity: i.quantity, price, retailPrice: prices.retail };
    });
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    if (subtotal * 100 !== input.expectedSubtotalKopecks) throw fail('Цена заказа изменилась. Обновите страницу и проверьте новую сумму.', 409);
    const retail = items.reduce((n, i) => n + i.retailPrice * i.quantity, 0);
    // Browser-provided CDEK prices are not trusted. Until a server quote exists, shipping remains explicitly unknown.
    const deliveryRub = input.delivery.method === 'pickup' ? 0 : input.delivery.method === 'courier' ? (subtotal >= FREE_COURIER_FROM ? 0 : COURIER_RUB) : null;
    const total = subtotal + (deliveryRub ?? 0);
    if (!Number.isSafeInteger(total) || total > 100_000_000) throw fail('Сумма заказа слишком велика. Обратитесь в магазин.');
    if (input.delivery.method === 'pickup' && !pickupAddress?.trim()) throw fail('Адрес самовывоза не настроен. Обратитесь в магазин.', 503);
    const delivery = { ...input.delivery, ...(input.delivery.method === 'pickup' ? {pickupAddress:pickupAddress.trim()} : {}), priceStatus: deliveryRub === null ? 'requires_quote' : 'fixed' };
    const { rows: [order] } = await client.query(`insert into shop_orders
      (user_id, customer, checkout_key, request_hash, total_kopecks, subtotal_kopecks, discount_kopecks, delivery_kopecks, delivery, consents, guest_token_hash)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [user?.id ?? null, JSON.stringify(input.customer), input.key, hash, total * 100, subtotal * 100, (retail - subtotal) * 100, deliveryRub === null ? null : deliveryRub * 100, JSON.stringify(delivery), JSON.stringify(input.consents),user?null:guestTokenHash(guestToken)]);
    for (const i of items) await client.query(`insert into order_items(order_id,product_id,article,name,quantity,unit_price_kopecks,retail_price_kopecks,line_total_kopecks) values($1,$2,$3,$4,$5,$6,$7,$8)`, [order.id, i.id, i.article, i.name, i.quantity, i.price * 100, i.retailPrice * 100, i.price * i.quantity * 100]);
    await client.query("insert into order_events(order_id,event_type,to_status,actor_id,actor_role) values($1,'created','new',$2,$3)", [order.id, user?.id ?? null, user ? 'customer' : 'guest']);
    const {rows:[saved]}=await client.query('select * from order_read where id=$1',[order.id]);
    await client.query('commit');
    return { order: checkoutOrder(saved), orderUrl:orderUrl(order.id,guestToken), repeated: false };
  } catch (e) { await client.query('rollback'); throw e; }
  finally { client.release(); }
}
