import test from 'node:test';
import assert from 'node:assert/strict';
import {observeLayout,observeHeaderHeight} from '../packages/presentation/observe-layout.mjs';
function fixture(){
 let callback,stopped=false,id=0;const frames=new Map(),observed=[];
 const view={requestAnimationFrame(fn){frames.set(++id,fn);return id},cancelAnimationFrame(id){frames.delete(id)},ResizeObserver:class{constructor(fn){callback=fn}observe(node){observed.push(node)}disconnect(){stopped=true}}};
 const node={ownerDocument:{defaultView:view}};
 return {node,frames,observed,notify(){callback()},get stopped(){return stopped},flush(){const batch=[...frames.values()];frames.clear();for(const fn of batch)fn()}};
}
test('layout notifications coalesce and never write during ResizeObserver delivery',()=>{
 const f=fixture();let measures=0;
 const dispose=observeLayout([f.node],()=>measures++);
 assert.equal(measures,1);assert.deepEqual(f.observed,[f.node]);
 f.notify();f.notify();f.notify();assert.equal(measures,1);assert.equal(f.frames.size,1);
 f.flush();assert.equal(measures,2);
 f.notify();dispose();assert.equal(f.stopped,true);assert.equal(f.frames.size,0);
 f.notify();f.flush();assert.equal(measures,2);
});
test('header writes only a changed height to its own document',()=>{
 const f=fixture();let value='',writes=0,height=80;
 f.node.ownerDocument.documentElement={style:{getPropertyValue(){return value},setProperty(key,next){assert.equal(key,'--site-header-height');value=next;writes++}}};
 f.node.getBoundingClientRect=()=>({height});
 const dispose=observeHeaderHeight(f.node);assert.equal(value,'80px');
 f.notify();f.flush();assert.equal(writes,1);
 height=120;f.notify();assert.equal(value,'80px');f.flush();assert.equal(value,'120px');assert.equal(writes,2);dispose();
});
