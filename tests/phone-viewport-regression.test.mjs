import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chatViewportFrame,focusPhoneChatInput} from '../apps/web/src/chat-viewport.mjs';
import {cardFacts} from '../scripts/card-facts.mjs';
import {productPackagePresentation} from '../packages/presentation/product-media.mjs';

test('new supplier products keep meaningful catalog text and package facts in the browser summary',()=>{
 const products=JSON.parse(fs.readFileSync('packages/catalog/generated/summary.json')).products;
 for(const id of ['turmeric-curcumin','tnt-nsp','smart-meal','collagen-plus','chlorophyll-lime','day-anti-age-face-cream-40']){
  const p=products.find(p=>p.id===id);assert.ok(p,id);assert.equal(p.card.sub,JSON.parse(fs.readFileSync('packages/catalog/source/product-new/'+id+'.json')).copy.highlights[0],id+' support line');assert.ok(p.properties['Объём'],id+' package');assert.ok(p.properties['Форма выпуска'],id+' release form');assert.ok(productPackagePresentation(p).includes(p.properties['Объём'].split(' по ')[0]));
 }
 const p={category:'Биологические добавки',properties:{},copy:{highlights:['Растительный белок и клетчатка']}};
 assert.equal(cardFacts(p,new Map()).sub,'Растительный белок и клетчатка');
});

test('a keyboard viewport pan is compensated so the header stays at the visible top, and closing restores full height',()=>{
 const source=fs.readFileSync('apps/web/src/assistant.tsx','utf8');const start=source.indexOf('    const vv=window.visualViewport;');const end=source.indexOf('\n  }, []);',start);
 const script=ts.transpileModule('(function(){'+source.slice(start,end)+'})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const listeners=new Map(),properties=new Map(),classes=new Set(),frames=[],timers=[];
 const root={style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k),contains:k=>classes.has(k)}};
 const vv={height:874,offsetTop:0,addEventListener:(k,v)=>listeners.set('vv:'+k,v),removeEventListener:()=>{}};
 const doc={documentElement:root,activeElement:null,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:()=>{}};
 const win={innerHeight:874,visualViewport:vv,setTimeout:fn=>{timers.push(fn);return timers.length}};
 const log={current:{scrollTop:0,scrollHeight:900}},focused={current:false},atEnd={current:false};
 const context={chatViewportFrame,window:win,document:doc,localStorage:{getItem:()=>null,setItem:()=>{}},focused,atEnd,log,requestAnimationFrame:fn=>{frames.push(fn);return frames.length},cancelAnimationFrame:()=>{},clearTimeout:()=>{}};
 const cleanup=vm.runInNewContext(script,context);const flush=()=>{while(frames.length)frames.shift()()};
 vv.height=440;listeners.get('focusin')({target:{closest:()=>true}});flush();assert.ok(classes.has('chat-kb-open'));assert.equal(properties.get('--chat-top'),'0px');
 for(const top of [0,24,48]){vv.height=440;vv.offsetTop=top;listeners.get('vv:resize')();flush();assert.equal(Number.parseInt(properties.get('--chat-top'))-top,0,'header stays at visual viewport top');assert.equal(properties.get('--chat-vh'),'440px')}
 // Blur must restore the shell before Safari emits its final resize, with no timeout.
 listeners.get('focusout')({target:{closest:()=>true}});assert.equal(properties.has('--chat-vh'),false);assert.equal(classes.has('chat-kb-open'),false);vv.height=874;vv.offsetTop=0;listeners.get('vv:resize')();flush();assert.equal(classes.has('chat-kb-open'),false);cleanup();
});

test('launch text and logo positions are fixed before paint and are not recomputed on viewport resize',()=>{
 const html=fs.readFileSync('apps/web/index.html','utf8');const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(s=>s.includes('--launch-center-y'));
 for(const [screenHeight,initialHeight]of [[874,812],[568,568]]){
  const positions=new Map(),classes=new Set(),theme={content:'#eaf5f1'};
  const context={navigator:{standalone:true},screen:{height:screenHeight},innerHeight:initialHeight,matchMedia:()=>({matches:true}),sessionStorage:{getItem:()=>null},document:{documentElement:{style:{setProperty:(k,v)=>positions.set(k,v)},classList:{add:k=>classes.add(k)}},querySelector:()=>theme}};
  vm.runInNewContext(script,context);assert.ok(classes.has('nsp-splash'));assert.equal(theme.content,'#d3ebe1');const before=[...positions];context.innerHeight=screenHeight;assert.deepEqual([...positions],before);assert.ok(Number.parseInt(positions.get('--launch-center-y'))<initialHeight);assert.ok(Number.parseInt(positions.get('--launch-note-y'))<initialHeight-20);
 }
});


test('iOS underreported pan and stale offsets are normalized without guessing keyboard height',()=>{
 assert.deepEqual(chatViewportFrame({height:440,offsetTop:24,pageTop:84},874,0,-84),{height:440,top:84,keyboard:434});
 assert.deepEqual(chatViewportFrame({height:874,offsetTop:48,pageTop:48},874),{height:874,top:0,keyboard:0});
 assert.equal(chatViewportFrame({height:440,offsetTop:0},874).height,440);
});
test('only the first iOS touch focuses outside the viewport, preserving caret placement on later touches',()=>{
 const frames=[];let prevented=0,focusCalls=0;const doc={activeElement:null};
 const input={style:{transform:''},focus(options){assert.equal(options.preventScroll,true);assert.ok(this.style.transform.includes('-100vh'));doc.activeElement=this;focusCalls++}};
 const win={navigator:{userAgent:'iPhone'},requestAnimationFrame:fn=>frames.push(fn)};
 const event={currentTarget:input,pointerType:'touch',preventDefault(){prevented++}};
 assert.equal(focusPhoneChatInput(event,win,doc),true);while(frames.length)frames.shift()();assert.equal(input.style.transform,'');
 assert.equal(focusPhoneChatInput(event,win,doc),false);assert.equal(prevented,1);assert.equal(focusCalls,1);
 doc.activeElement=null;assert.equal(focusPhoneChatInput({...event,pointerType:'mouse'},win,doc),false);
});
