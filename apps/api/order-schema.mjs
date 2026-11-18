// Canonical order migration. Runs in the schema transaction; legacy data is checked before duplicate columns are removed.
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
create index if not exists shop_orders_status_date on shop_orders(status, created_at desc);
alter table shop_orders add column if not exists checkout_key uuid unique;
alter table shop_orders add column if not exists request_hash text;
alter table shop_orders add column if not exists total_kopecks bigint check(total_kopecks >= 0);
alter table shop_orders add column if not exists subtotal_kopecks bigint check(subtotal_kopecks >= 0);
alter table shop_orders add column if not exists discount_kopecks bigint check(discount_kopecks >= 0);
alter table shop_orders add column if not exists delivery_kopecks bigint check(delivery_kopecks >= 0);
alter table shop_orders add column if not exists currency text not null default 'RUB' check(currency = 'RUB');
alter table shop_orders add column if not exists delivery jsonb not null default '{}';
alter table shop_orders add column if not exists consents jsonb not null default '{}';
alter table shop_orders add column if not exists payment_status text not null default 'not_connected' check(payment_status = 'not_connected');
create index if not exists shop_orders_customer_date on shop_orders(user_id, created_at desc);
create table if not exists order_items (
 id bigserial primary key,
 order_id bigint not null references shop_orders(id),
 product_id text not null,
 article text,
 name text not null,
 quantity integer not null check(quantity between 1 and 99),
 unit_price_kopecks bigint not null check(unit_price_kopecks >= 0),
 retail_price_kopecks bigint not null check(retail_price_kopecks >= unit_price_kopecks),
 line_total_kopecks bigint not null check(line_total_kopecks = quantity * unit_price_kopecks),
 unique(order_id, product_id)
);
create table if not exists order_events (
 id bigserial primary key,
 order_id bigint not null references shop_orders(id),
 event_type text not null check(event_type in ('created','status_changed','note_changed')),
 from_status text,
 to_status text not null check(to_status in ('new','processing','shipped','completed','cancelled')),
 actor_id bigint references users(id) on delete set null,
 actor_role text not null check(actor_role in ('customer','guest','admin','system')),
 created_at timestamptz not null default now()
);
create index if not exists order_events_order_date on order_events(order_id, created_at, id);

alter table shop_orders add column if not exists guest_token_hash text;
alter table order_events add column if not exists reason text not null default '';
alter table order_events add column if not exists correction boolean not null default false;
-- Backfill old orders from their saved JSON, never from today's catalog.
do $$
begin
 if exists(select 1 from information_schema.columns where table_schema=current_schema() and table_name='shop_orders' and column_name='items') then
  execute $migration$
   insert into order_items(order_id,product_id,article,name,quantity,unit_price_kopecks,retail_price_kopecks,line_total_kopecks)
   select o.id,coalesce(nullif(i.value->>'id',''),'legacy-'||o.id||'-'||i.ordinality),i.value->>'article',i.value->>'name',
    (i.value->>'quantity')::integer,round((i.value->>'price')::numeric*100)::bigint,
    round(coalesce(i.value->>'retailPrice',i.value->>'price')::numeric*100)::bigint,
    round((i.value->>'price')::numeric*100)::bigint*(i.value->>'quantity')::integer
   from shop_orders o cross join lateral jsonb_array_elements(o.items) with ordinality i(value,ordinality)
   where not exists(select 1 from order_items existing where existing.order_id=o.id)
  $migration$;
  execute $migration$
   update shop_orders o set total_kopecks=coalesce(o.total_kopecks,o.total::bigint*100),
    subtotal_kopecks=coalesce(o.subtotal_kopecks,(select sum(line_total_kopecks) from order_items where order_id=o.id)),
    discount_kopecks=coalesce(o.discount_kopecks,(select sum((retail_price_kopecks-unit_price_kopecks)*quantity) from order_items where order_id=o.id)),
    delivery_kopecks=case when o.delivery->>'priceStatus'='requires_quote' then null else coalesce(o.delivery_kopecks,o.total::bigint*100-(select sum(line_total_kopecks) from order_items where order_id=o.id)) end
  $migration$;
  if exists(select 1 from shop_orders o where o.total_kopecks<>o.total::bigint*100) then
   raise exception 'Legacy order total does not match kopecks; migration stopped';
  end if;
 end if;
end $$;
-- Cross-table invariant is checked at commit, after every item has been inserted.
create or replace function check_order_amounts(order_number bigint) returns void language plpgsql as $$
declare o shop_orders%rowtype; goods bigint; discount bigint; lines bigint;
begin
 select * into o from shop_orders where id=order_number for update;
 if not found then return; end if;
 select count(*),sum(line_total_kopecks),sum((retail_price_kopecks-unit_price_kopecks)*quantity)
 into lines,goods,discount from order_items where order_id=order_number;
 if lines=0 or o.subtotal_kopecks is distinct from goods or o.discount_kopecks is distinct from discount
 or o.total_kopecks is distinct from goods+coalesce(o.delivery_kopecks,0)
 or (o.delivery_kopecks is null and coalesce(o.delivery->>'priceStatus','')<>'requires_quote') then
  raise exception 'Order amounts do not match saved items and delivery' using errcode='23514';
 end if;
end $$;
do $$ declare o record; begin
 for o in select id from shop_orders loop perform check_order_amounts(o.id); end loop;
end $$;
alter table shop_orders alter column total_kopecks set not null;
alter table shop_orders alter column subtotal_kopecks set not null;
alter table shop_orders alter column discount_kopecks set not null;
alter table shop_orders drop column if exists items;
alter table shop_orders drop column if exists total;
create or replace function order_amounts_trigger() returns trigger language plpgsql as $$
begin
 if tg_table_name='shop_orders' then perform check_order_amounts(new.id);
 else
  if tg_op<>'INSERT' then perform check_order_amounts(old.order_id); end if;
  if tg_op<>'DELETE' then perform check_order_amounts(new.order_id); end if;
 end if;
 return null;
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='orders_amounts_consistent' and tgrelid='shop_orders'::regclass) then
  create constraint trigger orders_amounts_consistent after insert or update on shop_orders deferrable initially deferred for each row execute function order_amounts_trigger();
  create constraint trigger order_items_amounts_consistent after insert or update or delete on order_items deferrable initially deferred for each row execute function order_amounts_trigger();
 end if;
end $$;
-- This view assembles the existing API shape; it stores no second copy of items or ruble amounts.
create or replace view order_read as select o.*,
 o.total_kopecks::numeric/100 as total,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'article',i.article,'name',i.name,'quantity',i.quantity,'price',i.unit_price_kopecks::numeric/100,'retailPrice',i.retail_price_kopecks::numeric/100) order by i.id) from order_items i where i.order_id=o.id),'[]'::jsonb) as items
 from shop_orders o;
`;
