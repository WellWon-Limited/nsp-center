import {useEffect,type ReactNode} from 'react';

export function RequiredMark(){return <span className="admin-required-mark" aria-hidden="true"> *</span>}
export function RequiredLabel({children,required=true}:{children:ReactNode;required?:boolean}){return <span className="admin-required-label">{children}{required&&<RequiredMark/>}</span>}
export function RequiredHint(){return <p className="admin-required-help"><RequiredMark/> — обязательные поля.</p>}
/** Browsers own the confirmation text; only warn while the current product draft differs from its saved version. */
export function useUnsavedProduct(dirty:boolean){useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])}

export function AdminBackButton({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" className="back-link admin-back-link admin-products-back" onClick={onClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>{children}</button>}
