export type WaitEntry = {id:string; notified:boolean};
type StockProduct = {id:string; availability:string|null; name:string; path:string};

export function restoreWaitlist(value:unknown, validIds:Set<string>):WaitEntry[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.flatMap(v=>{
    if(!v||typeof v.id!=='string'||!validIds.has(v.id)||seen.has(v.id))return [];
    seen.add(v.id);return [{id:v.id,notified:v.notified===true}];
  });
}

// Only a confirmed InStock status emits an arrival. An unavailable cycle rearms the alert.
export function reconcileWaitlist(entries:WaitEntry[], products:StockProduct[]){
  const byId=new Map(products.map(p=>[p.id,p]));
  const arrivals:StockProduct[]=[];
  let changed=false;
  const next=entries.map(entry=>{
    const p=byId.get(entry.id);
    if(!p)return entry;
    if(p.availability==='InStock'&&!entry.notified){arrivals.push(p);changed=true;return {...entry,notified:true};}
    if(p.availability==='OutOfStock'&&entry.notified){changed=true;return {...entry,notified:false};}
    return entry;
  });
  return {entries:changed?next:entries,arrivals};
}
