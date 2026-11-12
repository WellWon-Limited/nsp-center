import { Fragment, useEffect, useState } from 'react';
import './hero-heading.css';

// Keep a visit to another tab from replaying the entrance; a document reload resets it.
let entrancePlayed = false;
const lines = ['Забота о себе', 'в вашем ритме'];

export function HeroHeading() {
 const [animate] = useState(() => !entrancePlayed);
 useEffect(() => { entrancePlayed = true; try { sessionStorage.setItem('nsp-center:hero-played', '1'); } catch { /* plays again next time */ } }, []);
 let wordIndex = 0;
 return <h1 aria-label="Забота о себе в вашем ритме" className={animate ? 'hero-heading--enter' : undefined}>
  {lines.map((line, lineIndex) => <Fragment key={line}>
   {lineIndex > 0 && ' '}
   <span className={`hero-title-line${lineIndex ? ' hero-title-line--end' : ''}`}>
    {line.split(' ').map((word, index) => <Fragment key={word}>
     {index > 0 && ' '}
     <span className="hero-title-word" style={{ animationDelay: `${wordIndex++ * 160}ms` }}>{word}</span>
    </Fragment>)}
   </span>
  </Fragment>)}
 </h1>;
}
