import test from 'node:test';
import assert from 'node:assert/strict';
import {previewProduct} from '../src/admin-preview-data.mjs';
const original={id:'aloe',name:'Алоэ',properties:{'Объём':'473 мл','Форма выпуска':'Жидкость'},sectionsHtml:{Описание:'Исходный текст'},sections:{Описание:'Исходный текст'},copy:{about:['Исходное описание'],highlights:[]},documents:[{name:'Исходный',url:'/cert.jpg'}],prices:{retail:1000,partner:null},image:'/original.png',hidden:true};
const saved={name:'Сохранённое название',about:['Описание из базы'],properties:{Состав:'Алоэ'},photos:['/saved.png','/side.png'],documents:[{name:'Новый сертификат',url:'/saved-cert.jpg'}],videos:[{title:'Видео',url:'https://youtu.be/abcdefghijk'}],summary:'Сохранённое назначение'};
test('changing just the price preserves all previously saved content, media and certificates',()=>{
 const baseline=structuredClone({original,saved});const p=previewProduct(original,{...original,prices:{retail:1560,partner:null}},saved);
 assert.equal(p.prices.retail,1560);assert.equal(p.name,saved.name);assert.deepEqual(p.copy.about,saved.about);assert.deepEqual(p.adminPhotos,saved.photos);assert.deepEqual(p.adminVideos,saved.videos);assert.equal(p.documents[0].url,'/saved-cert.jpg');assert.equal(p.properties['Объём'],'473 мл');assert.equal(p.properties.Состав,'Алоэ');assert.equal(p.hidden,false);assert.deepEqual({original,saved},baseline,'preview cannot mutate the actual catalog');
});
test('partial changes replace only their fields; intentionally removed media does not reappear',()=>{
 const p=previewProduct(original,original,saved,{name:'Новое имя',properties:{Состав:'Обновлённый состав'},photos:[],documents:[],videos:[]});
 assert.equal(p.name,'Новое имя');assert.equal(p.properties.Состав,'Обновлённый состав');assert.equal(p.properties['Форма выпуска'],'Жидкость');assert.deepEqual(p.copy.about,saved.about);assert.deepEqual(p.adminPhotos,[]);assert.equal(p.adminImage,'');assert.deepEqual(p.documents,[]);assert.deepEqual(p.adminVideos,[]);
});
test('an unsaved description updates catalog summary and preserves saved media',()=>{
 const p=previewProduct(original,original,saved,{about:['Новый абзац'],summary:'Новое назначение'});assert.deepEqual(p.copy.about,['Новый абзац']);assert.equal(p.card.sub,'Новое назначение');assert.deepEqual(p.adminPhotos,saved.photos);assert.equal(p.documents[0].url,'/saved-cert.jpg');
});
