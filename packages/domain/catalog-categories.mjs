import {slugOf} from './custom-product.mjs';

const ROOT='/catalog/';
const safePath=value=>typeof value==='string'&&/^\/catalog\/(?:[a-z0-9-]+\/)*$/.test(value);
export function readCatalogConfig(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.categories)||value.categories.length>200)return null;
 const categories=value.categories.map(c=>({path:c?.path,name:String(c?.name??'').trim(),parent:c?.parent??ROOT,archived:c?.archived===true,redirectTo:c?.redirectTo??ROOT}));
 if(categories.some(c=>!safePath(c.path)||c.path===ROOT||c.name.length<2||c.name.length>100||!safePath(c.parent)||!safePath(c.redirectTo)))return null;
 if(new Set(categories.map(c=>c.path)).size!==categories.length)return null;
 const byPath=new Map(categories.map(c=>[c.path,c]));
 for(const c of categories.filter(c=>!c.archived)){let path=c.parent;const seen=new Set([c.path]);while(path!==ROOT){const p=byPath.get(path);if(!p||p.archived||seen.has(path)||seen.size>10)return null;seen.add(path);path=p.parent;}}
 const assignments=Object.fromEntries(Object.entries(value.assignments??{}).filter(([id,path])=>/^[a-z0-9-]{1,120}$/.test(id)&&byPath.has(path)&&!byPath.get(path).archived));
 return {revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0,categories,assignments};
}
export function initialCatalogConfig(categories){return {revision:0,categories:categories.filter(c=>c.path!==ROOT).map(c=>({path:c.path,name:c.name.trim(),parent:c.parent??ROOT,archived:false,redirectTo:ROOT})),assignments:{}};}

/** One primary category per product; ancestors contain it as well. Paths survive a rename. */
export function resolveCatalog(categories,products,value){
 const model=readCatalogConfig(value)??initialCatalogConfig(categories);
 const base=new Map(categories.map(c=>[c.path,c]));
 const root=base.get(ROOT)??{id:'catalog',path:ROOT,url:ROOT,name:'Все продукты',description:'',html:'',parent:null,children:[],products:[],pagination:[],breadcrumbs:[]};
 const next=[{...root,products:[],children:[]} ,...model.categories.filter(c=>!c.archived).map(c=>({...base.get(c.path),id:base.get(c.path)?.id??c.path.split('/').filter(Boolean).at(-1),path:c.path,url:c.path,name:c.name,parent:c.parent,description:base.get(c.path)?.description??'',html:base.get(c.path)?.html??'',children:[],products:[],pagination:base.get(c.path)?.pagination??[],breadcrumbs:[]}))];
 const byPath=new Map(next.map(c=>[c.path,c]));
 const chain=path=>{const result=[];for(let c=byPath.get(path);c&&c.path!==ROOT;c=byPath.get(c.parent))result.unshift(c);return result;};
 const unassigned=new Set(products.filter(p=>!model.assignments[p.id]).map(p=>p.path));
 // Imported catalog facets may overlap a primary category (for example «Системы организма»).
 // Preserve those memberships until an administrator explicitly moves the product.
 const members=new Map(next.map(c=>[c.path,new Set((base.get(c.path)?.products??[]).filter(path=>unassigned.has(path)))]));
 const updated=products.map(p=>{
  const path=model.assignments[p.id]??p.categoryPath;
  const sections=chain(path),own=sections.at(-1);
  members.get(ROOT).add(p.path);for(const c of sections)members.get(c.path).add(p.path);
  return {...p,categoryPath:own?.path??ROOT,category:sections.map(c=>c.name).join('/'),catalogPaths:next.filter(c=>members.get(c.path).has(p.path)).map(c=>c.path),breadcrumbs:[{name:'Главная',url:'/'},...sections.map(c=>({name:c.name,url:c.path})),{name:p.name,url:null}]};
 });
 for(const c of next){const paths=members.get(c.path);c.products=[...new Set([...(base.get(c.path)?.products??[]).filter(path=>paths.has(path)),...paths])];c.children=next.filter(x=>x.parent===c.path).map(x=>x.path);c.breadcrumbs=[{name:'Главная',url:'/'},...chain(c.path).map(x=>({name:x.name,url:x.path===c.path?null:x.path}))];}
 return {categories:next,products:updated,config:model};
}
const categoryBases=new WeakMap(),productBases=new WeakMap();
export function applyCatalogConfig(categories,products,config){
 if(!categoryBases.has(categories))categoryBases.set(categories,structuredClone(categories));
 const originals=products.map(p=>{if(!productBases.has(p))productBases.set(p,{categoryPath:p.categoryPath,category:p.category,breadcrumbs:p.breadcrumbs});return {...p,...productBases.get(p)};});
 const result=resolveCatalog(categoryBases.get(categories),originals,config);
 categories.splice(0,categories.length,...result.categories);
 products.forEach((p,i)=>{p.categoryPath=result.products[i].categoryPath;p.category=result.products[i].category;p.breadcrumbs=result.products[i].breadcrumbs;});
}
export function visibleCategories(categories,products){
 const available=new Set(products.filter(p=>!p.hidden).map(p=>p.path));
 return categories.filter(c=>c.path===ROOT||c.products.some(path=>available.has(path)));
}

