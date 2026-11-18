/** Local alternatives only. The approved account card is unchanged until an option is chosen. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const $=load(await readFile('dist/profile/index.html','utf8'));
const stylesheet=$('link[rel=stylesheet]').attr('href');
const appearance=$('script').toArray().map(e=>$(e).html()).find(text=>text?.includes('de.homeDesign='));
const header=$('.site-header').first().prop('outerHTML');
const backdrop=$('.ambient').first().prop('outerHTML');
const copy='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
const variants=[
 {id:'minimal',title:'1. Только самое нужное',description:'Бренд, крупный номер по центру и одна короткая подпись. Без повторения слова «карта».',top:'<span>NSP Center</span>',label:'',bottom:'Номер карты NSP'},
 {id:'classic',title:'2. Дисконтная карта',description:'Привычное название сверху. Номер остаётся главным элементом, бренд — внизу.',top:'<span>Дисконтная карта</span>',label:'Номер карты',bottom:'Nature’s Sunshine'},
 {id:'benefit',title:'3. Карта со скидкой',description:'Номер по центру, бренд сверху, преимущество карты — отдельной короткой строкой.',top:'<span>Nature’s Sunshine</span><span class="center-card-benefit">Скидка до 30%</span>',label:'Номер карты NSP',bottom:'Цены по карте в каталоге и корзине'}
];
const css=`
.card-options{min-height:calc(100svh - var(--site-header-height,124px));display:flex;flex-direction:column;justify-content:center;align-items:center;padding:var(--space-32) var(--space-18);gap:var(--space-24)}
.card-options-heading{width:100%;max-width:600px;text-align:center;min-height:85px}.card-options-heading h1{font-size:var(--text-24);line-height:1.25}.card-options-heading p{font-size:var(--text-14);line-height:1.5;color:var(--color-muted);margin-top:var(--space-10)}
.card-options .discount-card-scale{margin:0;width:100%;max-width:440px}
html body #root .discount-card-scale>.center-card{display:grid;grid-template-rows:1fr auto 1fr;align-content:stretch;gap:0;text-align:center}
.center-card-top{display:flex;justify-content:space-between;align-items:flex-start;font-size:calc(100cqw * 15 / 440);line-height:1.4;font-weight:600;letter-spacing:.01em;color:var(--color-white)}
.center-card-middle{position:relative;display:grid;place-items:center;align-self:center;width:100%}
.center-card-number{font-family:var(--font-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums;font-size:calc(100cqw * 40 / 440);font-weight:700;line-height:1.2;letter-spacing:.08em;white-space:nowrap;color:var(--color-white)}
.center-card-label{position:absolute;bottom:calc(100% + 100cqw * 10 / 440);font-size:calc(100cqw * 12 / 440);line-height:1.4;opacity:.85;white-space:nowrap;color:var(--color-white)}
.center-card-bottom{align-self:end;font-size:calc(100cqw * 13 / 440);line-height:1.4;color:var(--color-white);opacity:.85}
.card-option--minimal .center-card-top{font-size:calc(100cqw * 20 / 440);font-weight:800}
.card-option--minimal .center-card-number{font-size:calc(100cqw * 44 / 440)}
.card-option--classic .center-card-top{justify-content:center;font-size:calc(100cqw * 19 / 440);font-weight:700}
.card-option--classic .center-card-bottom{font-size:calc(100cqw * 15 / 440);letter-spacing:.04em}
.center-card-benefit{font-size:calc(100cqw * 13 / 440);font-weight:700;text-align:right;white-space:nowrap}
.card-number-copy{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-8);min-height:44px;padding:0 var(--space-16);border:0;background:transparent;color:var(--color-link);font:inherit;font-size:var(--text-14);font-weight:700;cursor:pointer}
.card-number-copy:focus-visible{outline:2px solid var(--color-link);outline-offset:3px}.card-options-status{min-height:21px;font-size:14px;color:var(--color-link);text-align:center;margin-top:var(--space-4)}
@layer typography-reference{html body #root .card-options-heading h1{font-size:var(--text-24)!important;line-height:1.25!important}}
`;
const script=`const header=document.querySelector('.site-header');document.documentElement.style.setProperty('--site-header-height',header.getBoundingClientRect().height+'px');document.querySelector('.card-number-copy')?.addEventListener('click',async()=>{const status=document.querySelector('[role=status]');try{await navigator.clipboard.writeText('7204118');status.textContent='Номер карты скопирован';}catch{status.textContent='Номер карты: 7204118 — выделите и скопируйте его.'}});`;
for(const [index,variant] of variants.entries()){
 const path=`/__preview/card-number/centered-${index+1}/index.html`;await mkdir('dist'+path.replace('index.html',''),{recursive:true});
 const card=`<div class="discount-card-scale"><section class="discount-card center-card card-option--${variant.id}" data-ds-id="card-centered-${variant.id}"><div class="center-card-top">${variant.top}</div><div class="center-card-middle">${variant.label?`<div class="center-card-label">${variant.label}</div>`:''}<div class="center-card-number">7 204 118</div></div><div class="center-card-bottom">${variant.bottom}</div></section></div><div><button class="card-number-copy" type="button">${copy}Скопировать номер</button><p class="card-options-status" role="status" aria-live="polite"></p></div>`;
 await writeFile('dist'+path,`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${variant.title} — NSP Center</title><link rel="stylesheet" href="${stylesheet}"><style>${css}</style><script>${appearance}</script></head><body><div id="root">${backdrop}${header}<main class="site-main card-options"><div class="card-options-heading"><h1>${variant.title}</h1><p>${variant.description}</p></div>${card}</main></div><script>${script}</script></body></html>`);
 console.log(path);
}
