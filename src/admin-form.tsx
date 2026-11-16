import {useEffect,type ReactNode} from 'react';

export function RequiredMark(){return <span className="admin-required-mark" aria-hidden="true"> *</span>}
export function RequiredLabel({children,required=true}:{children:ReactNode;required?:boolean}){return <span className="admin-required-label">{children}{required&&<RequiredMark/>}</span>}
export function RequiredHint(){return <p className="admin-required-help"><RequiredMark/> — обязательные поля.</p>}
/** Browsers own the confirmation text; only warn while the current product draft differs from its saved version. */
export function useUnsavedProduct(dirty:boolean){useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])}
