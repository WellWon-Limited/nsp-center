export const APP_ROLE='nsp_app';
export async function grantApplicationAccess(client) {
 const exists=await client.query('select 1 from pg_roles where rolname=$1',[APP_ROLE]);
 if(!exists.rowCount)return;
 await client.query(`
 revoke create on schema public from public;
 grant usage on schema public to nsp_app;
 revoke all on all tables in schema public from nsp_app;
 grant select on all tables in schema public to nsp_app;
 grant insert,update,delete on users,sessions,account_data,site_settings,
   product_overrides,content_items,content_hidden,custom_products,product_visibility,
   hidden_notes,note_stars,reviews,product_content,files,card_applications to nsp_app;
 grant insert,update on products to nsp_app;
 grant insert on shop_orders to nsp_app;
 grant update(updated_at) on shop_orders to nsp_app;
 revoke delete on users from nsp_app;
 grant execute on function change_order(bigint,timestamptz,text,text,bigint,boolean,text) to nsp_app;
 grant insert on order_items,order_events,admin_log,chat_log,ai_log to nsp_app;
 grant insert,update,delete on product_knowledge to nsp_app;
 grant usage,select on all sequences in schema public to nsp_app;
 revoke all on schema_migrations from nsp_app;
 grant select on schema_migrations to nsp_app;
 revoke update,delete on order_items,order_events,admin_log from nsp_app;
 revoke delete on shop_orders,products from nsp_app;
 grant execute on function check_order_amounts(bigint),order_amounts_trigger() to nsp_app;
 `);
}
