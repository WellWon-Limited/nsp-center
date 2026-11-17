// Source HTML is already sanitized by the content importer. Replace media without rewriting prose.
const escapeAttribute=value=>String(value).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
export function prepareJournalArticle(article,media){
 let coverRemoved=false;
 let imageIndex=0;
 let body=article.html.replace(/<img\b[^>]*>/gi,tag=>{
  const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if(!coverRemoved&&src===article.image){coverRemoved=true;return '';}
  const replacement=media.inline[imageIndex++];
  if(!replacement)return tag;
  return `<figure class="av-inline-image"><img src="${escapeAttribute(replacement.src)}" alt="${escapeAttribute(replacement.alt)}" width="1536" height="1024" loading="lazy" decoding="async"></figure>`;
 });
 body=body.replace(/<p\b[^>]*>\s*(<figure class="av-inline-image">[\s\S]*?<\/figure>)\s*<\/p>/gi,'$1').replace(/<p\b[^>]*>\s*<\/p>/gi,'');
 const leadMatch=body.match(/^\s*(<p\b[^>]*>[\s\S]*?<\/p>)/i);
 const lead=leadMatch?.[1]||'';
 if(leadMatch)body=body.slice(leadMatch[0].length);
 // Existing standalone bold subheadings become readable section headings; their wording stays exact.
 body=body.replace(/<p\b[^>]*>\s*<(strong|b)>([^<]{1,100})<\/\1>\s*<\/p>/gi,(tag,_name,text)=>/[;:]\s*$/.test(text)?tag:`<h2>${text}</h2>`);
 return {lead,body};
}
