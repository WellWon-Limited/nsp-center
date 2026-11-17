import { Fragment, useEffect, useRef, useState } from 'react';
import './hero-heading.css';

// Keep a visit to another tab from replaying the entrance; a document reload resets it.
let entrancePlayed = false;
const lines = ['Забота о себе', 'в вашем ритме'];
export const HOME_PRODUCTS_REPLAY='nsp:home-products';

export function HeroHeading() {
 const [animate,setAnimate] = useState(() => !entrancePlayed);
 const [replay,setReplay]=useState(0);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(() => { entrancePlayed = true; try { sessionStorage.setItem('nsp-center:hero-played', '1'); } catch { /* plays again next time */ } }, []);
 useEffect(()=>{
  let observer:IntersectionObserver|undefined;
  const requestReplay=()=>{
   observer?.disconnect();
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){setAnimate(false);return;}
   const node=heading.current;if(!node)return;
   const start=()=>{observer?.disconnect();setAnimate(true);setReplay(n=>n+1);};
   const header=document.querySelector('.site-header')?.getBoundingClientRect().height||0,r=node.getBoundingClientRect();
   if(r.top>=header&&r.bottom<=innerHeight*.9||typeof IntersectionObserver==='undefined'){start();return;}
   observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{rootMargin:`-${Math.round(header)}px 0px -10% 0px`,threshold:.7});
   observer.observe(node);
  };
  window.addEventListener(HOME_PRODUCTS_REPLAY,requestReplay);
  return()=>{observer?.disconnect();window.removeEventListener(HOME_PRODUCTS_REPLAY,requestReplay);};
 },[]);
 let wordIndex = 0;
 return <h1 ref={heading} aria-label="Забота о себе в вашем ритме" className={animate ? `hero-heading--enter${replay?' hero-heading--replay':''}` : undefined}>
  {lines.map((line, lineIndex) => <Fragment key={line}>
   {lineIndex > 0 && ' '}
   <span className={`hero-title-line${lineIndex ? ' hero-title-line--end' : ''}`}>
    {line.split(' ').map((word, index) => <Fragment key={word}>
     {index > 0 && ' '}
     <span key={replay} className="hero-title-word" style={{ animationDelay: `${wordIndex++ * 160}ms` }}>{word}</span>
    </Fragment>)}
   </span>
  </Fragment>)}
 </h1>;
}
