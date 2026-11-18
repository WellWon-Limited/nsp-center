import { createHash } from 'node:crypto';
export const guestTokenHash = token => /^[a-f0-9]{64}$/.test(token ?? '') ? createHash('sha256').update(token).digest('hex') : null;
export const orderUrl = (id, token = '') => `/order/?id=${id}${token ? `#access=${token}` : ''}`;
export const customerOrder = r => ({
 id:String(r.id),items:r.items,total:Number(r.total_kopecks)/100,
 subtotal:Number(r.subtotal_kopecks)/100,discount:Number(r.discount_kopecks)/100,
 deliveryPrice:r.delivery_kopecks===null?null:Number(r.delivery_kopecks)/100,
 status:r.status,paid:false,paymentStatus:r.payment_status,delivery:r.delivery,
 createdAt:r.created_at,updatedAt:r.updated_at,url:orderUrl(r.id),
});
export const checkoutOrder = r => ({...customerOrder(r),customer:{email:r.customer.email},canViewOrders:r.user_id!==null});
export async function readCustomerOrder(pool,id,user,token) {
 const hash=guestTokenHash(token);
 const {rows:[order]}=await pool.query(`select * from order_read where id=$1 and
   (($2::bigint is not null and user_id=$2) or (user_id is null and $3::text is not null and guest_token_hash=$3))`,[id,user?.id??null,hash]);
 if(!order)return null;
 const {rows:history}=await pool.query("select event_type as type,to_status as status,created_at as at from order_events where order_id=$1 and event_type in ('created','status_changed') order by created_at,id",[id]);
 return {...checkoutOrder(order),history};
}
