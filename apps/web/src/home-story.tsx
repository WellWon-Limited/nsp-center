import { useEffect, useRef } from 'react';
import { Icon, RichContent } from '../../../packages/presentation/ui';
import { ContactCard } from './contact-card';
import './home-story.css';
import { homeStoryLinks } from '../../../packages/presentation/home-story-navigation.mjs';

const chapters = [
 {id:'care', title:'Забота о себе каждый день', marker:'', photo:'botanical', alt:'Свежая мята, мелисса и цитрус на светлом зелёном фоне'},
 {id:'service', title:'Покупателям NSP Center', marker:'<p> Акции и скидки для каждого клиента </p>'},
 {id:'catalog', title:'Категории и рубрики', marker:'<p> Популярные категории </p>'},
 {id:'answers', title:'Вопрос — ответ', marker:'<p> Вопрос - ответ </p>'},
 {id:'reading', title:'Статьи', marker:'<p> Акции </p>'},
 {id:'reviews', title:'Отзывы покупателей', marker:'<p> Отзывы </p>'},
 {id:'company', title:'О компании', marker:'<h2>О компании</h2>'},
 {id:'contacts', title:'Пункт выдачи заказов', marker:'<p> Пункт выдачи заказов </p>'},
];
const topicTitles = new Set(['Сильный иммунитет','Очистка организма','Бросающим курить','Похудение','Здоровье ваших глаз','Декоративная косметика','Спортивное питание','Натуральная косметика','Наборы','Популярные категории','Рубрики']);

// Section bodies come from the imported, sanitized source.
export function homeStorySections(source:string){
 let html=source.replace(/\s+/g,' ');
 // Keep the category/article link when its old banner is removed.
 html=html.replace(/<a([^>]+)>\s*(?:<p>\s*)?<img\b[^>]*>\s*(?:<\/p>\s*)?<\/a>\s*<h3>([\s\S]*?)<\/h3>/g,'<h3><a$1>$2</a></h3>');
 html=html.replace(/<a([^>]+)>\s*<img\b[^>]*>\s*<\/a>\s*<p>\s*<span>([\s\S]*?)<\/span>/g,'<p><a$1>$2</a>');
 html=html.replace(/<img\b[^>]*>/g,'');
 for(let i=0;i<3;i++)html=html.replace(/<(p|a)\b[^>]*>\s*<\/\1>/g,'');
 const sections=chapters.map((chapter,index)=>{
  const start=index===0?0:html.indexOf(chapter.marker);
  const next=chapters[index+1];const end=next?html.indexOf(next.marker):html.length;
  if(start<0||end<0)return null;
  let body=html.slice(start,end);
  if(['answers','reviews','company','contacts'].includes(chapter.id))body=body.replace(chapter.marker,'');
  body=body.replace(/<p>\s*([^<>]+)\s*<\/p>/g,(tag,text:string)=>topicTitles.has(text.trim())||text.trim().endsWith('?')?`<h3>${text.trim()}</h3>`:tag);
  if(chapter.id==='service')body=body.replace(/<p>\s*Акции и скидки для каждого клиента\s*<\/p>/,'');
  if(chapter.id==='reading'){
   body=body.replace(/<p>\s*(Акции|Статьи)\s*<\/p>/g,'');
   body=body.replace(/<p>\s*(<a[^>]*>[\s\S]*?<\/a>)\s*([^<]+)<\/p>/g,'<h3>$1</h3><p>$2</p>');
   body=body.replace(/(<a[^>]*>[^<]*<\/a>)\s*(?=<p>)/g,(match,link,offset,full)=>full.slice(0,offset).endsWith('<h3>')?match:`<h3>${link}</h3>`);
  }
  if(chapter.id==='reviews')body=body.replace(/<p>\s*<a[^>]*>\s*Показать все\s*<\/a>\s*<\/p>/,'');
  if(chapter.id==='contacts')body=body.replace(/<p>\s*(Адрес:|Телефон:|Электронная почта:)\s*<\/p>\s*<p>([\s\S]*?)<\/p>/g,'<p><strong>$1</strong> $2</p>');
  return {...chapter,html:body};
 });
 // If the imported source changes structure, retain its text instead of dropping it.
 if(sections.some(s=>!s))return [{...chapters[0],html}];
 return sections.filter((s):s is NonNullable<typeof s>=>s!==null).filter(s=>!['care','catalog'].includes(s.id));
}

type StoryItem = {title:string;html:string};
function storyItems(html:string):StoryItem[]{
 return [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/g)].map(match=>({title:match[1].replace(/<[^>]*>/g,''),html:match[2]}));
}

