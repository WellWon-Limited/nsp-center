-- Identity survives removal from the storefront; historical order snapshots never cascade away.
create table products (
 id text primary key check(length(id)>0),
 source text not null check(source in ('built','custom','legacy')),
 name text not null,
 archived_at timestamptz,
 created_at timestamptz not null default now()
);
-- Backfill every existing reference. The migration runner then identifies current built/custom products.
insert into products(id,source,name,archived_at)
 select product_id,'legacy',product_id,now() from (
 select product_id from custom_products union select product_id from product_overrides
 union select product_id from product_visibility union select product_id from product_content
 union select product_id from product_knowledge union select product_id from hidden_notes
 union select product_id from note_stars union select product_id from reviews
 union select product_id from files where product_id<>'content'
 union select product_id from order_items
 ) existing;
-- Editorial uploads belong to a page, not a fictional product named "content".
alter table files alter column product_id drop not null;
update files set product_id=null where product_id='content';
alter table custom_products add foreign key(product_id) references products(id);
alter table product_overrides add foreign key(product_id) references products(id);
alter table product_visibility add foreign key(product_id) references products(id);
alter table product_content add foreign key(product_id) references products(id);
alter table product_knowledge add foreign key(product_id) references products(id);
alter table hidden_notes add foreign key(product_id) references products(id);
alter table note_stars add foreign key(product_id) references products(id);
alter table reviews add foreign key(product_id) references products(id);
alter table files add foreign key(product_id) references products(id);
alter table order_items add foreign key(product_id) references products(id);
create index files_product_idx on files(product_id);
create index order_items_product_idx on order_items(product_id);
