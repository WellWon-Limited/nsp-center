import type {ReactNode} from 'react';
import './information-pages.css';
import {BackLink,Icon} from './ui';
export function InformationHeader({title,kicker='NSP CENTER',description,image,alt='',dark=false,plain=false}:{title:string;kicker?:string;description?:string;image?:string;alt?:string;dark?:boolean;plain?:boolean}){
 return <header className={`information-heading${image?' information-heading--photo':''}${dark?' information-heading--dark':''}${plain?' information-heading--plain':''}`} data-ds-id="information-heading"><div><BackLink className="information-home" fallback="/" label="На главную"/>{kicker&&<span className="information-kicker">{kicker}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{image&&<img src={image} alt={alt} width="1536" height="1024" fetchPriority="high"/>}</header>;
}
export function InformationClosing({children}:{children?:ReactNode}){return <section className="information-closing" data-ds-id="information-help"><div><span className="information-kicker">РЯДОМ С ВАМИ</span><h2>Остались вопросы?</h2><p>{children||'Поможем разобраться в информации и выбрать удобный следующий шаг.'}</p></div><a className="information-button" href="/consultation/">Задать вопрос <Icon name="chevron" size={20}/></a></section>;}
