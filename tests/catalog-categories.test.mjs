import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCatalogConfig,changeCatalogConfig,resolveCatalog,applyCatalogConfig,visibleCategories,readCatalogConfig} from '../packages/presentation/catalog-categories.mjs';
const root='/catalog/',a=root+'a/',b=root+'b/',facet=root+'facet/';
const category=(path,name,products=[],parent=root)=>({id:path,path,url:path,name,parent,products,children:[],pagination:[],breadcrumbs:[],description:'',html:''});
const categories=[category(root,'Все продукты',[],null),category(a,'Витамины',['/product/one/','/product/hidden/']),category(b,'Пустая'),category(facet,'По назначению',['/product/one/'])];
const products=[{id:'one',path:'/product/one/',name:'Первый',categoryPath:a,category:'Витамины',breadcrumbs:[],availability:'InStock'},{id:'hidden',path:'/product/hidden/',name:'Скрытый',categoryPath:a,category:'Витамины',breadcrumbs:[],hidden:true,availability:'OutOfStock'}];
test('empty categories remain available to staff and return to public menus when a product is moved in',()=>{
 let config=initialCatalogConfig(categories);
 const original=resolveCatalog(categories,products,config);
 assert.deepEqual(visibleCategories(original.categories,original.products).map(c=>c.path),[root,a,facet]);
 assert.ok(original.categories.some(c=>c.path===b));
 assert.ok(original.categories.find(c=>c.path===facet).products.includes(products[0].path),'imported overlapping facets survive an unchanged configuration');
 config=changeCatalogConfig(config,{revision:0,action:'move',to:b,productIds:['one']},original.products).value;
 const result=resolveCatalog(categories,products,config);
 assert.deepEqual(visibleCategories(result.categories,result.products).map(c=>c.path),[root,b]);
 assert.equal(result.products[0].categoryPath,b);assert.equal(result.products[0].breadcrumbs.at(-2).url,b);
 assert.equal(result.products[1].hidden,true,'moving a product never publishes hidden cards');
});
test('creation, nested categories and renaming preserve URLs; deletion requires a valid destination and keeps products',()=>{
 let config=changeCatalogConfig(initialCatalogConfig(categories),{revision:0,action:'create',name:'Спорт',parent:root},products).value;
 const sport=config.categories.find(c=>c.name==='Спорт').path;
 config=changeCatalogConfig(config,{revision:1,action:'rename',path:sport,name:'Для спорта',parent:b},products).value;
 assert.equal(config.categories.find(c=>c.name==='Для спорта').path,sport);
 assert.ok(changeCatalogConfig(config,{revision:2,action:'rename',path:b,name:'Пустая',parent:sport},products).error,'cycles are rejected');
 assert.ok(changeCatalogConfig(config,{revision:2,action:'delete',path:a},products).error,'a populated category needs a destination, including hidden products');
 config=changeCatalogConfig(config,{revision:2,action:'delete',path:a,to:sport},products).value;
 assert.equal(config.categories.find(c=>c.path===a).redirectTo,sport);
 const result=resolveCatalog(categories,products,config);
 assert.equal(result.products.length,2);assert.ok(result.products.every(p=>p.categoryPath===sport));
 assert.ok(!result.categories.some(c=>c.path===a));
 assert.ok(changeCatalogConfig(config,{revision:3,action:'delete',path:sport,to:a},products).error,'an archived destination cannot form a redirect loop');
});
test('concurrent changes, invalid paths and unknown product IDs are rejected',()=>{
 const config=initialCatalogConfig(categories);
 assert.equal(changeCatalogConfig(config,{revision:9,action:'create',name:'Витамины'},products).status,409);
 assert.ok(changeCatalogConfig(config,{revision:0,action:'move',to:b,productIds:['missing']},products).error);
 assert.equal(readCatalogConfig({...config,categories:[{path:'//evil.example/',name:'Чужое',parent:root}]}),null);
 assert.equal(readCatalogConfig({...config,categories:[{path:a,name:'Круг',parent:a}]}),null);
});
test('applying settings repeatedly restores membership and updates every product object consistently',()=>{
 const cats=structuredClone(categories),list=structuredClone(products),config=changeCatalogConfig(initialCatalogConfig(categories),{revision:0,action:'move',to:b,productIds:['one']},products).value;
 applyCatalogConfig(cats,list,config);assert.equal(list[0].categoryPath,b);
 applyCatalogConfig(cats,list,config);assert.equal(cats.find(c=>c.path===b).products.length,1);
 applyCatalogConfig(cats,list,null);assert.equal(list[0].categoryPath,a);assert.ok(cats.find(c=>c.path===facet).products.includes(list[0].path));
 list[0].hidden=true;assert.equal(visibleCategories(cats,list).length,1);
});
