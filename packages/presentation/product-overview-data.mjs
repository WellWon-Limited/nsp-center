/** Presentation helpers keep product facts separate from medical or marketing claims. */
const INGREDIENTS='Состав 1 ед. (таблетки, пакетика, порции)';
function splitIngredients(value){let depth=0,part='',out=[];const text=String(value||'');for(let index=0;index<text.length;index++){const ch=text[index];if(ch==='(')depth++;if(ch===')')depth=Math.max(0,depth-1);if((ch===';'||ch===','||ch==='\n')&&depth===0&&!(ch===','&&/\d/.test(text[index-1]||'')&&/\d/.test(text[index+1]||''))){if(part.trim())out.push(part.trim());part=''}else part+=ch}if(part.trim())out.push(part.trim());return out;}
export function compositionSummary(p){
 if(p.setProducts?.length||p.id==='makeover-shampoo')return '';
 if(p.id==='milk-thistle')return 'Семена молочного чертополоха.';
 if(p.id==='aloe-vera-juice')return 'Концентрат внутренней части листьев алоэ вера, очищенная вода, лимонная кислота, сорбат калия и бензоат натрия.';
 const raw=(p.properties?.[INGREDIENTS]||p.properties?.['Вспомогательные вещества']||'').replace(/^(?:В\s+)?(?:\d+\s+)?(?:порции|столовой ложке|чайной ложке|мл концентрата)\s*(?:содержится)?\s*[:—–-]\s*/iu,'');
 const items=splitIngredients(raw).map(s=>s.replace(/\s*\([^)]*\)/gu,'').replace(/\s+[—–-]\s*\d[\s\S]*$/u,'').replace(/\s+\d[\d\s,.]*(?:мг|мкг|г|МЕ|ME|КОЕ|USP|DU|GDU|%)[\s\S]*$/u,'').trim()).filter(Boolean);
 if(!items.length)return '';
 let output=[];for(const item of items){if(output.length>=6||(output.length&&[...output,item].join(', ').length>330))break;output.push(item)}
 const result=output.join(', ');return result+(output.length<items.length?'…':/[.!?]$/.test(result)?'':'.');
}
export function releaseForm(p){
 const explicit=p.properties?.['Форма выпуска'];if(explicit&&!/\d\s*(?:мл|капсул|таблет)/iu.test(explicit))return explicit;
 if(p.setProducts?.length||/набор/iu.test(p.name))return 'Набор';
 const text=String(p.properties?.['Применение']||'').toLowerCase();
 if(/жеват/u.test(text))return 'Жевательные таблетки';if(/капсул/u.test(text))return 'Капсулы';if(/таблет/u.test(text))return 'Таблетки';if(/пастил/u.test(text))return 'Пастилки';if(/порош|пакет|коктейл|мерн/u.test(text))return 'Порошок';if(/мл|ложк|капел|жидк/u.test(text))return 'Жидкость';
 const type=p.properties?.['Тип']||'';return /биологические|бады/iu.test(type)?'':type;
}
export function overviewFacts(p,packageInfo=''){
 const facts=[],pack=String(packageInfo||p.properties?.['Объём']||'').trim().replace(/\s+/g,' ');
 if(pack){let value=pack.replace(/\s+по\s+.*$/iu,'');facts.push([/мл|литр/iu.test(value)?'Объём':/капсул|таблет|пастил|пакет/iu.test(value)?'Количество':'Масса',value])}
 else if(p.setProducts?.length)facts.push(['В наборе',`${p.setProducts.length} продукта`]);
 const form=p.setProducts?.length?'Набор':/капсул/iu.test(pack)?'Капсулы':/жевательн/iu.test(pack)?'Жевательные таблетки':/таблет/iu.test(pack)?'Таблетки':/пастил/iu.test(pack)?'Пастилки':/порош/iu.test(pack)?'Порошок':releaseForm(p);if(form)facts.push(['Форма выпуска',form]);return facts;
}
