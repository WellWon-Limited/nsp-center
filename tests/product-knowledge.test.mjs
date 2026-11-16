import test from 'node:test';
import assert from 'node:assert/strict';
import {applySite,applyContent,readSite} from '../src/site.ts';
import {readProductKnowledge} from '../src/product-knowledge.mjs';
import {knowledgeName,knownLectureAuthor,knownAuthorLinks} from '../scripts/product-knowledge.mjs';
const facts={about:['Растительные ингредиенты в питании.'],highlights:['Пищевая поддержка'],benefit:'Для разнообразия рациона',sources:[{id:'lecture',course:'Курс',lecture:'Растения',speaker:'Лектор'}],recommendations:[{area:'nutrition',reason:'Дополняет рацион.'}],pairs:[{productId:'other',why:'Поддержка питания.'}]};
test('knowledge is attributed and bounded before it enters public product objects',()=>{
 assert.equal(readProductKnowledge({...facts,sources:[]}),null);
 assert.equal(readProductKnowledge({...facts,about:[]}),null);
 assert.deepEqual(readProductKnowledge({...facts,recommendations:[{area:'random',reason:'x'}]}).recommendations,[]);
 assert.equal(knowledgeName('Люцерна (Alfalfa)'),'люцерна');
 assert.equal(knowledgeName('ЛЮЦЕРНА'),'люцерна');
});
test('one stored knowledge record reaches separate product copies and removing it restores built content',()=>{
 const base={id:'new',name:'Новый товар',prices:{retail:1000,partner:null},availability:'InStock',availability_text:'В наличии',copy:{about:['Исходное описание'],highlights:[]}};
 const a=structuredClone(base),b=structuredClone(base),site=readSite({knowledge:{new:facts}});
 applySite([a,b],site,100);
 for(const p of [a,b]){assert.deepEqual(p.copy.about,facts.about);assert.equal(p.card.sub,facts.benefit);assert.equal(p.knowledge.recommendations[0].area,'nutrition');assert.equal(p.knowledge.pairs[0].productId,'other');}
 applySite([a,b],null,100);
 assert.deepEqual(a.copy.about,['Исходное описание']);assert.equal(a.knowledge,undefined);
});
test('manually edited product description remains intact when knowledge or private card prices refresh',()=>{
 const p={id:'p',name:'Товар',prices:{retail:1000,partner:null},availability:'InStock',copy:{about:['Исходное'],highlights:[]},properties:{},documents:[]};
 const site=readSite({knowledge:{p:facts}});
 applySite([p],site,100);applyContent(p,{about:['Описание администратора']});
 applySite([p],site,100,{prices:{p:700}});
 assert.deepEqual(p.copy.about,['Описание администратора']);assert.equal(p.prices.partner,700);
 applyContent(p,null);assert.deepEqual(p.copy.about,facts.about);
});

test('attached expert notes reach product pages and card review counts, and disappear when removed',()=>{
 const original={speaker:'Первый автор',role:'Лектор',lecture:'Первая лекция',course:'Курс',text:'Сохранённый экспертный комментарий.'};
 const p={id:'p',name:'Товар',prices:{retail:1000,partner:null},availability:'InStock',experts:[original],card:{kicker:'',sub:'',parts:[],more:0,notes:1}};
 const expert={sourceId:'lecture',speaker:'Подмена',role:'Подмена',lecture:'Подмена',course:'Подмена',text:'Добавленный материал из выбранной лекции.'};
 const site=readSite({knowledge:{p:{...facts,experts:[expert]}}});
 applySite([p],site,100);
 assert.equal(p.experts.length,2);assert.equal(p.experts[1].speaker,'Лектор');assert.equal(p.experts[1].lecture,'Растения');assert.equal(p.card.notes,2);
 applySite([p],site,100);assert.equal(p.experts.length,2,'refresh does not duplicate expert notes');
 applySite([p],readSite({knowledge:{p:{...facts,experts:[]}}}),100);assert.deepEqual(p.experts,[original]);assert.equal(p.card.notes,1);
});

test('transcript parts and headings cannot be attached as expert authors',()=>{
 for(const value of ['','Часть 2','часть вторая','Запись вебинара','Урок','Автор лекции'])assert.equal(knownLectureAuthor(value),false,value);
 for(const value of ['Елена Бахтина','С. Федяева','С.Федяева','Аркадий Бибиков'])assert.equal(knownLectureAuthor(value),true,value);
});

test('manual descriptions need no fake sources and catalogue metadata takes the editor values',()=>{
 const manual=readProductKnowledge({about:['Текст администратора'],highlights:[],benefit:'Описание',recommendations:[],pairs:[],sources:[]});assert.ok(manual);
 const p={id:'p',name:'Исходное',prices:{retail:1000,partner:null},availability:'InStock',properties:{},card:{kicker:'',sub:'Старое',parts:[],more:0,notes:0}};
 applySite([p],readSite({knowledge:{p:manual},cards:{p:{name:'Новое',summary:'Короткая строка',package:'60 капсул'}}}),100);
 assert.equal(p.name,'Новое');assert.equal(p.card.sub,'Короткая строка');assert.equal(p.adminPackage,'60 капсул');
});

test('a missing transcript author is resolved only from an unambiguous known lecture or name',()=>{
 const rows=[{id:'known',lecture:'Сон как инструмент заботы о здоровье',speaker:'С. Федяева'},{id:'raw',lecture:'. Сон как инструмент заботы о здоровье. Федяева С.',speaker:''},{id:'unknown',lecture:'Неизвестный материал',speaker:'Часть 2'}];
 assert.deepEqual(knownAuthorLinks(rows),[{id:'raw',speaker:'С. Федяева'}]);
});
