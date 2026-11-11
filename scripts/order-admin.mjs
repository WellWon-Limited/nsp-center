// Orders are kept independently from account drafts. Only submitted orders count here.
export const ORDER_SCHEMA = `
create table if not exists shop_orders (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  customer jsonb not null,
  items jsonb not null,
  total integer not null check (total >= 0),
  status text not null default 'new' check (status in ('new','processing','shipped','completed','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_status_date on shop_orders(status, created_at desc);`;
const statuses = new Set(['new', 'processing', 'shipped', 'completed', 'cancelled']);
const orderOf = r => ({ id: String(r.id), customer: r.customer, items: r.items, total: r.total, status: r.status, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at });
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
      pool.query(`select * from shop_orders where ${match} order by created_at desc, id desc limit 25 offset $3`, [status, search, (page - 1) * 25]),
    ]);
    const summary = Object.fromEntries([...statuses].map(s => [s, 0]));
    for (const c of counts) summary[c.status] = c.count;
    send(res, 200, { orders: rows.map(orderOf), summary, total: total[0].count, page, pageSize: 25 }); return true;
  }
  if (req.method === 'PUT') {
    const body = await readJson(req);
    if (!/^\d{1,18}$/.test(String(body?.id)) || !statuses.has(body?.status) || typeof body?.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)) || typeof body?.note !== 'string' || body.note.length > 2000) {
      send(res, 400, { error: 'Проверьте статус и комментарий заказа.' }); return true;
    }
    // Lock by the version the administrator opened: two administrators cannot overwrite each other silently.
    const { rows } = await pool.query(`with changed as (
      update shop_orders set status = $2, note = $3, updated_at = greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', updated_at) + interval '1 millisecond')
      where id = $1 and date_trunc('milliseconds', updated_at) = $4::timestamptz returning *
    ), logged as (
      insert into admin_log (user_id, action, detail) select $5, 'order', jsonb_build_object('id', id::text, 'status', status) from changed
    ) select * from changed`, [body.id, body.status, body.note.trim(), body.updatedAt, user.id]);
    if (!rows.length) { send(res, 409, { error: 'Заказ уже изменён или не найден. Обновите список.' }); return true; }
    send(res, 200, { order: orderOf(rows[0]) }); return true;
  }
  send(res, 405, { error: 'Этот способ работы с заказом недоступен.' }); return true;
}