export function HomeStory({html}:{html:string;reviewsHtml?:string}){
 const block=useRef<HTMLElement>(null);
 // The block is always open (owner, 2026-11-10); a return from one of its links (/#about-reviews) lands on that part.
 useEffect(()=>{
  const restore=()=>{
   const id=decodeURIComponent(location.hash.slice(1));
   if(!/^about-(service|answers|reading|reviews|company|contacts)$/.test(id)&&id!=='home-about')return;
   const target=id==='home-about'?block.current:block.current?.querySelector<HTMLElement>(`#${id}`);
   if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}));
  };
  restore();addEventListener('hashchange',restore);addEventListener('pageshow',restore);
  return()=>{removeEventListener('hashchange',restore);removeEventListener('pageshow',restore);};
 },[]);
 const sections=homeStorySections(html);
 const content=(id:string)=>sections.find(section=>section.id===id)?.html||'';
 const questions=storyItems(content('answers'));
 const reviews=storyItems(content('reviews'));
 const benefits=[...content('service').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(match=>match[1]);
 return <section ref={block} id="home-about" className="home-story home-story--selected home-story--open" data-ds-id="home-source" aria-labelledby="home-about-title">
  <div className="section-heading home-story-heading"><div><span className="ds-kicker">Знакомство</span><h2 id="home-about-title">О NSP Center</h2></div></div>
  <article className="home-story-layout">
   <section id="about-service" className="story-introduction" data-ds-id="home-about-service">
    <img className="story-panorama" src="/images/home-about/careful-packing-v1.jpg" alt="Руки бережно упаковывают заказ в крафтовую коробку у окна" width="1536" height="1024" loading="lazy" decoding="async"/>
    <div id="about-company" className="story-intro-card" data-ds-id="home-about-company">
     <span className="story-eyebrow">NSP CENTER</span>
     <h2>Забота о себе.<br/>С вниманием к деталям.</h2>
     <p>Продукты NSP, помощь с выбором и бережная доставка. Здесь — ответы на ваши вопросы и информация о нашем центре.</p>
     <a className="btn btn--primary story-company-link" href="/company/?from=home-about&section=company">О компании<Icon name="chevron" size={20}/></a>
    </div>
    <div className="story-benefits">{benefits.map((body,index)=><div className="story-benefit" key={index}><Icon name="check" size={22}/><RichContent html={`<p>${body}</p>`}/></div>)}</div>
   </section>
   <section id="about-answers" className="story-section story-faq" data-ds-id="home-about-answers"><h2>Что важно знать</h2>
    {questions.length?questions.map((question,index)=><details key={index}><summary>{question.title}<span aria-hidden="true" className="story-faq-plus"/></summary><RichContent html={homeStoryLinks(question.html,'answers')}/></details>):<RichContent html={homeStoryLinks(content('answers'),'answers')}/>}
   </section>
   <section id="about-reviews" className="story-section story-reviews" data-ds-id="home-about-reviews"><h2>Отзывы покупателей</h2>
    <div className="story-review-grid">{reviews.length?reviews.map((review,index)=><article className="story-review" key={index}><span className="story-quote" aria-hidden="true">“</span><div><RichContent html={review.html}/><h3>{review.title}</h3></div></article>):<RichContent html={content('reviews')}/>}</div>
    <a className="story-reviews-link" href="/company/reviews/?from=home-about&section=reviews">Все отзывы<Icon name="chevron" size={20}/></a>
   </section>
   <section id="about-contacts" className="story-section story-pickup story-pickup--forest" data-ds-id="home-about-contacts">
    <div className="story-pickup-address"><div className="story-pickup-heading"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M26 13c0 8-10 16-10 16S6 21 6 13a10 10 0 1 1 20 0Z"/><circle cx="16" cy="13" r="3.5"/></svg><h2>Пункт выдачи заказов</h2></div><p className="story-pickup-city">Санкт-Петербург</p><p className="story-pickup-street">Набережная<br/>Обводного канала, 64</p><p className="story-pickup-details">Корп. 2, лит. А, офис 29/3<br/>2-й этаж</p></div>
    <div className="story-pickup-info"><a href="tel:+78124673585">+7 (812) 467-35-85</a><a href="mailto:sales@nsp-center.ru">sales@nsp-center.ru</a><a className="btn btn--primary" href="/contacts/?from=home-about&section=contacts">Как нас найти<Icon name="chevron" size={20}/></a></div>
    <ContactCard className="story-pickup-card" address={false} heading="h3"/>
   </section>
  </article>
 </section>;
}
