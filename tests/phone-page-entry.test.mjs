import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
const $=cheerio.load(readFileSync('dist/index.html','utf8'));
const scripts=$('script:not([src])').toArray().map(n=>$(n).html());
const guard=scripts.find(s=>s.includes('classList.add("nsp-route-pending")'));
function screen({mobile=true,route='/health/',shellRoute='/health/'}={}){
 const classes=new Set(),timers=[];
 const html={classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)}};
 const context={matchMedia:()=>({matches:mobile}),document:{documentElement:html,getElementById:()=>({dataset:{route:shellRoute}})},location:{pathname:route,search:''},setTimeout:fn=>timers.push(fn)};
 vm.runInNewContext(guard,context);
 return {classes,timers};
}
test('Ordinary pages render immediately; only a cached shell for another route stays hidden until hydration',()=>{
 const current=screen();assert.equal(current.classes.size,0);
 const offline=screen({shellRoute:'/'});assert.ok(offline.classes.has('nsp-route-pending'));
 offline.timers.forEach(fn=>fn());assert.equal(offline.classes.size,0,'route guard must fail open if JavaScript cannot hydrate');
 assert.equal(screen({mobile:false}).classes.size,0);
 const css=$('style').text();assert.ok(!css.includes('nsp-entering'),'ordinary navigation must never blank the destination');
});
