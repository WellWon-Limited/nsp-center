import {ADMIN_PATH} from '../../packages/presentation/admin-path.mjs';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {data,shortName} from '../../packages/presentation/store';
import type {SiteSettings} from '../../packages/presentation/site';
import {initialCatalogConfig} from '../../packages/presentation/catalog-categories.mjs';
import {RequiredLabel,RequiredHint} from './admin-form';
import {Icon} from '../../packages/presentation/ui';
import './admin-categories.css';

type Run=(path:string,body:unknown,done:string,onError?:(message:string)=>void)=>Promise<boolean>;
function CategoryDialog({title,busy,onClose,children}:{title:string;busy:boolean;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();dialog.querySelector<HTMLElement>('input,select')?.focus({preventScroll:true});return()=>{if(dialog.open)dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 return <dialog ref={ref} className="admin-category-dialog" aria-labelledby="category-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onClick={event=>{if(event.target!==event.currentTarget||busy)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}><header><h2 id="category-dialog-title">{title}</h2><button className="icon-btn" type="button" disabled={busy} aria-label="Закрыть окно категории" onClick={onClose}><Icon name="close" size={20}/></button></header>{children}</dialog>;
}
export function CategoriesSection({site,run}:{site:SiteSettings;run:Run}){
 const config=site.catalog??initialCatalogConfig(data.categories),categories=config.categories.filter(c=>!c.archived);
 const [selected,setSelected]=useState(''),[query,setQuery]=useState(''),[checked,setChecked]=useState<string[]>([]),[to,setTo]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[parent,setParent]=useState('/catalog/'),[removing,setRemoving]=useState(''),[moveTo,setMoveTo]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const members=selected?new Set(data.categories.find(c=>c.path===selected)?.products??[]):null;
 const products=data.products.filter(p=>(!members||members.has(p.path))&&`${p.name} ${p.article??''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 const execute=async(body:Record<string,unknown>,message:string)=>{setBusy(true);setError('');try{return await run('/api/admin/categories',{...body,revision:config.revision},message,setError);}catch{setError('Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.');return false;}finally{setBusy(false);}};
 const edit=(path:string)=>{const c=categories.find(c=>c.path===path);setError('');setEditing(path);setName(c?.name??'');setParent(c?.parent??'/catalog/');};
 const count=(path:string)=>{const paths=new Set(data.categories.find(c=>c.path===path)?.products??[]);return data.products.filter(p=>!p.hidden&&paths.has(p.path)).length;};
 const descendant=(path:string,ancestor:string)=>{const seen=new Set<string>();for(let c=categories.find(c=>c.path===path);c&&!seen.has(c.path);c=categories.find(p=>p.path===c?.parent)){if(c.path===ancestor)return true;seen.add(c.path);}return false;};
 const hasChildren=categories.some(c=>c.parent===removing);
 const removingMembers=removing?data.categories.find(c=>c.path===removing)?.products.length??0:0;
 return <section className="admin-category-manager" data-ds-id="admin-categories">
  <div className="admin-category-intro"><p>Выберите категорию, чтобы посмотреть её товары. Пустые категории сохраняются здесь и появляются на сайте, когда в них есть опубликованные товары.</p><button type="button" className="btn btn--primary" onClick={()=>edit('')}><Icon name="plus" size={18}/>Новая категория</button></div>
  {error&&editing===null&&!removing&&<p className="admin-error" role="alert">{error}</p>}
  <div className="admin-category-grid"><nav className="panel admin-category-list" aria-label="Категории в управлении"><button className={!selected?'is-active':''} onClick={()=>{setSelected('');setChecked([]);}}>Все товары <span>{data.products.length}</span></button>{categories.map(c=><div className="admin-category-row" key={c.path}><button className={selected===c.path?'is-active':''} onClick={()=>{setSelected(c.path);setChecked([]);}}><span>{c.parent!=='/catalog/'?'— ':''}{c.name}<small>{count(c.path)?`${count(c.path)} на сайте`:'Скрыта: нет товаров на сайте'}</small></span></button><button className="text-button" onClick={()=>edit(c.path)} aria-label={`Изменить категорию: ${c.name}`}>Изменить</button></div>)}</nav>
   <section className="panel admin-category-products"><div className="admin-category-products-heading"><h2>{categories.find(c=>c.path===selected)?.name??'Все товары'}</h2><span>{products.length} товаров</span></div><input className="field" type="search" placeholder="Название или артикул" aria-label="Поиск товаров для переноса" value={query} onChange={e=>setQuery(e.target.value)}/>
    <label className="admin-category-select-all"><input type="checkbox" checked={products.length>0&&products.every(p=>checked.includes(p.id))} onChange={e=>setChecked(e.target.checked?products.map(p=>p.id):[])}/>Выбрать товары в списке</label>
    <div className="admin-category-transfer"><label>Переместить выбранные<select className="field" value={to} onChange={e=>setTo(e.target.value)}><option value="">Выберите категорию</option>{categories.map(c=><option key={c.path} value={c.path}>{c.name}</option>)}</select></label><button className="btn btn--primary" disabled={busy||!checked.length||!to} onClick={async()=>{if(await execute({action:'move',to,productIds:checked},'Товары перенесены'))setChecked([]);}}>Перенести ({checked.length})</button></div>
    <ul className="admin-category-product-list">{products.map(p=><li key={p.id}><label><input type="checkbox" checked={checked.includes(p.id)} onChange={e=>setChecked(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/><span><strong>{shortName(p.name)}</strong><small>Артикул {p.article??'не указан'} · {p.hidden?'Скрыт с сайта':p.availability==='OutOfStock'?'Нет в наличии':'В наличии'}<br/>{p.category}</small></span></label><a href={`${ADMIN_PATH}?section=products&product=${p.id}`}>Редактировать</a></li>)}</ul>{!products.length&&<p className="ds-muted">В этой категории пока нет товаров.</p>}
   </section>
  </div>
  {editing!==null&&<CategoryDialog title={editing?'Изменить категорию':'Новая категория'} busy={busy} onClose={()=>{if(!busy)setEditing(null);}}><form className="admin-category-form" onSubmit={async event=>{event.preventDefault();if(await execute({action:editing?'rename':'create',path:editing,name,parent},editing?'Категория изменена':'Категория создана'))setEditing(null);}}>
   <RequiredHint/><label><RequiredLabel>Название</RequiredLabel><input className="field" required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label>
   <label>Родительская категория<select className="field" value={parent} onChange={e=>setParent(e.target.value)}><option value="/catalog/">Основная категория</option>{categories.filter(c=>!editing||!descendant(c.path,editing)).map(c=><option value={c.path} key={c.path}>{c.name}</option>)}</select></label>
   <p className="field-hint">{editing?'Название обновится в каталоге на сайте и телефоне. Адрес категории сохранится.':'После создания категория будет доступна для добавления и переноса товаров. Покупатели увидят её, когда появится опубликованный товар.'}</p>
   {error&&<p className="admin-error" role="alert">{error}</p>}
   <div className="admin-category-dialog-actions">{editing&&<button type="button" className="text-button admin-category-remove" disabled={busy} onClick={()=>{setRemoving(editing);setEditing(null);setMoveTo('');setError('');}}>Удалить категорию</button>}<button type="button" className="btn btn--secondary" disabled={busy} onClick={()=>setEditing(null)}>Отмена</button><button className="btn btn--primary" disabled={busy||name.trim().length<2}>{busy?'Сохраняем…':editing?'Сохранить изменения':'Создать категорию'}</button></div>
  </form></CategoryDialog>}
  {removing&&<CategoryDialog title={`Удалить «${categories.find(c=>c.path===removing)?.name}»?`} busy={busy} onClose={()=>{if(!busy)setRemoving('');}}><form className="admin-category-form" onSubmit={async event=>{event.preventDefault();if(await execute({action:'delete',path:removing,to:moveTo},'Категория удалена; товары сохранены')){setSelected('');setRemoving('');}}}>
   <p>{hasChildren?'Сначала перенесите вложенные категории в другой раздел. Товары и подкатегории не будут удалены.':removingMembers?'Товары сохранятся. Выберите, в какую категорию их перенести. Старый адрес будет вести в выбранный раздел.':'Категория пуста. Её удаление не затронет товары.'}</p>
   {!hasChildren&&removingMembers>0&&<RequiredHint/>}
   {!hasChildren&&<label><RequiredLabel required={removingMembers>0}>Перенести товары в</RequiredLabel><select className="field" required={removingMembers>0} value={moveTo} onChange={e=>setMoveTo(e.target.value)}><option value="">{removingMembers?'Выберите категорию':'Без переноса — категория пуста'}</option>{categories.filter(c=>!descendant(c.path,removing)).map(c=><option key={c.path} value={c.path}>{c.name}</option>)}</select></label>}
   {error&&<p className="admin-error" role="alert">{error}</p>}
   <div className="admin-category-dialog-actions"><button type="button" className="btn btn--secondary" disabled={busy} onClick={()=>setRemoving('')}>Отмена</button><button className="btn btn--danger" disabled={busy||hasChildren||(removingMembers>0&&!moveTo)}>Удалить категорию</button></div>
  </form></CategoryDialog>}
 </section>;
}
