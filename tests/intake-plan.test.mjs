import test from 'node:test';
import assert from 'node:assert/strict';
import {editPlan,planFor,rollPlan,restorePlans} from '../src/intake-plan.ts';
const item={id:'a',time:'08:00',done:false};
const state=()=>({intake:[item],intakeDate:'2026-11-06',intakePlans:{}});
test('Future date edits remain isolated, persist and become today at rollover',()=>{
 const today=state();
 let s=editPlan(today,'2026-11-07',()=>[{...item,time:'12:00'}]);
 assert.deepEqual(s.intake,today.intake);
 s=JSON.parse(JSON.stringify(s));
 s.intakePlans=restorePlans(s.intakePlans,new Set(['a']));
 s=rollPlan(s,'2026-11-07');
 assert.equal(s.intake[0].time,'12:00');
 assert.equal(planFor(s,'2026-11-06')[0].time,'08:00');
 s=editPlan(s,'2026-11-08',()=>[item]);
 s=editPlan(s,'2026-11-08',()=>[]);
 assert.deepEqual(rollPlan(s,'2026-11-08').intake,[]);
 assert.equal(s.intake.length,1);
});
test('Legacy today and completion survive reload; missing days are empty',()=>{
 const s=state();s.intake[0]={...item,done:true};
 assert.equal(rollPlan(s,s.intakeDate),s);
 assert.deepEqual(planFor(s,'2027-01-01'),[]);
 const next=rollPlan(s,'2027-01-01');
 assert.equal(planFor(next,'2026-11-06')[0].done,true);
 assert.deepEqual(restorePlans({'2026-11-07':[null,{...item,time:'99:99'},{...item,id:'unknown'}]},new Set(['a'])),{'2026-11-07':[]});
});

test('Home completion promotes the fourth pending item, persists in both views and survives rollover',async()=>{
 const {homePlanPreview,completeHomePlan}=await import('../src/intake-plan.ts');
 const items=['a','b','c','d','e'].map((id,i)=>({id,time:i===4?'':`${String(8+i).padStart(2,'0')}:00`,done:false}));
 const valid=new Set(items.map(i=>i.id)),date='2026-11-16';
 let s={intake:items,intakeDate:date,intakePlans:{},intakeLog:{}};
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['a','b','c']);
 s=completeHomePlan(s,'b',date);
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['a','c','d']);
 assert.equal(planFor(s,date).find(i=>i.id==='b').done,true);
 assert.deepEqual(s.intakeLog[date],['b']);
 assert.equal(completeHomePlan(s,'b',date),s);
 assert.equal(completeHomePlan(s,'a','2026-11-17'),s);
 s=JSON.parse(JSON.stringify(s));
 assert.deepEqual(homePlanPreview(rollPlan(rollPlan(s,'2026-11-17'),date).intake,valid).map(i=>i.id),['a','c','d']);
 for(const item of s.intake)s=completeHomePlan(s,item.id,date);
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['a','b','c']);
 s=completeHomePlan(s,'e',date,false);
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['e','a','b']);
 assert.equal(s.intakeLog[date].includes('e'),false);
});

test('Four daily items keep three home rows after two, three or all four completions',async()=>{
 const {homePlanPreview,completeHomePlan}=await import('../src/intake-plan.ts');
 const intake=['a','b','c','d'].map(id=>({id,time:'08:00',done:false})),valid=new Set(intake.map(i=>i.id)),date='2026-11-16';
 let s={intake,intakeDate:date,intakePlans:{},intakeLog:{}};
 s=completeHomePlan(completeHomePlan(s,'a',date),'b',date);
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['c','d','a']);
 s=completeHomePlan(s,'c',date);
 assert.deepEqual(homePlanPreview(s.intake,valid).map(i=>i.id),['d','a','b']);
 s=completeHomePlan(s,'d',date);
 assert.equal(homePlanPreview(s.intake,valid).length,3);
 assert.ok(homePlanPreview(s.intake,valid).every(i=>i.done));
 assert.equal(homePlanPreview(s.intake.slice(0,2),valid).length,2);
 assert.equal(homePlanPreview([],valid).length,0);
});
