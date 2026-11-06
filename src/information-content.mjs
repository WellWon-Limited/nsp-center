const blockTags=new Set(['p','h2','h3','h4','ul','ol','div','section','article','figure','table','blockquote']);
const voidTags=new Set(['br','hr','img','input','source','wbr']);
export const plainInfo=value=>String(value).replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
// Source HTML stays sanitized upstream. Give its loose text and breaks real paragraphs.
export function cleanInfoHtml(source){
 const html=source.replace(/<img\b[^>]*>/gi,'').replace(/<p\b[^>]*>\s*<\/p>/gi,'').replace(/(<p\b[^>]*>)\s*(?:<br\s*\/?>\s*)+/gi,'$1').replace(/(?:<br\s*\/?>\s*)+<\/p>/gi,'</p>');
 const output=[];let buffer='',depth=0,block=false;
 const flush=()=>{if(plainInfo(buffer))output.push(block?buffer:`<p>${buffer.trim()}</p>`);buffer='';block=false;};
 for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
  const tag=token.match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();
  if(!tag){buffer+=token;continue;}
  const closing=/^<\//.test(token);
  if(tag==='br'&&depth===0){flush();continue;}
  if(!closing&&depth===0&&blockTags.has(tag)){flush();block=true;}
  buffer+=token;
  if(!voidTags.has(tag))depth=Math.max(0,depth+(closing?-1:1));
  if(block&&depth===0)flush();
 }
 flush();
 const headings=new Set(['Наличными','Оплата банковской картой на сайте','Оплата в счет стейтментов или вознаграждений','Общие положения','Понятия и определения','Предмет договора','Порядок оформления заказа','Порядок оплаты и доставки заказа','Права и обязанности сторон','Ответственность сторон','Другие условия','Порядок возврата товара','Срок действия договора']);
 return output.join('\n').replace(/<p>([^<>]+)<\/p>/g,(tag,text)=>headings.has(plainInfo(text))?`<h2${plainInfo(text)==='Порядок оформления заказа'?' id="ordering"':''}>${text}</h2>`:tag);
}
export function faqSections(html){
 const headers=[...html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
 return headers.map((h,i)=>({level:Number(h[1]),title:plainInfo(h[2]),html:cleanInfoHtml(html.slice(h.index+h[0].length,headers[i+1]?.index??html.length))}));
}
export function reviewSections(html){
 const headers=[...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
 return headers.map((h,i)=>({name:plainInfo(h[1]),html:cleanInfoHtml(html.slice(h.index+h[0].length,headers[i+1]?.index??html.length))}));
}
export function videoSections(html){
 return [...html.matchAll(/<figure>([\s\S]*?)<\/figure>/gi)].map(m=>{
  const href=m[1].match(/href="([^"]+)"/)?.[1]||'';const id=href.match(/youtu\.be\/([\w-]{11})/)?.[1];
  const title=plainInfo(m[1].match(/<figcaption>([\s\S]*?)<\/figcaption>/i)?.[1]||'Видео').replace(/_2$/,'');
  return id?{id,title,href,poster:`/images/video-thumbnails/${id}.jpg`}:null;
 }).filter(Boolean);
}
export function contactSections(html){
 const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>m[1]);
 const seen=new Set();const bank=paragraphs.filter(p=>/^(Продавец товара:|Р\/cч:|Р\/сч:|ИНН:|ОГРН:|БИК:|Юридический адрес:)/i.test(plainInfo(p))).filter(p=>{const key=plainInfo(p);if(seen.has(key))return false;seen.add(key);return true;});
 const hours=paragraphs.filter(p=>/^(Пн-Пт:|Сб:|Вс:)/.test(plainInfo(p))).slice(0,3);
 return {bankHtml:bank.map(p=>`<p>${p}</p>`).join(''),hoursHtml:hours.map(p=>`<p>${p}</p>`).join(''),storeHref:html.match(/href="(\/contacts\/stores\/[^"?]+)"/)?.[1]||'/contacts/'};
}
