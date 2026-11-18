import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSite } from '../packages/presentation/site-search-match.mjs';

const entries=[
 {title:'Магний Хелат',path:'/product/magnesium/',kind:'Продукт',keywords:'1602 минеральный комплекс'},
 {title:'Интересные факты про магний',path:'/blog/magnesium/',kind:'Статья'},
 {title:'Условия доставки',path:'/delivery/',kind:'Информация'},
 {title:'Хлорофилл жидкий',path:'/product/chlorophyll/',kind:'Продукт',keywords:'475 хлорофилл'},
 {title:'План приёма',path:'/health/',kind:'Раздел'},
];
test('Site search finds products, editorial pages, information, article numbers and е/ё variants',()=>{
 assert.deepEqual(searchSite(entries,' МАГНИЙ ').map(x=>x.kind),['Продукт','Статья']);
 assert.equal(searchSite(entries,'1602')[0].path,'/product/magnesium/');
 assert.equal(searchSite(entries,'условия доставки')[0].path,'/delivery/');
 assert.equal(searchSite(entries,'приема')[0].path,'/health/');
 assert.equal(searchSite(entries,'хлорофилл 475')[0].path,'/product/chlorophyll/');
 assert.deepEqual(searchSite(entries,'магний доставка'),[]);
 assert.deepEqual(searchSite(entries,'  '),[]);
});
test('Search prioritizes a precise title and never returns duplicate or external destinations',()=>{
 const all=[...entries,{title:'Магний',path:'/product/exact/',kind:'Продукт'},entries[0],{title:'Магний',path:'https://example.com',kind:'Информация'},{title:'Магний',path:'//example.com',kind:'Информация'}];
 const results=searchSite(all,'магний');
 assert.equal(results[0].path,'/product/exact/');
 assert.equal(results.length,3);
 assert.equal(searchSite(all,'магний',2).length,2);
 assert.equal(searchSite([...entries,{title:'Доставка',path:'/delivery/',kind:'Информация',keywords:'курьер самовывоз'}],'курьер')[0].path,'/delivery/');
});
