import {createHash} from 'node:crypto';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {recommendationAreas} from '../src/recommendation-areas.mjs';
export const KNOWLEDGE_SCHEMA=`
create table if not exists knowledge_lectures(id text primary key,course text not null,lecture text not null,speaker text not null,body text not null default '');
alter table knowledge_lectures add column if not exists search_vector tsvector generated always as (to_tsvector('russian',course || ' ' || lecture || ' ' || speaker || ' ' || body)) stored;
create index if not exists knowledge_lectures_search_idx on knowledge_lectures using gin(search_vector);
create table if not exists knowledge_products(id text primary key,name text not null,article text,data jsonb not null);
create table if not exists product_knowledge(product_id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table if not exists knowledge_imports(key text primary key,fingerprint text not null);
`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const trim=(s,n=3000)=>String(s??'').trim().slice(0,n);
export const knowledgeName=name=>trim(name).replace(/\([^)]*\)/g,'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
/** Reject transcript headings accidentally parsed as an author's name. */
export const knownLectureAuthor=name=>{
 const value=trim(name,300);
 if(!value||/\d|част[ьи]|продолжени|запис[ьи]|раздел|глава|урок|вебинар|серия/iu.test(value))return false;
 return /(?:[А-ЯЁA-Z]\.\s*|[А-ЯЁA-Z][а-яёa-z-]+\s+)(?:[А-ЯЁA-Z][а-яёa-z-]+)/u.test(value)||/[А-ЯЁA-Z][а-яёa-z-]+\s+[А-ЯЁA-Z]\./u.test(value);
};
const source=s=>{const course=trim(s.course,300),lecture=trim(s.lecture,300),speaker=trim(s.speaker,300);return {id:hash([course,lecture,speaker].join('|')).slice(0,32),course,lecture,speaker}};
export async function seedKnowledge(pool,{products=[],themes=[],corpusFile}={}){
 const fingerprint=hash(JSON.stringify([recommendationAreas,products.map(p=>[p.id,p.name,p.article,p.copy,p.experts]),themes]));
 const previous=await pool.query('select fingerprint from knowledge_imports where key=$1',['compiled']);
 if(previous.rows[0]?.fingerprint!==fingerprint){
  const lectures=new Map(),entries=[];
  for(const p of products){
   const ownThemes=themes.filter(t=>t.mainProductId===p.id),notes=p.experts??[];
   const citations=[...notes,...ownThemes.flatMap(t=>t.sources??[])].filter(s=>s.lecture).map(s=>{const ref=source(s);if(!lectures.has(ref.id))lectures.set(ref.id,{...ref,body:s.text??''});return ref});
   const sources=[...new Map(citations.map(s=>[s.id,s])).values()];if(!sources.length)continue;
   const recommendations=Object.entries(recommendationAreas).flatMap(([area,d])=>d.products.filter(([id])=>id===p.id).map(([,reason])=>({area,reason})));
   const pairs=[...new Map(ownThemes.flatMap(t=>t.pairs??[]).map(x=>[x.productId,x])).values()];
   const about=p.copy?.about?.length?p.copy.about:ownThemes[0]?.lead?[ownThemes[0].lead]:[];
   const data={sourceProductId:p.id,about,highlights:p.copy?.highlights??[],benefit:String(p.card?.sub||p.copy?.highlights?.[0]||ownThemes[0]?.description||'').slice(0,150),recommendations,pairs,sources};
   entries.push({id:p.id,name:p.name,article:p.article??'',data});
  }
  await writeLectures(pool,[...lectures.values()],false);
  if(entries.length)await pool.query(`insert into knowledge_products(id,name,article,data) select id,name,article,data from jsonb_to_recordset($1::jsonb) as x(id text,name text,article text,data jsonb) on conflict(id) do update set name=excluded.name,article=excluded.article,data=excluded.data`,[JSON.stringify(entries)]);
  await pool.query("insert into knowledge_imports values('compiled',$1) on conflict(key) do update set fingerprint=excluded.fingerprint",[fingerprint]);
 }
 if(corpusFile&&existsSync(corpusFile)){
  const info=statSync(corpusFile),stamp=`${info.size}:${info.mtimeMs}`;
  if((await pool.query("select fingerprint from knowledge_imports where key='transcripts'")).rows[0]?.fingerprint!==stamp){
   const lectures=new Map();
   for(const line of readFileSync(corpusFile,'utf8').split('\n')){if(!line.trim())continue;let row;try{row=JSON.parse(line)}catch{continue}if(!row.lecture||!row.text)continue;const ref=source(row);let current=lectures.get(ref.id);if(!current){current={...ref,body:''};lectures.set(ref.id,current)}current.body+=(current.body?'\n\n':'')+String(row.text);}
   await writeLectures(pool,[...lectures.values()],true);
   await pool.query("insert into knowledge_imports values('transcripts',$1) on conflict(key) do update set fingerprint=excluded.fingerprint",[stamp]);
  }
 }
 await enrichLectureAuthors(pool);
}
async function writeLectures(pool,rows,replace){
 for(let i=0;i<rows.length;i+=30)await pool.query(`insert into knowledge_lectures(id,course,lecture,speaker,body) select id,course,lecture,speaker,body from jsonb_to_recordset($1::jsonb) as x(id text,course text,lecture text,speaker text,body text) on conflict(id) do update set body=${replace?'excluded.body':"case when length(knowledge_lectures.body)>length(excluded.body) then knowledge_lectures.body else excluded.body end"}`,[JSON.stringify(rows.slice(i,i+30))]);
}
export async function inheritedKnowledge(pool,{knowledgeSourceId,name,article}){
 if(knowledgeSourceId){const r=await pool.query('select data from knowledge_products where id=$1',[knowledgeSourceId]);return r.rows[0]?.data??null;}
 const {rows}=await pool.query('select name,article,data from knowledge_products');
 const matches=rows.filter(p=>(article&&p.article===article)||knowledgeName(p.name)===knowledgeName(name));
 return matches.length===1?matches[0].data:null;
}
export async function checkKnowledge(pool,input,knownProduct){
 if(!input||typeof input!=='object')return {error:'Заполните сведения из лекций.'};
 const about=Array.isArray(input.about)?input.about.map(s=>trim(s,2000)).filter(Boolean).slice(0,12):[];
 const highlights=Array.isArray(input.highlights)?input.highlights.map(s=>trim(s,500)).filter(Boolean).slice(0,12):[];
 const benefit=trim(input.benefit,300);
 if(!about.length)return {error:'Добавьте связное описание пользы товара по источнику.'};
 const rec=Array.isArray(input.recommendations)?input.recommendations:[];
 if(rec.length>13||rec.some(r=>!recommendationAreas[r?.area]||!trim(r.reason,800)))return {error:'Выберите направление и объясните, почему товар подходит.'};
 const pairs=Array.isArray(input.pairs)?input.pairs:[];
 if(pairs.length>12)return {error:'Добавьте не больше 12 сочетаний.'};
 for(const p of pairs)if(!trim(p.why,800)||!(await knownProduct(p.productId)))return {error:'Для каждого сочетания выберите существующий товар и пояснение.'};
 const ids=Array.isArray(input.sources)?[...new Set(input.sources.map(s=>s?.id).filter(id=>typeof id==='string'))]:[];
 if(ids.length>20||(!ids.length&&(rec.length||pairs.length||(Array.isArray(input.experts)&&input.experts.length))))return {error:'Для рекомендаций, сочетаний и отзывов укажите лекции-источники.'};
 const {rows}=await pool.query('select id,course,lecture,speaker from knowledge_lectures where id=any($1::text[])',[ids]);
 if(rows.length!==ids.length)return {error:'Одна из лекций не найдена в базе.'};
 const expertInput=Array.isArray(input.experts)?input.experts:[];
 if(expertInput.length>10)return {error:'Добавьте не больше 10 отзывов экспертов.'};
 const experts=[];
 for(const item of expertInput){
  const lecture=rows.find(s=>s.id===item?.sourceId);
  if(!lecture||!knownLectureAuthor(lecture.speaker))return {error:'Для отзыва эксперта прикрепите лекцию с указанным автором.'};
  const body=trim(item.text,2000);if(body.length<10)return {error:'Заполните текст отзыва эксперта — не меньше 10 знаков.'};
  if(experts.some(e=>e.sourceId===lecture.id))return {error:'Объедините информацию из одной лекции в один отзыв эксперта.'};
  experts.push({sourceId:lecture.id,speaker:lecture.speaker,role:'Автор лекции',course:lecture.course,lecture:lecture.lecture,text:body});
 }

 return {value:{...(typeof input.sourceProductId==='string'?{sourceProductId:input.sourceProductId}:{}),about,highlights,benefit,recommendations:[...new Map(rec.map(r=>[r.area,{area:r.area,reason:trim(r.reason,800)}])).values()],pairs:[...new Map(pairs.map(p=>[p.productId,{productId:p.productId,why:trim(p.why,800)}])).values()],experts,sources:rows.map(row=>{const q=trim(input.sources.find(s=>s?.id===row.id)?.query,120);return {...row,...(q?{query:q}:{})}})}};
}