/** Changes are validated on the server against all products, including hidden cards. */
export function changeCatalogConfig(config,operation,products){
 const model=structuredClone(config),active=()=>model.categories.filter(c=>!c.archived);
 if(operation.revision!==model.revision)return {error:'Категории уже изменились в другом окне. Обновите список и повторите действие.',status:409};
 if(operation.action==='create'){
  const name=String(operation.name??'').trim(),parent=operation.parent??ROOT;
  if(name.length<2||name.length>100)return {error:'Название категории — от 2 до 100 символов.'};
  if(parent!==ROOT&&!active().some(c=>c.path===parent))return {error:'Выберите существующую родительскую категорию.'};
  if(active().some(c=>c.parent===parent&&c.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))return {error:'Такая категория уже существует.'};
  let path=ROOT+slugOf(name)+'/';for(let n=2;model.categories.some(c=>c.path===path);n++)path=ROOT+slugOf(name)+'-'+n+'/';
  model.categories.push({path,name,parent,archived:false,redirectTo:ROOT});
 }else if(operation.action==='rename'){
  const c=active().find(c=>c.path===operation.path),name=String(operation.name??'').trim();if(!c)return {error:'Категория не найдена.'};
  if(name.length<2||name.length>100)return {error:'Название категории — от 2 до 100 символов.'};
  c.name=name;c.parent=operation.parent??c.parent;
  if(active().some(x=>x.path!==c.path&&x.parent===c.parent&&x.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))return {error:'Такая категория уже существует.'};
 }else if(operation.action==='move'){
  if(!active().some(c=>c.path===operation.to))return {error:'Выберите категорию назначения.'};
  const ids=operation.productIds;if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>!products.some(p=>p.id===id)))return {error:'Выберите товары для переноса.'};
  for(const id of ids)model.assignments[id]=operation.to;
 }else if(operation.action==='delete'){
  const c=active().find(c=>c.path===operation.path);if(!c)return {error:'Категория не найдена.'};
  if(active().some(x=>x.parent===c.path))return {error:'Сначала перенесите или удалите вложенные категории.'};
  if(operation.to&&!active().some(x=>x.path===operation.to&&x.path!==c.path))return {error:'Выберите существующую категорию для переноса.'};
  const members=products.filter(p=>p.catalogPaths?.includes(c.path)||(model.assignments[p.id]??p.categoryPath)===c.path);
  if(members.length&&!active().some(x=>x.path===operation.to&&x.path!==c.path))return {error:'В категории есть товары. Выберите, куда их перенести.'};
  for(const p of members)model.assignments[p.id]=operation.to;
  c.archived=true;c.redirectTo=operation.to||ROOT;
 }else return {error:'Неизвестное действие.'};
 model.revision++;
 const checked=readCatalogConfig(model);return checked?{value:checked}:{error:'Нельзя переместить категорию внутрь самой себя или её подкатегории.'};
}
