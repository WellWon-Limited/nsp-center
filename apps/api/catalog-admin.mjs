import {readCatalogConfig,initialCatalogConfig,resolveCatalog,changeCatalogConfig} from '../../packages/domain/catalog-categories.mjs';
import {customProduct} from '../../packages/domain/custom-product.mjs';

export async function readManagedCatalog(pool,categories){
 const {rows}=await pool.query("select value from site_settings where key='catalog'");
 return readCatalogConfig(rows[0]?.value)??initialCatalogConfig(categories);
}
export async function managedCategoryList(pool,categories){return resolveCatalog(categories,[],await readManagedCatalog(pool,categories)).categories;}
export async function catalogAdminState(pool,categories,built){
 const config=await readManagedCatalog(pool,categories);
 const active=resolveCatalog(categories,[],config).categories;
 const [custom,visibility,overrides]=await Promise.all([pool.query('select product_id,data from custom_products'),pool.query('select product_id,hidden from product_visibility'),pool.query('select product_id,availability from product_overrides')]);
 const hidden=new Map(visibility.rows.map(r=>[r.product_id,r.hidden])),stock=new Map(overrides.rows.map(r=>[r.product_id,r.availability]));
 const products=[...built,...custom.rows.map(r=>customProduct(r.product_id,r.data,active))].map(p=>({...p,hidden:hidden.get(p.id)??Boolean(p.hidden),availability:stock.get(p.id)??p.availability}));
 return resolveCatalog(categories,products,config);
}
export async function saveManagedCatalog(ctx,user,body){
 const client=await ctx.pool.connect();
 try{
  await client.query('begin');
  await client.query("insert into site_settings(key,value) values('catalog',$1) on conflict(key) do nothing",[JSON.stringify(initialCatalogConfig(ctx.categories))]);
  await client.query("select key from site_settings where key='catalog' for update");
  const state=await catalogAdminState(client,ctx.categories,ctx.cardProducts??[]);
  const result=changeCatalogConfig(state.config,body??{},state.products);
  if(result.error){await client.query('rollback');return result;}
  await client.query("update site_settings set value=$1,updated_at=now() where key='catalog'",[JSON.stringify(result.value)]);
  await client.query('insert into admin_log(user_id,action,detail) values($1,$2,$3)',[user.id,'catalog-'+body.action,JSON.stringify({path:body.path??null,name:body.name??null,to:body.to??null,productIds:body.productIds??[],revision:result.value.revision})]);
  await client.query('commit');return result;
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
