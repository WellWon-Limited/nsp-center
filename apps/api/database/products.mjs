/** Remove storefront data atomically; keep the identity so purchased items retain their references. */
export async function deleteCustomProduct(pool,id,actorId) {
 const client=await pool.connect();
 try {
  await client.query('begin');
  const {rowCount}=await client.query('delete from custom_products where product_id=$1',[id]);
  if(!rowCount){await client.query('rollback');return false;}
  for(const table of ['product_knowledge','product_visibility','product_overrides','product_content','hidden_notes','note_stars','files','reviews'])await client.query(`delete from ${table} where product_id=$1`,[id]);
  await client.query('update products set archived_at=now() where id=$1',[id]);
  await client.query("insert into admin_log(user_id,action,detail) values($1,'product-delete',$2)",[actorId,JSON.stringify({productId:id})]);
  await client.query('commit');return true;
 } catch(error){await client.query('rollback');throw error;} finally{client.release();}
}
