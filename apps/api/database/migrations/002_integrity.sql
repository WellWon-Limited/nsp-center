create unique index users_partner_id_key on users(partner_id) where partner_id<>'';
alter table users add constraint users_role_valid check(role in ('customer','admin','removed'));
alter table users add constraint users_card_format check(partner_id='' or partner_id ~ '^[0-9]{6,12}$');
alter table reviews add constraint reviews_status_valid check(status in ('pending','published','hidden'));
alter table product_overrides add constraint product_prices_valid check(
 (retail_units is null or (retail_units>=0 and retail_units<'Infinity'::numeric)) and
 (partner_units is null or (partner_units>=0 and partner_units<'Infinity'::numeric)) and
 (retail_rub is null or retail_rub>=0) and (partner_rub is null or partner_rub>=0));
alter table product_overrides add constraint product_availability_valid check(availability is null or availability in ('InStock','OutOfStock'));
alter table files add constraint files_size_valid check(size>=0 and size=octet_length(data));
alter table sessions add constraint sessions_dates_valid check(expires_at>created_at);
alter table account_data add constraint account_data_object check(jsonb_typeof(data)='object');
alter table custom_products add constraint custom_products_object check(jsonb_typeof(data)='object');
alter table order_events add constraint order_correction_reason check(not correction or length(btrim(reason)) between 5 and 1000);
alter table shop_orders add constraint order_json_objects check(jsonb_typeof(customer)='object' and jsonb_typeof(delivery)='object' and jsonb_typeof(consents)='object');
create index sessions_expiry_idx on sessions(expires_at);
create index admin_log_user_action_date on admin_log(user_id,action,at desc);
create index reviews_user_date on reviews(user_id,created_at desc);
