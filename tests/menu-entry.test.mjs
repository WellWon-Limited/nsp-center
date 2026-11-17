import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8').match(/<script data-nav-entry>([\s\S]*?)<\/script>/)[1];
function enter(marker,state=null){
 const document={documentElement:{dataset:{}}};
 const history={state,replaceState(value){this.state=value;}};
 vm.runInNewContext(script,{document,history,location:{pathname:'/payments/'},sessionStorage:{getItem:()=>marker}});
 return {dataset:document.documentElement.dataset,state:history.state};
}
test('Opening a menu destination suppresses its return link, including after refresh',()=>{
 const first=enter('/payments/',{other:'preserved'});
 assert.equal(first.dataset.menuEntry,'true');
 assert.equal(first.state.other,'preserved');
 assert.equal(enter(null,first.state).dataset.menuEntry,'true');
});
test('Contextual and footer destinations keep their return links',()=>{
 assert.equal(enter(null).dataset.menuEntry,undefined);
 assert.equal(enter('/delivery/').dataset.menuEntry,undefined);
});
