/** Local alternatives only. The approved account card is unchanged until an option is chosen. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const $=load(await readFile('dist/profile/index.html','utf8'));
const stylesheet=$('link[rel=stylesheet]').attr('href');
const appearance=$('script').toArray().map(e=>$(e).html()).find(text=>text?.includes('de.homeDesign='));
const header=$('.site-header').first().prop('outerHTML');
const backdrop=$('.ambient').first().prop('outerHTML');
const copy='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
// Balance is sample data for visual review, not a per-customer balance.
// Working card must read an administrator-managed balance from the account API; none exists yet.
const brand='<div class="brand card-brand"><span>NSP<span class="brand-light"> Center</span></span></div>';
const points='<div class="card-points"><strong>100</strong><span>баллов</span></div>';
const benefit='<div class="card-benefit"><span>Скидка</span><strong>до 30%</strong></div>';
const variants=[
 {id:'pending',pending:true,title:'Сразу после отправки заявки',description:'Вы отправили анкету на новую карту. Сотрудник ещё не присвоил ей номер.',top:brand+'<span class="card-kind">Дисконтная карта</span>',bottom:'<div class="card-points"><strong>—</strong><span>баллов</span></div><div class="card-benefit"><span>Статус</span><strong>На рассмотрении</strong></div>'},

 {id:'balance',title:'Карта после оформления',description:'Выбранное оформление: название и тип карты в одной строке, номер по центру.',top:brand+'<span class="card-kind">Дисконтная карта</span>',bottom:points+benefit},
 {id:'top-balance',title:'2. Баллы рядом с названием',description:'Баланс заметен сразу в верхнем углу. Внизу — короткая строка о скидке.',top:brand+points,bottom:'<span class="card-bottom-label">Дисконтная карта</span><strong class="card-bottom-benefit">Скидка до 30%</strong>'},
 {id:'panel',title:'3. Единая строка преимуществ',description:'Номер остаётся на фоне карты, а баллы и скидка собраны в полупрозрачной нижней полосе.',top:brand+'<span class="card-kind">Карта<br>клиента</span>',bottom:points+benefit}
];
variants.push(variants.shift());
const css=`
.card-options{min-height:calc(100svh - var(--site-header-height,124px));display:flex;flex-direction:column;justify-content:center;align-items:center;padding:var(--space-32) var(--space-18);gap:var(--space-24)}
.card-options-heading{width:100%;max-width:600px;text-align:center;min-height:85px}.card-options-heading h1{font-size:var(--text-24);line-height:1.25}.card-options-heading p{font-size:var(--text-14);line-height:1.5;color:var(--color-muted);margin-top:var(--space-10)}
.card-options .discount-card-scale{margin:0;width:100%;max-width:440px}
html body #root .discount-card-scale>.points-card{display:grid;grid-template-rows:1fr auto 1fr;align-content:stretch;gap:0}
.points-card-top{display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-12);color:var(--color-white)}
.card-brand{color:var(--color-white);gap:calc(100cqw * 8 / 440);white-space:nowrap;align-items:center}
.card-brand .brand-mark{width:calc(100cqw * 34 / 440);height:calc(100cqw * 34 / 440);border-radius:50%;background:transparent}
.card-brand img{width:100%;height:100%;filter:brightness(0) invert(1)}
.card-kind{white-space:nowrap;font-size:calc(100cqw * 11 / 440);line-height:1.4;text-align:right;opacity:.8}
.points-card-middle{position:relative;display:grid;place-items:center;align-self:center;width:100%}
.points-card-number{font-family:var(--font-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums;font-size:calc(100cqw * 39 / 440);font-weight:700;line-height:1.2;letter-spacing:.08em;white-space:nowrap;color:var(--color-white)}
.points-card-label{position:absolute;bottom:calc(100% + 100cqw * 7 / 440);font-size:calc(100cqw * 11 / 440);line-height:1.4;opacity:.75;color:var(--color-white)}
.points-card-bottom{align-self:end;display:flex;justify-content:space-between;align-items:center;min-height:calc(100cqw * 55 / 440);color:var(--color-white)}
.card-points{display:flex;align-items:baseline;gap:calc(100cqw * 7 / 440);white-space:nowrap;color:var(--color-white)}
.card-points strong{font-size:calc(100cqw * 36 / 440);line-height:1.05;font-weight:800;letter-spacing:-.04em}
.card-points>span{font-size:calc(100cqw * 13 / 440);line-height:1.4;opacity:.85}
.card-benefit{display:grid;text-align:right;gap:calc(100cqw * 2 / 440)}.card-benefit>span{font-size:calc(100cqw * 11 / 440);line-height:1.4;opacity:.8}.card-benefit>strong{font-size:calc(100cqw * 22 / 440);line-height:1.15;font-weight:800}
.card-option--balance .points-card-bottom,.card-option--pending .points-card-bottom{border-top:1px solid rgb(255 255 255 / .2);padding-top:calc(100cqw * 10 / 440)}
.card-option--top-balance .points-card-top .card-points{display:grid;text-align:right;gap:0}.card-option--top-balance .card-points strong{font-size:calc(100cqw * 30 / 440)}.card-option--top-balance .card-points>span{font-size:calc(100cqw * 11 / 440)}
.card-option--top-balance .points-card-bottom{min-height:calc(100cqw * 38 / 440);border-top:1px solid rgb(255 255 255 / .2);padding-top:calc(100cqw * 10 / 440)}
.card-bottom-label{font-size:calc(100cqw * 12 / 440);opacity:.8}.card-bottom-benefit{font-size:calc(100cqw * 16 / 440);font-weight:700}
.card-option--panel .points-card-bottom{background:rgb(255 255 255 / .12);border:1px solid rgb(255 255 255 / .18);border-radius:calc(100cqw * 12 / 440);padding:calc(100cqw * 10 / 440) calc(100cqw * 14 / 440)}.card-option--panel .card-points strong{font-size:calc(100cqw * 30 / 440)}.card-option--panel .card-benefit{display:flex;align-items:baseline;gap:calc(100cqw * 6 / 440)}.card-option--panel .card-benefit>strong{font-size:calc(100cqw * 20 / 440)}
.card-option--pending .points-card-number{font-family:inherit;font-size:calc(100cqw * 25 / 440);letter-spacing:-.02em;white-space:normal;text-align:center;line-height:1.25}
.card-option--pending .card-benefit>strong{font-size:calc(100cqw * 15 / 440)}
.card-pending-note{max-width:440px;font-size:14px;line-height:1.5;color:var(--color-muted);margin:0}
.card-options-controls{text-align:center}.card-number-copy{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-8);min-height:44px;padding:0 var(--space-16);border:0;background:transparent;color:var(--color-link);font:inherit;font-size:var(--text-14);font-weight:700;cursor:pointer}.card-number-copy:focus-visible{outline:2px solid var(--color-link);outline-offset:3px}
.card-options-status{min-height:21px;font-size:14px;color:var(--color-link)}.card-example-note{font-size:12px;color:var(--color-muted);line-height:1.5}
@layer typography-reference{html body #root .card-options-heading h1{font-size:var(--text-24)!important;line-height:1.25!important}html body #root .discount-card .card-brand{font-size:calc(100cqw * 24 / 440)!important;line-height:1!important}}
`;
const script=`const header=document.querySelector('.site-header');document.documentElement.style.setProperty('--site-header-height',header.getBoundingClientRect().height+'px');document.querySelector('.card-number-copy')?.addEventListener('click',async()=>{const status=document.querySelector('[role=status]');try{await navigator.clipboard.writeText('7204118');status.textContent='Номер карты скопирован';}catch{status.textContent='Номер карты: 7204118 — выделите и скопируйте его.'}});`;
for(const [index,variant] of variants.entries()){
 const path=`/__preview/card-number/points-${index+1}/index.html`;await mkdir('dist'+path.replace('index.html',''),{recursive:true});
 const card=`<div class="discount-card-scale"><section class="discount-card points-card card-option--${variant.id}" data-ds-id="card-points-${variant.id}"><div class="points-card-top">${variant.top}</div><div class="points-card-middle"><div class="points-card-label">${variant.pending?'Номер ещё не присвоен':'Номер карты'}</div><div class="points-card-number">${variant.pending?'Заявка отправлена':'7 204 118'}</div></div><div class="points-card-bottom">${variant.bottom}</div></section></div><div class="card-options-controls">${variant.pending?'<p class="card-pending-note">Сотрудник оформит карту в NSP и добавит номер в ваш личный кабинет. Повторно отправлять анкету не нужно.</p>':`<button class="card-number-copy" type="button">${copy}Скопировать номер</button><p class="card-example-note">100 баллов — пример для выбора оформления, не реальный баланс.</p>`}<p class="card-options-status" role="status" aria-live="polite"></p></div>`;
 await writeFile('dist'+path,`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${variant.title} — NSP Center</title><link rel="stylesheet" href="${stylesheet}"><style>${css}</style><script>${appearance}</script></head><body><div id="root">${backdrop}${header}<main class="site-main card-options"><div class="card-options-heading"><h1>${variant.title}</h1><p>${variant.description}</p></div>${card}</main></div><script>${script}</script></body></html>`);
 console.log(path);
}
