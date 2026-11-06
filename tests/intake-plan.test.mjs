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
