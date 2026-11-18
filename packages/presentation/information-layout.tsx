import type {ReactNode} from 'react';
import './information-pages.css';
import {useContext} from 'react';
import {BackLink,Icon,PagePath} from './ui';
import {data} from './store';
import {isTopLevel} from './page-navigation.mjs';
/** The nearest existing page above this one (a store page's parent is «Контакты», there is no store list). */
const parentOf=(path:string)=>{let q=path;do{q=q.replace(/[^/]+\/$/,'')||'/';}while(q!=='/'&&!isTopLevel(q)&&!data.pages.some(p=>p.path===q));return q;};
export function InformationHeader({title,kicker='NSP CENTER',description,image,alt='',dark=false,plain=false}:{title:string;kicker?:string;description?:string;image?:string;alt?:string;dark?:boolean;plain?:boolean}){
// «‹ Раздел» only on a page one step deeper than the top level (a document under «О компании», a store under
 // «Контакты»), back to that parent; pages right under the home page and the menu's pages have none (BackLink).
 const path=useContext(PagePath);const parent=parentOf(path);
 return <header className={`information-heading${image?' information-heading--photo':''}${dark?' information-heading--dark':''}${plain?' information-heading--plain':''}`} data-ds-id="information-heading"><div>{(parent!=='/'||isTopLevel(path)||['/photo/','/video/'].includes(path))&&<BackLink className={['/photo/','/video/'].includes(path)?'information-home phone-back-link':'information-home'} fallback={parent}/>}{kicker&&<span className="information-kicker">{kicker}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{image&&<img src={image} alt={alt} width="1536" height="1024" fetchPriority="high"/>}</header>;
}
export function InformationClosing({children}:{children?:ReactNode}){return <section className="information-closing" data-ds-id="information-help"><div><span className="information-kicker">РЯДОМ С ВАМИ</span><h2>Остались вопросы?</h2><p>{children||'Поможем разобраться в информации и выбрать удобный следующий шаг.'}</p></div><a className="information-button" href="/consultation/">Задать вопрос <Icon name="chevron" size={20}/></a></section>;}
