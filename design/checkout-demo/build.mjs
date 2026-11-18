/** Local visual walkthrough and isolated database fixtures; never calls YooKassa. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {load} from 'cheerio';
process.loadEnvFile('.env');
const url=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Local PostgreSQL only');
const catalog=JSON.parse(await readFile('packages/catalog/generated/content.json','utf8'));
const product=catalog.products.find(p=>p.id==='alfalfa')||catalog.products[0];
const amount=product.prices.retail;
const money=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(amount);
const order='DEMO-001';
const history=[
 [1,'Заказ создан','new','pending','Начат переход на оплату'],
 [2,'Подтверждение в банке','new','pending','Покупатель ещё не подтвердил платёж'],
 [3,'Средства зарезервированы','new','waiting_for_capture','Имитация подтверждённого статуса ЮKassa'],
 [4,'Заказ собран','processing','waiting_for_capture','Сотрудник проверил состав заказа'],
 [5,'Оплата получена','processing','succeeded','Имитация успешного списания после сборки']
];
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
try{
 await pool.query('begin');
 await pool.query(`create schema if not exists checkout_demo;
 comment on schema checkout_demo is 'Isolated local mock checkout. No YooKassa requests, real payments, customers or fulfilment.';
 create table if not exists checkout_demo.shop_orders(
 id text primary key,customer jsonb not null,items jsonb not null,total integer not null,
 status text not null,created_at timestamptz not null default now(),note text not null);
 create table if not exists checkout_demo.payments(
 id text primary key,order_id text not null references checkout_demo.shop_orders(id),
 amount numeric(12,2) not null,currency text not null,status text not null,
 capture boolean not null,test boolean not null,provider text not null);
 create table if not exists checkout_demo.payment_history(
 order_id text not null references checkout_demo.shop_orders(id),step integer not null,
 stage text not null,order_status text not null,payment_status text not null,
 description text not null,primary key(order_id,step));`);
 const customer={name:'Тестовый покупатель',email:'buyer@example.test',phone:'Не используется в демонстрации',delivery:'Самовывоз'};
 const items=[{id:product.id,name:product.name,quantity:1,price:amount}];
 await pool.query(`insert into checkout_demo.shop_orders(id,customer,items,total,status,note) values($1,$2,$3,$4,'processing','ДЕМО. Не отправлять, не списывать деньги. Данные созданы сценарием предпросмотра.')
 on conflict(id) do update set customer=excluded.customer,items=excluded.items,total=excluded.total`,[order,JSON.stringify(customer),JSON.stringify(items),amount]);
 await pool.query(`insert into checkout_demo.payments values('demo-payment-001',$1,$2,'RUB','succeeded',false,true,'local_simulator')
 on conflict(id) do update set amount=excluded.amount`,[order,amount]);
 for(const [step,stage,os,ps,description] of history) await pool.query(`insert into checkout_demo.payment_history values($1,$2,$3,$4,$5,$6) on conflict(order_id,step) do update set stage=excluded.stage,order_status=excluded.order_status,payment_status=excluded.payment_status,description=excluded.description`,[order,step,stage,os,ps,description]);
 await pool.query('commit');
} catch(e){await pool.query('rollback');throw e;}finally{await pool.end();}
const $=load(await readFile('dist/profile/index.html','utf8'));
const appearance=$('script').toArray().map(e=>$(e).html()).find(t=>t?.includes('de.homeDesign='));
const stylesheet=$('link[rel=stylesheet]').attr('href');
const header=$('.site-header').first().prop('outerHTML')||'';
const ambient=$('.ambient').first().prop('outerHTML')||'';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(n,label)=>`<a class="btn btn--primary" href="../step-${n}/index.html">${label}</a>`;
const summary=`<div class="demo-summary"><span>${esc(product.name)}<small>1 упаковка · самовывоз</small></span><strong>${money}</strong></div>`;
const field=(label,value)=>`<label class="checkout-field"><span>${label}</span><input class="field" value="${esc(value)}" readonly></label>`;
const screens=[
 {title:'1. Согласованное оформление на сайте',kind:'existing',body:''},
 {title:'2. Платёжная страница',kind:'provider',body:`<section class="demo-card"><div class="demo-provider">ЮKassa <span>макет платёжной страницы</span></div><h1>Оплата заказа</h1><p>NSP Center · ${order}</p><div class="demo-amount">${money}</div><div class="demo-bank-card"><span>Банковская карта</span><strong>•••• •••• •••• 0000</strong><small>Демонстрация — реквизиты вводить не нужно</small></div><p>Выбран сценарий оплаты картой с резервированием суммы.</p>${link(3,'Продолжить с тестовой картой')}<a class="auth-link" href="../step-7/index.html">Показать отмену оплаты</a></section>`},
 {title:'3. Подтверждение в банке',kind:'provider',body:`<section class="demo-card"><div class="demo-provider">Банк <span>условный экран подтверждения</span></div><h1>Подтвердите платёж</h1><p>Магазин NSP Center</p><div class="demo-amount">${money}</div><p>Банк может попросить подтверждение в приложении или код. Этот шаг требуется не всегда.</p><div class="demo-callout">В демонстрации SMS не отправляются, деньги не резервируются.</div>${link(4,'Подтвердить в демонстрации')}</section>`},
 {title:'4. Возврат на сайт',kind:'site',body:`<section class="panel demo-card"><div class="demo-status">Средства зарезервированы</div><h1>Заказ принят</h1><p>Заказ ${order}</p>${summary}<p>Начинаем сборку. Сумма ${money} зарезервирована на карте — спишем её после проверки наличия товаров.</p><p>Сообщим, когда заказ будет готов к самовывозу.</p><div class="demo-callout">На настоящем сайте этот статус появится после проверки платежа сервером, а не просто после возврата из ЮKassa.</div>${link(5,'Посмотреть следующий шаг сотрудника')}</section>`},
 {title:'5. Действие сотрудника',kind:'staff',body:`<section class="panel demo-card demo-wide"><div class="demo-status">Админка · демонстрация</div><h1>Заказ ${order}</h1><p>Тестовый покупатель · самовывоз</p>${summary}<dl class="demo-details"><div><dt>Заказ</dt><dd>В работе</dd></div><div><dt>Платёж</dt><dd>Средства зарезервированы</dd></div></dl><label class="demo-choice"><input type="checkbox" checked disabled> Товары собраны, состав проверен</label><label class="demo-choice"><input type="checkbox" checked disabled> Данные маркировки подготовлены, если требуются</label>${link(6,'Подтвердить списание — демонстрация')}<p class="checkout-fine">В рабочей версии действие отправит запрос списания в ЮKassa. Здесь кнопка только открывает следующий макет.</p></section>`},
 {title:'6. После списания',kind:'site',body:`<section class="panel demo-card"><div class="demo-status">Оплата получена</div><h1>Заказ оплачен</h1><p>Заказ ${order}</p>${summary}<p>Оплата ${money} получена. Сообщим отдельно, когда можно забрать заказ.</p><div class="demo-callout">Демонстрация завершена. Реального списания, отправки писем и формирования чека не было.</div><a class="btn btn--primary" href="../step-1/index.html">Пройти сценарий ещё раз</a></section>`},
 {title:'7. Если оплата отменена',kind:'site',body:`<section class="panel demo-card"><div class="demo-status">Оплата не завершена</div><h1>Не удалось оплатить заказ</h1><p>Заказ ${order} сохранён. Можно попробовать ещё раз или выбрать другой способ оплаты.</p>${summary}${link(2,'Повторить оплату')}<p class="checkout-fine">При повторе создаётся новая попытка платежа для того же заказа. Эта ветка показана отдельно от успешного сценария.</p></section>`}
];
const css=`
.demo-banner{padding:10px 24px;background:#fff4d7;color:#5b4819;font:13px/1.5 system-ui;text-align:center;position:relative;z-index:3}.demo-banner a{color:inherit;text-decoration:underline;margin-left:12px}
.demo-main{padding:32px 24px 60px;max-width:1200px;margin:auto;min-height:75vh}.demo-card{width:100%;max-width:520px;margin:30px auto;padding:32px;border-radius:24px;background:var(--color-glass-raised,#fff);box-shadow:0 12px 40px #173a3010;display:flex;flex-direction:column;gap:20px;color:var(--color-ink)}
.demo-card h1{font-size:28px;line-height:1.2;margin:0}.demo-card p{font-size:15px;line-height:1.6;margin:0}.demo-card .btn{width:100%;text-align:center;justify-content:center}
.demo-wide{max-width:640px}.demo-status{font-size:13px;font-weight:700;color:#287154}.demo-summary{display:flex;justify-content:space-between;align-items:start;gap:24px;padding:20px 0;border-top:1px solid #183e321a;border-bottom:1px solid #183e321a;font-size:15px}.demo-summary small{display:block;color:var(--color-muted);font-size:13px;margin-top:6px}.demo-summary strong{white-space:nowrap}.demo-total{display:flex;justify-content:space-between;margin:22px 0;font-size:22px;font-weight:700}
.demo-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.demo-choice{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.5;margin:14px 0}.demo-choice input{width:18px;height:18px;flex:none;accent-color:#1d5744;margin-top:2px}
.demo-callout{padding:16px;background:#edf3f1;border-radius:14px;color:#455c54;font-size:13px;line-height:1.6}.demo-provider{display:flex;align-items:baseline;gap:12px;font-size:26px;font-weight:800}.demo-provider span{font-size:11px;font-weight:400;color:#667}.demo-amount{font-size:36px;font-weight:750;line-height:1.2}
.demo-bank-card{display:flex;flex-direction:column;gap:18px;padding:24px;background:#f3f4f8;border:1px solid #e1e2e8;border-radius:18px}.demo-bank-card strong{font-size:24px;letter-spacing:.08em}.demo-bank-card small{font-size:12px;color:#667}.demo-details{margin:0}.demo-details>div{display:flex;justify-content:space-between;padding:10px 0}.demo-details dd{margin:0;font-weight:650}.checkout-side>.btn{width:100%;justify-content:center}
@media(max-width:650px){.demo-fields{grid-template-columns:1fr}.demo-card{padding:24px;margin:12px auto}.demo-main{padding:20px 18px}.demo-card h1{font-size:24px}}
`;
for(const [i,s] of screens.entries()){
 const folder=`dist/__preview/checkout-demo/step-${i+1}`;
 await mkdir(folder,{recursive:true});
 if(s.kind==='existing'){
  const target='/checkout/?buy='+encodeURIComponent(product.id)+'&qty=1';
  await writeFile(folder+'/index.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Согласованное оформление заказа</title><script>location.replace(${JSON.stringify(target)})</script><a href="${target}">Открыть оформление заказа</a></html>`);
  continue;
 }

 const nav=screens.map((_,j)=>`<a href="../step-${j+1}/index.html">${j+1}</a>`).join('');
 const script=`const b=document.querySelector('#checkout-next');if(b){const update=()=>b.disabled=![...document.querySelectorAll('#offer,#consent')].every(e=>e.checked);document.querySelectorAll('#offer,#consent').forEach(e=>e.addEventListener('change',update));b.addEventListener('click',()=>location.href='../step-2/index.html');update();}`;
 await writeFile(folder+'/index.html',`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${s.title} · демо заказа NSP</title><link rel="stylesheet" href="${stylesheet}"><style>${css}</style><script>${appearance}</script></head><body><div id="root">${ambient}${s.kind==='site'||s.kind==='staff'?header:''}<div class="demo-banner"><strong>Локальная демонстрация · ${esc(s.title)}</strong> · не настоящая оплата ${nav}</div><main class="site-main demo-main">${s.body}</main></div><script>${script}</script></body></html>`);
}
console.log(JSON.stringify({order,product:product.name,amount,frames:screens.length,schema:'checkout_demo'}));
