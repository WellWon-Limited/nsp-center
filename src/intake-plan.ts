export type PlanItem = {id:string;time:string;done:boolean};
export type PlanState = {intake:PlanItem[];intakeDate:string;intakePlans:Record<string,PlanItem[]>};
export function planFor(s:PlanState,date:string):PlanItem[]{return date===s.intakeDate?s.intake:s.intakePlans[date]||[];}
export function editPlan<T extends PlanState>(s:T,date:string,edit:(items:PlanItem[])=>PlanItem[]):T{
 const items=edit(planFor(s,date));
 return {...s,intake:date===s.intakeDate?items:s.intake,intakePlans:{...s.intakePlans,[date]:items}};
}
export function rollPlan<T extends PlanState>(s:T,date:string):T{
 if(s.intakeDate===date)return s;
 return {...s,intakeDate:date,intake:s.intakePlans[date]||[],intakePlans:{...s.intakePlans,...(s.intakeDate?{[s.intakeDate]:s.intake}:{})}};
}
export function restorePlans(value:unknown,valid:Set<string>):Record<string,PlanItem[]>{
 if(!value||typeof value!=='object')return {};
 return Object.fromEntries(Object.entries(value).filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Array.isArray(v)).map(([d,v])=>[d,(v as PlanItem[]).filter(x=>x&&valid.has(x.id)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)).map(x=>({id:x.id,time:x.time,done:x.done===true}))]));
}
