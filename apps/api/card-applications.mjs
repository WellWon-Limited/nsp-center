import {emailError,phoneDigits,formatPhone} from '../../packages/domain/contact-fields.mjs';

export const CARD_APPLICATION_SCHEMA=`
create table if not exists card_applications (
 id bigserial primary key,
 user_id bigint not null unique references users(id) on delete cascade,
 data jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','approved','rejected')),
 partner_id text not null default '',
 reason text not null default '',
 consent_at timestamptz not null,
 consent_version text not null default 'card-application-v1',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_by bigint references users(id) on delete set null
);
create index if not exists card_applications_status_date on card_applications(status,updated_at desc);`;
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateCardApplication(body,user){
 if(body?.mode==='attach'){
  const requestedPartnerId=clean(body.requestedPartnerId,20);
  if(!/^\d{6,12}$/.test(requestedPartnerId))return {error:'Введите номер карты: от 6 до 12 цифр.'};
  return {value:{mode:'attach',requestedPartnerId,firstName:user.first_name||'',lastName:user.last_name||'',middleName:'',city:'',email:user.email,phone:user.phone||''}};
 }
 const firstName=clean(body?.firstName,60),lastName=clean(body?.lastName,60),middleName=clean(body?.middleName,60),city=clean(body?.city,120),address=clean(body?.address,300);
 const email=clean(user.email,120).toLowerCase(),phone=clean(body?.phone,40);
 if(!firstName||!lastName||!city)return {error:'Укажите имя, фамилию и город.'};
 if(!address)return {error:'Укажите адрес для оформления карты.'};
 if(typeof body.address!=='string'||body.address.trim().length>300)return {error:'Адрес должен быть не длиннее 300 символов.'};
 if(emailError(email))return {error:'В аккаунте должен быть указан действующий email.'};
 if(phoneDigits(phone).length!==10)return {error:'Введите телефон полностью: 10 цифр после +7.'};
 if(body?.consent!==true)return {error:'Подтвердите согласие на обработку и передачу данных для оформления карты.'};
 return {value:{firstName,lastName,middleName,city,address,email,phone:formatPhone(phone)}};
}
const applicationOf=r=>({id:String(r.id),data:r.data,status:r.status,partnerId:r.partner_id,reason:r.reason,createdAt:r.created_at,updatedAt:r.updated_at});
const headers={'Cache-Control':'private, no-store'};
async function transaction(pool,action){const client=await pool.connect();try{await client.query('begin');const result=await action(client);await client.query('commit');return result;}catch(e){await client.query('rollback');throw e;}finally{client.release()}}

