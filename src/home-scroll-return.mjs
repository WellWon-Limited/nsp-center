// Keep the homepage position across footer pages without changing their public URLs.
const originKey='nsp-footer-home-position';
const pendingKey='nsp-footer-home-return';
const position=value=>value!==null&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
export function installHomeScrollReturn(win,doc){
 let restore=null;
 try{
  if(win.location.pathname==='/'&&!win.location.hash){
   restore=position(win.sessionStorage.getItem(pendingKey));
   win.sessionStorage.removeItem(pendingKey);
   win.sessionStorage.removeItem(originKey);
  }
 }catch{}
 doc.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target?.closest?.('a[href]');
  if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const target=new URL(link.href,win.location.href);
  if(target.origin!==win.location.origin)return;
  try{
   if(win.location.pathname==='/'&&link.closest('.site-footer')&&target.pathname!=='/'){
    win.sessionStorage.setItem(originKey,String(Math.round(win.scrollY)));
   }else if(win.location.pathname!=='/'&&target.pathname==='/'&&!target.hash){
    const saved=position(win.sessionStorage.getItem(originKey));
    if(saved!==null)win.sessionStorage.setItem(pendingKey,String(saved));
   }
  }catch{}
 });
 return restore;
}
