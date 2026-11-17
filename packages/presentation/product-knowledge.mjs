import {recommendationAreas} from './recommendation-areas.mjs';
/** Only curated, attributed knowledge reaches product cards and recommendation selections. */
export function readProductKnowledge(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.about)||!Array.isArray(input.sources))return null;
 const strings=(a,max)=>Array.isArray(a)?a.filter(x=>typeof x==='string').map(s=>s.slice(0,max)).filter(Boolean):[];
 const about=strings(input.about,2000).slice(0,12),sources=input.sources.filter(s=>s&&typeof s.id==='string'&&typeof s.lecture==='string'&&s.lecture).map(s=>({id:s.id,lecture:s.lecture,course:typeof s.course==='string'?s.course:'',speaker:typeof s.speaker==='string'?s.speaker:'',...(typeof s.query==='string'&&s.query?{query:s.query.slice(0,120)}:{})})).slice(0,20);
 if(!about.length||(!sources.length&&((input.recommendations?.length??0)||(input.pairs?.length??0)||(input.experts?.length??0))))return null;
 const experts=(Array.isArray(input.experts)?input.experts:[]).filter(e=>e&&typeof e.sourceId==='string'&&sources.some(s=>s.id===e.sourceId&&s.speaker)&&typeof e.text==='string'&&e.text.trim().length>=10).slice(0,10).map(e=>{const s=sources.find(s=>s.id===e.sourceId);return {sourceId:s.id,speaker:s.speaker,role:'Автор лекции',course:s.course,lecture:s.lecture,text:e.text.slice(0,2000)}});
 return {experts,sourceProductId:typeof input.sourceProductId==='string'?input.sourceProductId:undefined,about,highlights:strings(input.highlights,500).slice(0,12),benefit:typeof input.benefit==='string'?input.benefit.slice(0,300):'',sources,recommendations:(Array.isArray(input.recommendations)?input.recommendations:[]).filter(r=>r&&recommendationAreas[r.area]&&typeof r.reason==='string'&&r.reason).map(r=>({area:r.area,reason:r.reason.slice(0,800)})).slice(0,13),pairs:(Array.isArray(input.pairs)?input.pairs:[]).filter(p=>p&&typeof p.productId==='string'&&typeof p.why==='string'&&p.why).map(p=>({productId:p.productId,why:p.why.slice(0,800)})).slice(0,12)};
}
