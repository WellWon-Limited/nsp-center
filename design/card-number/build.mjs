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
 {id:'light',title:'1. Номер на светлой плашке',description:'Привычный вид карты: вместо штрих-кода — крупный, хорошо читаемый номер.',number:`<div class="card-number-label">Номер карты</div><div class="card-number-value">7 204 118</div>`},
 {id:'plain',title:'2. Номер на фоне карты',description:'Без отдельной плашки: номер становится главным элементом карты.',number:`<div class="card-number-label">Номер карты</div><div class="card-number-value">7 204 118</div>`},
 {id:'copy',title:'3. Номер с копированием',description:'Номер можно прочитать или скопировать одним нажатием, чтобы отправить его менеджеру.',number:`<div><div class="card-number-label">Номер карты</div><div class="card-number-value">7 204 118</div></div><button class="card-number-copy" type="button" aria-label="Скопировать номер карты">${copy}</button>`}
];
const css=`
.card-options{min-height:calc(100svh - var(--site-header-height,124px));display:flex;flex-direction:column;justify-content:center;align-items:center;padding:var(--space-32) var(--space-18);gap:var(--space-24)}
.card-options-heading{width:100%;max-width:600px;text-align:center}.card-options-heading h1{font-size:var(--text-24);line-height:1.25}.card-options-heading p{font-size:var(--text-14);line-height:1.5;color:var(--color-muted);margin-top:var(--space-10)}
.card-options .discount-card-scale{margin:0;width:100%;max-width:440px}
.card-number-zone{min-height:calc(100cqw * 84 / 440);display:flex;flex-direction:column;justify-content:center;gap:calc(100cqw * 6 / 440);padding:calc(100cqw * 12 / 440) calc(100cqw * 16 / 440);border-radius:calc(100cqw * 14 / 440)}
.card-number-label{font-size:calc(100cqw * 12 / 440);font-weight:var(--weight-600);line-height:1.4;letter-spacing:.02em}
.card-number-value{font-family:var(--font-mono,ui-monospace,monospace);font-size:calc(100cqw * 30 / 440);font-weight:var(--weight-700);font-variant-numeric:tabular-nums;line-height:1.2;letter-spacing:.08em;white-space:nowrap}
.card-option--light .card-number-zone{background:var(--color-white);color:var(--color-ink);align-items:center}
.card-option--light .card-number-label{color:var(--color-muted)}
.card-option--plain .card-number-zone{padding-inline:0;color:var(--color-white);gap:calc(100cqw * 10 / 440)}
.card-option--plain .card-number-value{font-size:calc(100cqw * 38 / 440);letter-spacing:.1em}
.card-option--plain .card-number-label{opacity:.8}
.card-option--copy .card-number-zone{flex-direction:row;align-items:center;justify-content:space-between;background:rgb(255 255 255 / .12);border:1px solid rgb(255 255 255 / .3);color:var(--color-white)}
.card-option--copy .card-number-zone>div{display:grid;gap:calc(100cqw * 6 / 440)}
.card-number-copy{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;color:inherit;border:1px solid rgb(255 255 255 / .35);border-radius:var(--radius-12);background:rgb(255 255 255 / .08);cursor:pointer}
.card-number-copy:hover{background:rgb(255 255 255 / .2)}.card-number-copy:focus-visible{outline:2px solid white;outline-offset:3px}
.card-options-status{min-height:24px;font-size:14px;color:var(--color-link);text-align:center}
@layer typography-reference{html body #root .card-options-heading h1{font-size:var(--text-24)!important;line-height:1.25!important}}
`;
const script=`const header=document.querySelector('.site-header');document.documentElement.style.setProperty('--site-header-height',header.getBoundingClientRect().height+'px');document.querySelector('.card-number-copy')?.addEventListener('click',async()=>{const status=document.querySelector('[role=status]');try{await navigator.clipboard.writeText('7204118');status.textContent='Номер карты скопирован';}catch{status.textContent='Номер карты: 7204118 — выделите и скопируйте его.'}});`;
for(const [index,variant] of variants.entries()){
 const path=`/__preview/card-number/variant-${index+1}/index.html`;await mkdir('dist'+path.replace('index.html',''),{recursive:true});
 const card=`<div class="discount-card-scale"><section class="discount-card card-option--${variant.id}" data-ds-id="card-number-${variant.id}"><div class="discount-card-top"><span>Дисконтная карта</span><span>Nature’s Sunshine</span></div><div class="discount-card-main"><strong>Ваша карта NSP</strong><span class="discount-card-rate">−30%</span></div><div class="card-number-zone">${variant.number}</div><div class="discount-card-foot"><span>Скидка до 30% на все товары в каталоге и корзине</span></div></section></div>`;
 await writeFile('dist'+path,`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${variant.title} — NSP Center</title><link rel="stylesheet" href="${stylesheet}"><style>${css}</style><script>${appearance}</script></head><body><div id="root">${backdrop}${header}<main class="site-main card-options"><div class="card-options-heading"><h1>${variant.title}</h1><p>${variant.description}</p></div>${card}<p class="card-options-status" role="status" aria-live="polite"></p></main></div><script>${script}</script></body></html>`);
 console.log(path);
}
