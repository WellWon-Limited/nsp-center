import test from 'node:test';
import assert from 'node:assert/strict';
import {installHomeScrollReturn} from '../apps/web/src/home-scroll-return.mjs';
function browser(path,storage=new Map(),y=0){
 const location=new URL(path,'https://nsp.example');let click;
 const win={location,scrollY:y,sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
 const restore=installHomeScrollReturn(win,{addEventListener:(_,handler)=>{click=handler;}});
 return {restore,click:(path,{footer=false,nav=false,...options}={})=>{const link={href:new URL(path,location).href,target:'',hasAttribute:()=>false,closest:selector=>selector.includes('.bottom-nav')?(nav?{}:null):(footer?{}:null)};click({button:0,target:{closest:()=>link},...options});}};
}
test('Footer pages return to the saved homepage position, including after another information page',()=>{
 const storage=new Map();browser('/',storage,2840).click('/company/consent/',{footer:true});
 const legal=browser('/company/consent/',storage);assert.equal(legal.restore,null);legal.click('/company/privacy-policy/');
 browser('/company/privacy-policy/',storage).click('/');
 assert.equal(browser('/',storage).restore,2840);
 assert.equal(browser('/',storage).restore,null,'A later normal visit must not reuse the return request');
});
test('Main navigation, separate tabs and section anchors keep their existing behavior',()=>{
 for(const options of [{nav:true},{footer:true,ctrlKey:true},{footer:true,metaKey:true},{footer:true,button:1}]){
  const storage=new Map();browser('/',storage,1900).click('/video/',options);browser('/video/',storage).click('/');assert.equal(browser('/',storage).restore,null);
 }
 const storage=new Map();browser('/',storage,1900).click('/company/',{footer:true});browser('/company/',storage).click('/#about-company');assert.equal(browser('/#about-company',storage).restore,null);
 assert.equal(browser('/photo/').restore,null);
});

test('Homepage content destinations preserve their origin, including company and product links',()=>{
 for(const path of ['/company/','/product/omega-3/','/blog/interesnye-fakty-pro-magniy/']){
  const storage=new Map();browser('/',storage,2170).click(path);browser(path,storage).click('/');
  assert.equal(browser('/',storage).restore,2170,path);
 }
});
