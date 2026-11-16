/** Match every word, prefer a title match, preserve the source order within a rank. */
const normalize=value=>String(value??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export function searchSite(entries,query,limit=10){
 const q=normalize(query);if(!q)return [];
 const words=q.split(' '),seen=new Set();
 return entries.flatMap((entry,index)=>{
  if(!entry.path?.startsWith('/')||entry.path.startsWith('//')||seen.has(entry.path))return [];
  const title=normalize(entry.title),text=normalize(`${entry.title} ${entry.keywords??''}`);
  if(!words.every(word=>text.includes(word)))return [];
  seen.add(entry.path);
  const rank=title===q?0:title.startsWith(q)?1:title.includes(q)?2:words.every(word=>title.includes(word))?3:4;
  return [{entry,index,rank}];
 }).sort((a,b)=>a.rank-b.rank||a.index-b.index).slice(0,limit).map(x=>x.entry);
}