const SEARCH_OPTIONS='StartSel=<nsp-match>, StopSel=</nsp-match>, MaxWords=48, MinWords=24, MaxFragments=2';
const CONTEXT_OPTIONS='StartSel=<nsp-match>, StopSel=</nsp-match>, MaxWords=220, MinWords=100, MaxFragments=1';
/** Full-text Russian word forms; all query text is a bound value, never SQL or HTML. */
export async function searchLectures(pool,input,pageInput=1){
 const query=trim(input,120),page=Math.max(1,Math.min(100,Math.floor(Number(pageInput))||1)),limit=8;
 if(query.length<2)return {query,page,total:0,results:[],hasMore:false};
 const {rows:[result]}=await pool.query(`
 with q as (select plainto_tsquery('russian',$1) as terms),
 matches as materialized (
   select l.id, ts_rank(l.search_vector,q.terms) as relevance
   from knowledge_lectures l cross join q
   where l.search_vector @@ q.terms
     or strpos(lower(l.lecture || ' ' || l.speaker),lower($1))>0
     or strpos(lower(l.body),lower($1))>0
 ), selected as (
   select l.id,l.course,l.lecture,l.speaker,
     ts_headline('russian',l.body,q.terms,$4) as excerpt
   from matches m join knowledge_lectures l on l.id=m.id cross join q
   order by m.relevance desc,l.lecture,l.id limit $2 offset $3
 )
 select (select count(*)::int from matches) as total,
   coalesce((select jsonb_agg(to_jsonb(selected)) from selected),'[]'::jsonb) as results`,[query,limit,(page-1)*limit,SEARCH_OPTIONS]);
 return {query,page,total:result.total,results:result.results.map(row=>({...row,authorKnown:knownLectureAuthor(row.speaker),speaker:knownLectureAuthor(row.speaker)?row.speaker:''})),hasMore:page*limit<result.total};
}
export async function lectureContext(pool,id,input=''){
 const query=trim(input,120);
 const {rows}=await pool.query(`select id,course,lecture,speaker,
   case when $2='' then left(body,8000) else ts_headline('russian',body,plainto_tsquery('russian',$2),$3) end as excerpt
   from knowledge_lectures where id=$1`,[id,query,CONTEXT_OPTIONS]);
 return rows[0]?{...rows[0],speaker:knownLectureAuthor(rows[0].speaker)?rows[0].speaker:'',query}:null;
}
/** Keep the editor's description and its knowledge record in one database transaction. */
export async function saveProductKnowledge(pool,id,knowledge,content={}){
 const client=await pool.connect();
 try{
  await client.query('begin');
  if(knowledge)await client.query('insert into product_knowledge(product_id,data) values($1,$2) on conflict(product_id) do update set data=excluded.data,updated_at=now()',[id,JSON.stringify(knowledge)]);
  await client.query(`insert into product_content(product_id,data) values($1,$2) on conflict(product_id) do update set data=product_content.data || excluded.data,updated_at=now()`,[id,JSON.stringify({...content,...(knowledge?{about:knowledge.about,highlights:knowledge.highlights}:{})})]);
  await client.query('commit');
 }catch(error){await client.query('rollback');throw error}finally{client.release()}
}

