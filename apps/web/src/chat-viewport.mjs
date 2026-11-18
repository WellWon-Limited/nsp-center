import {installationPlatform} from '../../../packages/presentation/install-state.mjs';

/** iOS can report less offsetTop than its real page pan; do not let stale offsets survive keyboard dismissal. */
export function chatViewportFrame(viewport,fullHeight,scrollY=0,bodyTop=0){
 const height=Math.max(1,Number(viewport.height)||fullHeight);
 const keyboard=Math.max(0,fullHeight-height);
 const top=keyboard>100?Math.max(0,Number(viewport.offsetTop)||0,(Number(viewport.pageTop)||0)-scrollY,-bodyTop-scrollY):0;
 return {height,top,keyboard};
}

/** Focus synchronously within the touch gesture, before WebKit tries to pan the entire app to the field. */
export function focusPhoneChatInput(event,win,doc){
 const input=event.currentTarget;
 if(event.pointerType!=='touch'||installationPlatform(win.navigator)!=='ios'||doc.activeElement===input)return false;
 event.preventDefault();
 const previous=input.style.transform;
 input.style.transform='translate3d(0,-100vh,0)';
 input.focus({preventScroll:true});
 win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{input.style.transform=previous;}));
 return true;
}
