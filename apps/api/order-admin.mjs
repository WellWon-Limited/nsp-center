import { customerOrder } from './order-read.mjs';
import { orderChangeError, orderStatusLabels } from '../../packages/domain/order-status.mjs';
export { ORDER_SCHEMA } from './order-schema.mjs';
const statuses = new Set(Object.keys(orderStatusLabels));
const orderOf = r => ({...customerOrder(r),customer:r.customer,note:r.note,history:r.history??[]});
const historySql = `(select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'from',from_status,'to',to_status,'actorRole',actor_role,'actorId',actor_id::text,'reason',reason,'correction',correction,'at',created_at) order by created_at,id),'[]'::jsonb) from order_events where order_id=order_read.id)`;
// Called only after the shared administrator/session guard and same-origin check.
export async function orderAdminRoute({ pool, send, readJson }, req, res, path, url, user) {
  if (path !== '/api/admin/orders') return false;
  if (req.method === 'GET') {
    const status = url.searchParams.get('status') || 'all';
    const search = (url.searchParams.get('q') || '').trim().slice(0, 120);
    const page = Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1));
    if (status !== 'all' && !statuses.has(status) || !Number.isInteger(page)) { send(res, 400, { error: 'Проверьте фильтр заказов.' }); return true; }
    const match = `($1 = 'all' or status = $1) and ($2 = '' or position(lower($2) in lower(id::text || ' ' || customer::text)) > 0)`;
    const [{ rows: counts }, { rows: total }, { rows }] = await Promise.all([
      pool.query('select status, count(*)::int as count from shop_orders group by status'),
      pool.query(`select count(*)::int as count from shop_orders where ${match}`, [status, search]),
      pool.query(`select *, ${historySql} as history from order_read where ${match} order by created_at desc, id desc limit 25 offset $3`, [status, search, (page - 1) * 25]),
    ]);
    const summary = Object.fromEntries([...statuses].map(s => [s, 0]));
    for (const c of counts) summary[c.status] = c.count;
    send(res, 200, { orders: rows.map(orderOf), summary, total: total[0].count, page, pageSize: 25 }); return true;
  }
  if (req.method === 'PUT') {
    const body = await readJson(req);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!/^\d{1,18}$/.test(String(body?.id)) || !statuses.has(body?.status) || typeof body?.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)) || typeof body?.note !== 'string' || body.note.length > 2000 || reason.length > 1000 || (body?.correction !== undefined && typeof body.correction !== 'boolean')) {
      send(res, 400, { error: 'Проверьте статус, причину и комментарий заказа.' }); return true;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const {rows:[before]} = await client.query("select * from shop_orders where id=$1 and date_trunc('milliseconds',updated_at)=$2::timestamptz for update",[body.id,body.updatedAt]);
      if (!before) {await client.query('rollback');send(res,409,{error:'Заказ уже изменён или не найден. Обновите список.'});return true;}
      const error = orderChangeError(before.status,body.status,before.delivery.method,body.correction===true,reason);
      if(error){await client.query('rollback');send(res,400,{error});return true;}
      await client.query('select change_order($1,$2,$3,$4,$5,$6,$7)',
        [body.id,body.updatedAt,body.status,body.note,user.id,body.correction===true,reason]);
      const {rows:[order]}=await client.query(`select *, ${historySql} as history from order_read where id=$1`,[body.id]);
      await client.query('commit');
      send(res,200,{order:orderOf(order)});return true;
    } catch(error){await client.query('rollback');throw error;}
    finally{client.release();}
  }
  send(res, 405, { error: 'Этот способ работы с заказом недоступен.' }); return true;
}