/** Recover missing author metadata only from an unambiguous curated lecture or a known name written in the title. */
export async function enrichLectureAuthors(pool){
 const {rows}=await pool.query('select id,lecture,speaker from knowledge_lectures');
 const updates=knownAuthorLinks(rows);
 for(const update of updates)await pool.query('update knowledge_lectures set speaker=$1 where id=$2',[update.speaker,update.id]);
 return updates.length;
}
export function knownAuthorLinks(rows){
 const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я]/g,'');
 const known=rows.filter(s=>knownLectureAuthor(s.speaker));
 const aliases=name=>{const words=name.match(/[А-ЯЁA-Z][а-яёa-z-]+|[А-ЯЁA-Z]\./g)??[];if(words.length!==2)return [norm(name)];const [a,b]=words;const family=a.endsWith('.')?b:a.length>b.length&&b.endsWith('.')?a:b;const given=family===a?b:a;return [norm(name),norm(family+given[0]),norm(given[0]+family)]};
 return rows.filter(s=>!knownLectureAuthor(s.speaker)).flatMap(row=>{
  const title=norm(row.lecture);
  const titleMatches=known.filter(s=>{const key=norm(s.lecture);return key.length>=24&&(title===key||title.startsWith(key)||key.startsWith(title)&&title.length>=24)});
  let matches=[...new Set(titleMatches.map(s=>s.speaker))];
  if(matches.length!==1)matches=[...new Set(known.filter(s=>aliases(s.speaker).some(alias=>alias.length>=7&&title.includes(alias))).map(s=>s.speaker))];
  return matches.length===1?[{id:row.id,speaker:matches[0]}]:[];
 });
}
