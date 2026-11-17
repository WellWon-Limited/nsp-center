import {layoutScale} from '../../../packages/presentation/layout-scale.mjs';
import {useLayoutEffect,useRef} from 'react';
import {CompanyContent} from './company-content';
import {InformationHeader} from '../../../packages/presentation/information-layout';
import './company-page.css';
import './company-about-variants.css';
import './company-paper.css';

export function CompanyPage(){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const el=root.current,img=el?.querySelector<HTMLImageElement>('.co-paper-cover img');if(!el||!img)return;
  let frame=0,disposed=false;
  const fit=()=>{if(disposed)return;const top=img.getBoundingClientRect().top+window.scrollY;img.style.setProperty('--company-cover-height',`${Math.max(140,Math.min(window.innerWidth<960?300:620,Math.floor((window.innerHeight-top-(window.innerWidth<960?88:24))/layoutScale(img))))}px`)};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  const observer=new ResizeObserver(schedule);for(const n of el.querySelectorAll('.information-heading,.co-article-lead'))observer.observe(n);
  fit();document.fonts.ready.then(schedule);window.addEventListener('resize',schedule);img.addEventListener('load',schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);img.removeEventListener('load',schedule)};
 },[]);
 return <div ref={root} className="company-page company-page--nature company-page--paper" data-ds-id="page-company"><InformationHeader title="О компании" kicker="NSP Center" plain/><CompanyContent/></div>;
}
