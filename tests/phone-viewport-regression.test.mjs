import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {cardFacts} from '../scripts/card-facts.mjs';
import {productPackagePresentation} from '../src/product-media.mjs';

test('new supplier products keep meaningful catalog text and package facts in the browser summary',()=>{
 const products=JSON.parse(fs.readFileSync('src/generated/summary.json')).products;
 for(const id of ['turmeric-curcumin','tnt-nsp','smart-meal','collagen-plus','chlorophyll-lime','day-anti-age-face-cream-40']){
  const p=products.find(p=>p.id===id);assert.ok(p,id);assert.equal(p.card.sub,JSON.parse(fs.readFileSync('src/product-new/'+id+'.json')).copy.highlights[0],id+' support line');assert.ok(p.properties['Объём'],id+' package');assert.ok(p.properties['Форма выпуска'],id+' release form');assert.ok(productPackagePresentation(p).includes(p.properties['Объём'].split(' по ')[0]));
 }
 const p={category:'Биологические добавки',properties:{},copy:{highlights:['Растительный белок и клетчатка']}};
 assert.equal(cardFacts(p,new Map()).sub,'Растительный белок и клетчатка');
});

test('a keyboard viewport pan is compensated so the header stays at the visible top, and closing restores full height',()=>{
 const source=fs.readFileSync('src/assistant.tsx','utf8');const start=source.indexOf('    const vv = window.visualViewport;');const end=source.indexOf('\n  }, []);',start);
 const script=ts.transpileModule('(function(){'+source.slice(start,end)+'})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const listeners=new Map(),properties=new Map(),classes=new Set(),frames=[],timers=[];
 const root={style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)}};
 const vv={height:874,offsetTop:0,addEventListener:(k,v)=>listeners.set('vv:'+k,v),removeEventListener:()=>{}};
 const doc={documentElement:root,activeElement:null,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:()=>{}};
 const win={innerHeight:874,visualViewport:vv,setTimeout:fn=>{timers.push(fn);return timers.length}};
 const log={current:{scrollTop:0,scrollHeight:900}},focused={current:false},atEnd={current:false};
 const context={window:win,document:doc,localStorage:{getItem:()=>null,setItem:()=>{}},focused,atEnd,log,requestAnimationFrame:fn=>{frames.push(fn);return frames.length},cancelAnimationFrame:()=>{},clearTimeout:()=>{}};
 const cleanup=vm.runInNewContext(script,context);const flush=()=>{while(frames.length)frames.shift()()};
 listeners.get('focusin')({target:{closest:()=>true}});flush();assert.ok(classes.has('chat-kb-open'));assert.equal(properties.get('--chat-top'),'0px');
 for(const top of [0,24,48]){vv.height=440;vv.offsetTop=top;listeners.get('vv:resize')();flush();assert.equal(Number.parseInt(properties.get('--chat-top'))-top,0,'header stays at visual viewport top');assert.equal(properties.get('--chat-vh'),'440px')}
 vv.height=874;vv.offsetTop=0;listeners.get('focusout')({target:{closest:()=>true}});timers.forEach(fn=>fn());flush();assert.equal(properties.has('--chat-vh'),false);assert.equal(classes.has('chat-kb-open'),false);cleanup();
});

test('launch text and logo positions are fixed before paint and are not recomputed on viewport resize',()=>{
 const html=fs.readFileSync('index.html','utf8');const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(s=>s.includes('--launch-center-y'));
 for(const [screenHeight,initialHeight]of [[874,812],[568,568]]){
  const positions=new Map(),classes=new Set(),theme={content:'#eaf5f1'};
  const context={screen:{height:screenHeight},innerHeight:initialHeight,matchMedia:()=>({matches:true}),sessionStorage:{getItem:()=>null},document:{documentElement:{style:{setProperty:(k,v)=>positions.set(k,v)},classList:{add:k=>classes.add(k)}},querySelector:()=>theme}};
  vm.runInNewContext(script,context);assert.ok(classes.has('nsp-splash'));assert.equal(theme.content,'#d3ebe1');const before=[...positions];context.innerHeight=screenHeight;assert.deepEqual([...positions],before);assert.ok(Number.parseInt(positions.get('--launch-center-y'))<initialHeight);assert.ok(Number.parseInt(positions.get('--launch-note-y'))<initialHeight-20);
 }
});
