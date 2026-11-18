-- Critical prices are validated even when a caller bypasses the editor.
create function valid_custom_prices(value jsonb) returns boolean
language plpgsql immutable as $$
declare retail numeric; partner numeric;
begin
 if jsonb_typeof(value->'retailRub') is distinct from 'number' then return false; end if;
 retail := (value->>'retailRub')::numeric;
 if retail<=0 or retail>10000000 or trunc(retail)<>retail then return false; end if;
 if value ? 'partnerRub' and value->'partnerRub'<>'null'::jsonb then
  if jsonb_typeof(value->'partnerRub') is distinct from 'number' then return false; end if;
  partner := (value->>'partnerRub')::numeric;
  if partner<=0 or partner>=retail or trunc(partner)<>partner then return false; end if;
 end if;
 return true;
end $$;
alter table custom_products add constraint custom_prices_valid check(valid_custom_prices(data));

-- Row locks used during checkout require an UPDATE column privilege; the trigger
-- prevents that narrow grant from becoming a direct mutation capability.
create function guard_direct_order_update() returns trigger language plpgsql as $$
begin
 if current_user='nsp_app' then
  raise exception 'Use change_order to update an order with its audit history' using errcode='42501';
 end if;
 return new;
end $$;
create trigger orders_guard_direct_update before update on shop_orders
 for each row execute function guard_direct_order_update();

-- Only this bounded operation may change status/note for the application.
-- The authenticated actor is supplied by the server, never from the request body.
create function change_order(order_number bigint, expected_version timestamptz,
 next_status text, next_note text, actor bigint, is_correction boolean, change_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old_order public.shop_orders%rowtype; status_changed boolean; note_changed boolean; allowed boolean;
begin
 if not exists(select 1 from public.users where id=actor and role='admin') then
  raise exception 'Active staff account required' using errcode='42501';
 end if;
 if next_status is null or next_status not in ('new','processing','shipped','completed','cancelled')
 or next_note is null or length(next_note)>2000 or change_reason is null or length(change_reason)>1000 or is_correction is null then
  raise exception 'Invalid order change' using errcode='23514';
 end if;
 change_reason:=btrim(change_reason);next_note:=btrim(next_note);
 select * into old_order from public.shop_orders where id=order_number for update;
 if not found or date_trunc('milliseconds',old_order.updated_at) is distinct from expected_version then
  raise exception 'Order changed; reload before editing' using errcode='40001';
 end if;
 status_changed:=old_order.status<>next_status;note_changed:=old_order.note<>next_note;
 if is_correction and (not status_changed or length(change_reason)<5) then
  raise exception 'Correction requires a changed status and a reason' using errcode='23514';
 end if;
 if status_changed then
  if next_status='cancelled' and length(change_reason)<5 then
   raise exception 'Cancellation requires a reason' using errcode='23514';
  end if;
  allowed:=case old_order.status
   when 'new' then next_status in ('processing','cancelled')
   when 'processing' then case when old_order.delivery->>'method'='pickup'
    then next_status in ('completed','cancelled') else next_status in ('shipped','cancelled') end
   when 'shipped' then next_status='completed' else false end;
  if not is_correction and not allowed then
   raise exception 'Invalid order status transition' using errcode='23514';
  end if;
 end if;
 if not status_changed and not note_changed then return; end if;
 update public.shop_orders set status=next_status,note=next_note,
  updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',updated_at)+interval '1 millisecond')
  where id=order_number;
 if status_changed then
  insert into public.order_events(order_id,event_type,from_status,to_status,actor_id,actor_role,reason,correction)
   values(order_number,'status_changed',old_order.status,next_status,actor,'admin',change_reason,is_correction);
 end if;
 if note_changed then
  insert into public.order_events(order_id,event_type,from_status,to_status,actor_id,actor_role)
   values(order_number,'note_changed',next_status,next_status,actor,'admin');
 end if;
 insert into public.admin_log(user_id,action,detail) values(actor,'order',
  jsonb_build_object('id',order_number::text,'from',old_order.status,'status',next_status,
  'reason',change_reason,'correction',is_correction,'noteChanged',note_changed));
end $$;
revoke all on function change_order(bigint,timestamptz,text,text,bigint,boolean,text) from public;

-- Checkout may append only the initial event, never a fabricated status change.
create function guard_order_event_insert() returns trigger language plpgsql as $$
begin
 if current_user='nsp_app' and (new.event_type<>'created' or new.to_status<>'new'
  or new.from_status is not null or new.correction or new.reason<>''
  or not exists(select 1 from shop_orders o where o.id=new.order_id and o.status='new'
    and o.xmin::text=pg_current_xact_id()::text and new.actor_id is not distinct from o.user_id
    and new.actor_role=case when o.user_id is null then 'guest' else 'customer' end)
  or exists(select 1 from order_events e where e.order_id=new.order_id)) then
  raise exception 'Order history must be written with the order operation' using errcode='42501';
 end if;
 return new;
end $$;
create trigger order_events_guard_insert before insert on order_events
 for each row execute function guard_order_event_insert();

create function guard_order_item_insert() returns trigger language plpgsql as $$
begin
 -- Serialize against completion of a concurrent checkout before checking its history.
 perform id from shop_orders where id=new.order_id for update;
 if current_user='nsp_app' and exists(select 1 from order_events where order_id=new.order_id) then
  raise exception 'Completed checkout items are immutable' using errcode='42501';
 end if;
 return new;
end $$;
create trigger order_items_guard_insert before insert on order_items
 for each row execute function guard_order_item_insert();
