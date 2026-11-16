export const APP_RESUME_TIMEOUT_MS:number;
export const RESUME_PAGE_KEY:string;
export function readResumePage(storage:Storage):{url:string;at:number;scroll:number}|null;
export function absenceExpired(leftAt:number,now:number,timeout?:number):boolean;
export function resetResumeNavigation(storage:Storage):void;
export function installAppResume(win:Window,doc:Document,options?:{now?:()=>number;timeoutMs?:number}):()=>void;
