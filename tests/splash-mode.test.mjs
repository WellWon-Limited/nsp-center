import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('apps/web/index.html','utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('classList.add("nsp-splash")'));
for(const scenario of [
 {name:'Safari browser',ios:false,installed:false,width:390,expected:false},
 {name:'desktop browser',ios:false,installed:false,width:1470,expected:false},
 {name:'installed iOS app',ios:true,installed:false,width:390,expected:true},
 {name:'installed standalone app',ios:false,installed:true,width:390,expected:true},
 {name:'installed tablet app',ios:false,installed:true,width:834,expected:true},
 {name:'already shown this session',ios:true,installed:true,width:390,seen:true,expected:false},
]) test(`launch screen: ${scenario.name}`,()=>{
 const classes=new Set();const theme={content:'#eaf5f1'};
 runInNewContext(script,{
  navigator:{standalone:scenario.ios},
  matchMedia:query=>({matches:query==='(display-mode: standalone)'?scenario.installed:scenario.width<=639}),
  sessionStorage:{getItem:()=>scenario.seen?'1':null},screen:{height:844},innerHeight:844,
  document:{documentElement:{style:{setProperty(){}},classList:{add:value=>classes.add(value)}},querySelector:()=>theme},
 });
 assert.equal(classes.has('nsp-splash'),scenario.expected);
 assert.equal(theme.content,scenario.expected?'#d3ebe1':'#eaf5f1');
});