export async function cardApplicationRoute(ctx,req,res,path,url){
 if(path!=='/api/card-application'&&path!=='/api/admin/card-applications')return false;
 const {pool,send,readJson}=ctx,admin=path.startsWith('/api/admin/');
 const user=await (admin?ctx.staffUser(req):ctx.sessionUser(req));
 if(!user){send(res,401,{error:admin?'Войдите в управление сайтом.':'Войдите в личный кабинет.'},headers);return true;}
 if(req.method==='GET'){
  if(!admin){const {rows}=await pool.query('select * from card_applications where user_id=$1',[user.id]);send(res,200,{application:rows[0]?applicationOf(rows[0]):null,partnerId:user.partner_id||''},headers);return true;}
  const status=url.searchParams.get('status')||'all',q=(url.searchParams.get('q')||'').trim().slice(0,120),page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));
  if(!['all','pending','processing','approved','rejected'].includes(status)||!Number.isInteger(page)){send(res,400,{error:'Проверьте фильтр заявок.'},headers);return true;}
  const filter="($1='all' or a.status=$1) and ($2='' or position(lower($2) in lower(a.id::text||' '||a.data::text||' '||u.email||' '||a.partner_id))>0)";
  const [list,total,counts]=await Promise.all([pool.query(`select a.*,u.email as account_email from card_applications a join users u on u.id=a.user_id where ${filter} order by case a.status when 'pending' then 0 when 'processing' then 1 else 2 end,a.updated_at desc limit 25 offset $3`,[status,q,(page-1)*25]),pool.query(`select count(*)::int as count from card_applications a join users u on u.id=a.user_id where ${filter}`,[status,q]),pool.query('select status,count(*)::int as count from card_applications group by status')]);
  send(res,200,{applications:list.rows.map(r=>({...applicationOf(r),accountEmail:r.account_email})),total:total.rows[0].count,page,counts:Object.fromEntries(counts.rows.map(r=>[r.status,r.count]))},headers);return true;
 }
 if(!admin&&req.method==='POST'){
  const checked=validateCardApplication(await readJson(req),user);if(checked.error){send(res,400,checked,headers);return true;}
  const result=await transaction(pool,async c=>{
   const {rows:[customer]}=await c.query('select partner_id from users where id=$1 for update',[user.id]);
   if(customer?.partner_id)return {status:409,body:{error:'К вашему аккаунту уже привязана карта.'}};
   const {rows:[previous]}=await c.query('select * from card_applications where user_id=$1 for update',[user.id]);
   if(previous&&previous.status!=='rejected')return {status:409,body:{error:'Заявка уже отправлена. Дождитесь её обработки.',application:applicationOf(previous)}};
   const {rows:[row]}=await c.query(`insert into card_applications(user_id,data,consent_at) values($1,$2,now()) on conflict(user_id) do update set data=excluded.data,status='pending',partner_id='',reason='',consent_at=now(),reviewed_by=null,updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',card_applications.updated_at)+interval '1 millisecond') returning *`,[user.id,JSON.stringify(checked.value)]);
   return {status:201,body:{application:applicationOf(row)}};
  });send(res,result.status,result.body,headers);return true;
 }
 if(admin&&req.method==='PUT'){
  const body=await readJson(req),id=String(body?.id||''),status=body?.status,partnerId=clean(body?.partnerId,30),reason=clean(body?.reason,1000),version=body?.updatedAt;
  if(!/^\d{1,18}$/.test(id)||!['processing','approved','rejected'].includes(status)||typeof version!=='string'||!Number.isFinite(Date.parse(version))||status==='approved'&&!/^\d{6,12}$/.test(partnerId)||status==='rejected'&&!reason){send(res,400,{error:status==='approved'?'Введите выданный NSP номер карты: от 6 до 12 цифр.':'Проверьте заявку и укажите причину, если отклоняете её.'},headers);return true;}
  const result=await transaction(pool,async c=>{
   const {rows:[found]}=await c.query('select user_id from card_applications where id=$1',[id]);
   if(!found)return {status:404,body:{error:'Заявка не найдена.'}};
   const {rows:[customer]}=await c.query('select id,partner_id from users where id=$1 for update',[found.user_id]);
   const {rows:[row]}=await c.query('select * from card_applications where id=$1 for update',[id]);
   if(!row||!['pending','processing'].includes(row.status)||new Date(row.updated_at).getTime()!==Date.parse(version))return {status:409,body:{error:'Заявка уже изменена. Обновите список и проверьте её статус.'}};
   if(status==='approved'){
    // Serialize assignment of the same NSP number, including concurrent approvals for different accounts.
    await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['nsp-card:'+partnerId]);
    const {rowCount}=await c.query('select 1 from users where partner_id=$1 and id<>$2',[partnerId,customer.id]);
    if(rowCount||customer.partner_id&&customer.partner_id!==partnerId)return {status:409,body:{error:'Этот номер уже связан с другим аккаунтом или у клиента уже есть другая карта. Проверьте данные.'}};
    await c.query('update users set partner_id=$2 where id=$1',[customer.id,partnerId]);
   }
   const {rows:[updated]}=await c.query(`update card_applications set status=$2,partner_id=$3,reason=$4,reviewed_by=$5,updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',updated_at)+interval '1 millisecond') where id=$1 returning *`,[id,status,status==='approved'?partnerId:'',status==='rejected'?reason:'',user.id]);
   await c.query('insert into admin_log(user_id,action,detail) values($1,$2,$3)',[user.id,'card-application',JSON.stringify({id,status})]);
   return {status:200,body:{application:applicationOf(updated)}};
  });send(res,result.status,result.body,headers);return true;
 }
 send(res,405,{error:'Метод не поддерживается.'},headers);return true;
}
