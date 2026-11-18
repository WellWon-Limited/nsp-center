// Reuses the actual admin React app. Only synthetic order requests are mutable.
import {readFile,writeFile} from 'node:fs/promises';
import {orderStatusLabels,orderTransitions,nextOrderStatuses,orderChangeError} from '../../packages/domain/order-status.mjs';
let html=await readFile('dist/order-rehearsal.html','utf8');
html=html.replace("const stage=Math.max(1,Math.min(8,Number(new URLSearchParams(location.search).get('stage'))||1));",'const stage=7;');
const setup=`
const scenarios=[['Новый · самовывоз','pickup','new'],['Сборка · самовывоз','pickup','processing'],['Выдан · самовывоз','pickup','completed'],['Новый · доставка','courier','new'],['Сборка · доставка','courier','processing'],['Передан в доставку','courier','shipped'],['Доставлен','courier','completed']];
const scenario=Math.max(0,Math.min(6,Number(new URLSearchParams(location.search).get('step'))||0));
const [scenarioLabel,method,initialStatus]=scenarios[scenario];
const orderStatusLabels=${JSON.stringify(orderStatusLabels)},orderTransitions=${JSON.stringify(orderTransitions)};
${nextOrderStatuses.toString()}
${orderChangeError.toString()}
const timeline=method==='pickup'?['new','processing','completed']:['new','processing','shipped','completed'];
const initialHistory=timeline.slice(0,timeline.indexOf(initialStatus)+1).map((status,i)=>({type:i?'status_changed':'created',from:i?timeline[i-1]:null,to:status,actorRole:i?'admin':'customer',at:new Date(Date.UTC(2026,10,18,9,i*15)).toISOString()}));
let demoOrder={id:method==='pickup'?'647204':'647205',customer:{name:'Анна Тестовая',phone:'+7 (900) 000-00-00',email:'demo@example.ru',comment:'Тестовый заказ для проверки обработки.'},items:products.map(p=>({...p,quantity:1})),total:products.reduce((n,p)=>n+p.price,0)+(method==='pickup'?0:350),status:initialStatus,paymentStatus:'not_connected',delivery:{method,...(method==='pickup'?{pickupAddress:'Санкт-Петербург, наб. Обводного канала, 64, корп. 2, офис 29/3'}:{city:'Санкт-Петербург',street:'Тестовая улица',house:'1',flat:'10',day:'2026-11-19',window:'10:00–14:00'}),priceStatus:'fixed'},deliveryPrice:method==='pickup'?0:350,note:'',history:initialHistory,createdAt:initialHistory[0].at,updatedAt:initialHistory.at(-1).at};
`;
html=html.replace('const nativeFetch=window.fetch.bind(window)',setup+'\nconst nativeFetch=window.fetch.bind(window)');
const start=html.indexOf(" if(u.pathname==='/api/admin/orders')");
const end=html.indexOf("\n if(u.pathname==='/api/site')",start);
if(start<0||end<0)throw Error('Admin review interception boundary missing');
html=html.slice(0,start)+` if(u.pathname==='/api/admin/orders'){
 if(method==='PUT'){const b=JSON.parse(options.body||'{}');if(b.id!==demoOrder.id||b.updatedAt!==demoOrder.updatedAt)return json({error:'Заказ уже изменён. Обновите список.'},409);const error=orderChangeError(demoOrder.status,b.status,demoOrder.delivery.method,b.correction===true,b.reason||'');if(error)return json({error},400);const at=new Date().toISOString(),history=[...demoOrder.history];if(b.status!==demoOrder.status)history.push({type:'status_changed',from:demoOrder.status,to:b.status,actorRole:'admin',at,reason:b.reason,correction:b.correction});if(b.note!==demoOrder.note)history.push({type:'note_changed',from:demoOrder.status,to:b.status,actorRole:'admin',at});demoOrder={...demoOrder,status:b.status,note:b.note,updatedAt:at,history};return json({order:demoOrder})}
 const summary={new:0,processing:0,shipped:0,completed:0,cancelled:0};summary[demoOrder.status]=1;const status=u.searchParams.get('status')||'all',q=(u.searchParams.get('q')||'').toLowerCase();const rows=(status==='all'||status===demoOrder.status)&&(demoOrder.id+' '+JSON.stringify(demoOrder.customer)).toLowerCase().includes(q)?[demoOrder]:[];return json({orders:rows,summary,total:rows.length,page:1,pageSize:25});}
`+html.slice(end);
// The old demo's separate persisted order is irrelevant; navigation never writes real APIs.
html=html.replace("KEY='nsp-center:isolated-order-rehearsal-v1'","KEY='nsp-center:admin-review-only'");
const controls=`<style>#demo-stage{display:none!important}.admin-review-controls{position:relative;z-index:1000;padding:14px 24px;background:#f3f7f3;color:#193e37;font:14px/1.5 system-ui;display:flex;align-items:center;gap:18px;border-bottom:1px solid #d6e0d7}.admin-review-controls select,.admin-review-controls button{padding:9px 12px;border:1px solid #bacbbf;border-radius:10px;background:white;color:inherit;font:inherit}.admin-review-controls small{display:block;color:#64766b}.admin-review-controls strong{white-space:nowrap}.admin-review-controls{flex-wrap:wrap}.admin-review-controls>*{min-width:0;max-width:100%}.admin-review-controls label{display:flex;align-items:center;gap:8px}.admin-review-controls select{min-width:0;max-width:100%}@media(max-width:639px){.admin-review-controls{padding:12px 18px;gap:10px}.admin-review-controls label{width:100%}.admin-review-controls select{flex:1;width:0}.admin-review-controls>span{font-size:12px}}</style><div class="admin-review-controls"><div><strong>Проверка админки</strong><small>Тестовые данные · реальная база не меняется</small></div><label>Этап <select id="admin-review-step" aria-label="Этап проверки"></select></label><button id="admin-review-reset">Начать этот этап заново</button><span>Раскройте заказ ниже. Действия работают в пределах этого показа.</span></div><script>const selector=document.querySelector('#admin-review-step');selector.innerHTML=scenarios.map((s,i)=>'<option value="'+i+'" '+(i===scenario?'selected':'')+'>'+ (i+1)+'. '+s[0]+'</option>').join('');selector.onchange=()=>location.href='/admin-review.html?section=orders&step='+selector.value;document.querySelector('#admin-review-reset').onclick=()=>location.reload();</script>`;
html=html.replace('<body><div id="root">','<body>'+controls+'<div id="root">');
await writeFile('dist/admin-review.html',html);
console.log('Admin review: 7 scenarios, actual admin UI, isolated synthetic requests.');
