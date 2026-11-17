/** ResizeObserver notifications must not synchronously change the observed layout.
 * Coalesce them into the owning document's next frame and cancel work on unmount. */
export function observeLayout(nodes, measure) {
 const view=nodes[0]?.ownerDocument.defaultView;
 if(!view)return()=>{};
 let frame=null,disposed=false;
 const schedule=()=>{
  if(disposed||frame!==null)return;
  frame=view.requestAnimationFrame(()=>{frame=null;if(!disposed)measure()});
 };
 measure();
 const observer=new view.ResizeObserver(schedule);
 for(const node of nodes)observer.observe(node);
 return()=>{disposed=true;observer.disconnect();if(frame!==null)view.cancelAnimationFrame(frame)};
}
export function observeHeaderHeight(header){
 const root=header.ownerDocument.documentElement;
 return observeLayout([header],()=>{
  const height=`${header.getBoundingClientRect().height}px`;
  if(root.style.getPropertyValue('--site-header-height')!==height)root.style.setProperty('--site-header-height',height);
 });
}
