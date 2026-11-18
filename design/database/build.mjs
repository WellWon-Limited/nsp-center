/** Read-only local schema snapshot. Never exports row values or connection secrets. */
import pg from 'pg';
import {mkdir,writeFile} from 'node:fs/promises';
process.loadEnvFile('.env');
const url=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Local database only');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const quote=s=>'"'+s.replaceAll('"','""')+'"';
let tables,version;
try{
 await pool.query('begin transaction isolation level repeatable read read only');
 version=(await pool.query('show server_version')).rows[0].server_version;
 const names=(await pool.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
 tables=[];
 for(const {tablename:name} of names){
  const count=(await pool.query('select count(*)::int as count from public.'+quote(name))).rows[0].count;
  const columns=(await pool.query("select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[name])).rows;
  const constraints=(await pool.query("select pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=$1",[name])).rows;
  tables.push({name,count,columns,constraints});
 }
 await pool.query('commit');
}finally{await pool.end();}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={users:'Аккаунты покупателей и сотрудников',sessions:'Сессии входа',account_data:'Корзины, избранное и данные кабинетов',card_applications:'Заявки на дисконтные карты',shop_orders:'Заказы',admin_log:'История действий сотрудников',site_settings:'Настройки сайта',product_overrides:'Изменения товаров',custom_products:'Добавленные товары'};
const at=new Date().toLocaleString('ru-RU',{timeZone:'Europe/Moscow'});
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Локальная база · PostgreSQL</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f5f8;color:#172b3a;font:15px/1.5 system-ui,sans-serif}header{background:#163446;color:white;padding:28px 36px}h1{margin:4px 0;font-size:28px}header p{margin:4px 0;color:#c3d5df}.badge{font-size:12px;letter-spacing:.07em}main{max-width:1400px;margin:auto;padding:28px 36px}input{width:100%;padding:14px 16px;border:1px solid #cbd5df;border-radius:10px;font:inherit;margin:12px 0 20px;background:white}.note{color:#546777}.stats{display:flex;gap:28px;margin-bottom:16px}.stats strong{font-size:24px}details{background:white;border:1px solid #dbe2e8;border-radius:12px;margin:10px 0;overflow:hidden}summary{display:flex;gap:24px;align-items:center;padding:18px 20px;cursor:pointer}summary:before{content:'▸';color:#547082}details[open] summary:before{content:'▾'}summary b{min-width:230px;font-family:ui-monospace,monospace}summary span{flex:1;color:#657888}summary em{font-style:normal;background:#edf3f6;padding:4px 12px;border-radius:20px;white-space:nowrap}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-top:1px solid #e5ebef;padding:10px 24px}th{background:#f7f9fa;color:#566b7a}td:first-child{font-family:ui-monospace,monospace}.constraints{padding:14px 24px;background:#f7fafb;font-size:13px;overflow-wrap:anywhere}.constraints code{display:block;margin-top:6px}footer{margin-top:24px;color:#657888}[hidden]{display:none!important}
</style><header><div class="badge">POSTGRESQL · ЛОКАЛЬНО · ТОЛЬКО ПРОСМОТР</div><h1>База nsp_center</h1><p>127.0.0.1:${esc(url.port)} · PostgreSQL ${esc(version)}</p></header><main><div class="stats"><div><strong>${tables.length}</strong> таблиц</div><div><strong>${tables.reduce((n,t)=>n+t.count,0)}</strong> записей</div></div><div class="note">Снимок на ${esc(at)} (Москва). Раскройте таблицу, чтобы увидеть поля и связи.<br>Здесь показана структура базы. Содержимое записей, пароли и ключи не выгружаются.</div><input type="search" aria-label="Поиск таблицы" placeholder="Найти таблицу: аккаунты, заказы, заявки…">${tables.map(t=>`<details data-search="${esc(t.name+' '+(labels[t.name]||''))}" ${t.name==='users'?'open':''}><summary><b>${esc(t.name)}</b><span>${esc(labels[t.name]||'Таблица приложения')}</span><em>${t.count} записей</em></summary><table><thead><tr><th>Поле</th><th>Тип данных</th><th>Может быть пустым (NULL)</th></tr></thead><tbody>${t.columns.map(c=>`<tr><td>${esc(c.column_name)}</td><td>${esc(c.data_type)}</td><td>${c.is_nullable==='YES'?'Да':'Нет'}</td></tr>`).join('')}</tbody></table>${t.constraints.length?`<div class="constraints">Ключи и связи${t.constraints.map(c=>`<code>${esc(c.definition)}</code>`).join('')}</div>`:''}</details>`).join('')}<footer>Это обзор локальной базы, а не редактор данных. Для обновления снимка: node design/database/build.mjs.</footer></main><script>document.querySelector('input').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase().trim();document.querySelectorAll('details').forEach(el=>el.hidden=!el.dataset.search.toLocaleLowerCase().includes(q))})</script></html>`;
await mkdir('dist/__preview/database',{recursive:true});
await writeFile('dist/__preview/database/index.html',html);
console.log(JSON.stringify({tables:tables.length,rows:tables.reduce((n,t)=>n+t.count,0),path:'/__preview/database/index.html'}));
