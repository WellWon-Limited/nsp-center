import { createContext, useContext } from 'react';
import article from '../design/article-concepts/first-article.json';
import './article-variants.css';
import { BackLink, Icon } from './ui';

export const immuneArticleId=article.id;
export const immuneArticleCover='/images/article-concepts/virus-centered-v1.jpg';
export const articleVariants=[
 {id:'ivory',n:'01',name:'Большая обложка',detail:'Полноценная иллюстрация вируса, крупный заголовок и светлый текст статьи.',image:'virus-centered'},
 {id:'sage',n:'02',name:'Светлый разворот',detail:'Заголовок на светлом фоне, объёмная иллюстрация рядом и удобная колонка чтения.',image:'virus-sage'},
 {id:'forest',n:'03',name:'Сначала изображение',detail:'Широкая иллюстрация над заголовком, затем статья на тёплом светлом фоне.',image:'virus-forest'},
];
export type ArticleVariant=typeof articleVariants[number];
export const articleImage=(name:string)=>`/images/article-concepts/${name}-v1.jpg`;
function Original({html}:{html:string}){return <p dangerouslySetInnerHTML={{__html:html}}/>;}
function ArticleDesign({variant}:{variant:ArticleVariant}){return <div className={`av-document av-document--${variant.id}`} data-ds-id={`article-concept-${variant.id}`}>
 <header className="av-hero"><div className="av-hero-copy"><span className="av-journal-link"><BackLink fallback="/blog/"/></span><h1>{article.title}</h1><span className="av-date">{article.date}</span></div><img className="av-hero-image" src={articleImage(variant.image)} alt="Объёмная научная иллюстрация вирусной частицы" width="1536" height="1024" fetchPriority="high"/></header>
 <div className="av-reading-layout" id="article-reading"><div className="av-reading">
 <div className="av-lead"><Original html={article.paragraphs[0]}/></div><section id="article-habits" data-ds-id="article-habits"><h2>Образ жизни и иммунитет</h2><Original html={article.paragraphs[1]}/><figure className="av-inline-image"><img src={articleImage('nutrition-v2')} alt="Красный перец, брокколи, миндаль и зелёные листья — продукты к разделу о питании" width="1536" height="1024" loading="lazy"/></figure><Original html={article.paragraphs[2]}/></section>
 <section id="article-nutrition" data-ds-id="article-nutrition"><span className="av-section-number">01 / ПИТАНИЕ</span><h2>Роль питательных веществ</h2><Original html={article.paragraphs[3]}/><Original html={article.paragraphs[4]}/><div className="av-nutrient-lists" dangerouslySetInnerHTML={{__html:article.lists[0]+article.lists[1]}}/></section>
 <section id="article-products" data-ds-id="article-products"><span className="av-section-number">02 / ИЗ ТЕКСТА СТАТЬИ</span><h2>Продукты, упомянутые в статье</h2><Original html={article.paragraphs[5]}/><div className="av-original-list" dangerouslySetInnerHTML={{__html:article.lists[2]}}/><Original html={article.paragraphs[6]}/></section>
 <div className="av-end"><a href="/consultation/">Задать вопрос <Icon name="chevron" size={20}/></a></div>
 </div></div></div>;}

export const ImmuneArticleVariantContext=createContext<ArticleVariant>(articleVariants[0]);
export function ImmuneArticle(){const variant=useContext(ImmuneArticleVariantContext);return <ArticleDesign variant={variant}/>;}
