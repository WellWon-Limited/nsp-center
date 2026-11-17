import {Header} from './site-header';
import type { Product, Category, Article, ContentPage } from './content-types';
import { useEffect, useLayoutEffect, useState } from 'react';
import { data, StoreProvider, useStore } from './store';
import { Catalog, ProductDetail } from './catalog';
import { Home, Blog, ArticlePage, InfoPage, DesignSystem } from './pages';
import { Profile, Health, Diagnostic } from './personal';
import { Cart } from './cart';
import { Checkout } from './checkout';
import {CustomerOrders} from './customer-orders';
import { Purchases } from './purchases';
import { installHomeScrollEdges } from './home-scroll-edges.mjs';
import { installHomeReveal } from './home-reveal.mjs';
import { BackLink, Heading, Icon, PagePath, RichContent, SiteBackdrop, useCameFrom } from './ui';
import { ThemePage } from './theme-page';
import { themeByPath, themes, type Theme } from './themes';
import { InstallBanner, useIntakeReminders } from './pwa';
import { AssistantChat } from './assistant';
import { ownsBackLink } from './page-navigation.mjs';
import { homeStoryReturn } from './home-story-navigation.mjs';
export type PageData={theme?:Theme;productThemes?:Theme[];product?:Product;category?:Category;article?:Article;page?:ContentPage;homeHtml?:string;homeReviewsHtml?:string};
export const extraRoutes=[{url:'/consultation/',title:'Консультация'},{url:'/health/',title:'Моё здоровье'},{url:'/profile/',title:'Профиль'},{url:'/cart/',title:'Корзина'},{url:'/checkout/',title:'Оформление заказа'},{url:'/profile/purchases/',title:'Мои покупки'},{url:'/profile/orders/',title:'Мои заказы'},{url:'/design-system/',title:'Дизайн-система NSP'},...themes.map(theme=>({url:theme.path,title:theme.title}))];
export function normalizeUrl(value:string){const u=new URL(value,'http://nsp.local');return u.pathname.replace(/\/{2,}/g,'/').replace(/([^/])$/,'$1/')+u.search;}
export function metadata(url:string){const u=new URL(url,'http://nsp.local');const route=data.routes.find(r=>r.url===u.pathname+u.search)||data.routes.find(r=>r.path===u.pathname);const extra=extraRoutes.find(r=>r.url===u.pathname);const product=data.products.find(p=>p.path===u.pathname);const article=data.articles.find(a=>a.path===u.pathname);const page=data.pages.find(p=>p.path===u.pathname);const theme=themeByPath(u.pathname);return {title:route?.title||extra?.title||article?.title||product?.name||'Страница не найдена',description:theme?.description||article?.description||page?.description|| (product?`${product.name}. Цена, наличие, состав, применение и сертификаты в NSP Center.`:'NSP Center — натуральные продукты, витамины и уход. Каталог, составы, статьи и информация о доставке.'),product,article};}
function Footer({phone}:{phone:boolean}){return <footer className={`site-footer${phone?'':' site-footer--computer-only'}`} data-ds-id="site-footer"><div className="footer-main"><div className="footer-top"><div className="footer-brand"><div className="brand"><span className="brand-mark"><img src="/icons/icon.svg" alt="Логотип NSP" width="48" height="48"/></span><span>NSP Center</span></div><p>Внимание к себе.<br/>Каждый день.</p><a href="tel:+79626854838">{data.site.phones[0]}</a><a href={`mailto:${data.site.emails[0]}`}>{data.site.emails[0]}</a></div><div><h3>Продукты</h3>{data.categories.filter(c=>c.parent==='/catalog/').map(c=><a href={c.path} key={c.id}>{c.name}</a>)}<a href="/catalog/">Весь каталог</a></div><div><h3>Информация</h3>{[['/company/','О компании'],['/delivery/','Доставка'],['/payments/','Оплата'],['/company/faq/','Частые вопросы'],['/contacts/','Контакты'],['/shares/','Акции']].map(([p,t])=><a href={p} key={p}>{t}</a>)}</div><div><h3>Узнать больше</h3>{[['/blog/','Журнал'],['/company/sertifikaty/','Сертификаты'],['/company/reviews/','Отзывы'],['/photo/','Фотогалерея'],['/video/','Видеогалерея'],['/health-marafon/','Марафон здоровья'],['/diagnostic-test/','Тест-рекомендации']].map(([p,t])=><a href={p} key={p}>{t}</a>)}</div></div><div className="footer-address"><Icon name="truck" size={19}/><p>{data.site.address}</p></div></div><div className="footer-legal"><div className="footer-legal-inner"><div className="footer-bottom"><span>© NSP Center · Independent distributor Shkola Oleg</span><a href="/company/consent/">Конфиденциальность</a><a href="/company/privacy-policy/">Публичная оферта</a><a href="/company/refund/">Условия возврата</a></div><p className="fine-print">БАД не является лекарственным средством.</p></div></div></footer>;}
function BottomNav({path}:{path:string}){const items=[['/','home','Главная'],['/catalog/','grid','Каталог'],['/consultation/','message','Консультация'],['/health/','pulse','План'],['/profile/','user-separated','Профиль']];return <nav className="bottom-nav" aria-label="Навигация приложения" data-ds-id="mobile-navigation">{items.map(([href,icon,label])=>{const active=href==='/'?path==='/':path.startsWith(href)||(href==='/health/'&&path==='/health-marafon/');return <a key={href} href={href} aria-label={label} aria-current={active?'page':undefined}><span><Icon name={icon} size={26}/></span></a>;})}</nav>;}
// «Есть вопрос?»: the chat alone, wide and in the middle of the page (owner, 2026-11-13: the direct contacts moved to
// the home page's pickup-point block, src/contact-card.tsx); a phone shows the chat full-screen (consultation.css).
// Coming from the home page's «Задать вопрос» or story, the way back to that place on the home page.
function ConsultReturn(){const [back,setBack]=useState<string|null>(null);useEffect(()=>{setBack(homeStoryReturn(location.href));},[]);return back?<BackLink fallback={back}/>:null;}
function Consultation(){return <div className="consult-page" data-ds-id="consultation"><header className="consult-heading"><ConsultReturn/><Heading level="h2" eyebrow="NSP Center" title="Консультация" description="Спросите об ассортименте, сертификатах или оформлении покупки."/></header><div className="consult-layout"><AssistantChat/></div></div>;}
function RouteView({url,pageData}:{url:string;pageData?:PageData}){const path=new URL(url,'http://nsp.local').pathname;if(path==='/')return <Home homeHtml={pageData?.homeHtml} homeReviewsHtml={pageData?.homeReviewsHtml}/>;if(path==='/cart/'||path==='/personal/basket/')return <Cart/>;if(path==='/checkout/')return <Checkout url={url}/>;if(path==='/profile/purchases/')return <Purchases/>;if(path==='/profile/orders/')return <CustomerOrders/>;if(path==='/profile/'||path==='/personal/profile/')return <Profile/>;if(path==='/consultation/')return <Consultation/>;if(path==='/health/'||path==='/health-marafon/')return <Health marathon={path==='/health-marafon/'}/>;if(path==='/diagnostic-test/')return <Diagnostic/>;if(path==='/design-system/')return <DesignSystem/>;if(path==='/blog/')return <Blog/>;if(themeByPath(path))return pageData?.theme?<ThemePage theme={pageData.theme}/>:<Heading title={themeByPath(path)!.h1}/>;const target=data.redirects[path]||path;const product=pageData?.product||data.products.find(p=>p.path===target);if(product)return <ProductDetail product={product} themes={pageData?.productThemes}/>;const category=pageData?.category||data.categories.find(c=>c.path===path);if(category)return <Catalog category={category} url={url}/>;const article=pageData?.article||data.articles.find(a=>a.path===path);if(article)return <ArticlePage article={article}/>;const page=pageData?.page||data.pages.find(p=>p.path===path);if(page)return <InfoPage page={page}/>;return <section className="not-found empty-screen" data-ds-id="not-found"><h1>Страница не найдена</h1></section>;}
// Plan reminders run on every page while the app is open (pwa.tsx).
function Reminders(){useIntakeReminders();return null;}
// Pages without a back link of their own get one at the top when they were opened from another page of the site (see
// BackLink: it is named after that page). Main tabs (catalog, plan, profile) show it only when opened from the home page;
// the home page, the chat and the company page show none.

const noBack=(p:string)=>p==='/'||p==='/consultation/'||p==='/company/';
const tabs=(p:string)=>p.startsWith('/catalog/')||p==='/health/'||p==='/health-marafon/'||p==='/profile/'||p==='/blog/';
// A tab reached through the site navigation (bottom bar, header, menu, logo) gets no back link even from the home page;
// only a link on the home page itself (e.g. «Перейти к товарам») leads to a tab with «На главную». main.tsx marks such
// navigation in sessionStorage ('nsp-center:via-nav').
function PageBack({url}:{url:string}){const u=new URL(url,'http://nsp.local');const p=u.pathname;const from=useCameFrom();const [viaNav,setViaNav]=useState(false);
 useEffect(()=>{try{setViaNav(sessionStorage.getItem('nsp-center:via-nav')===p);sessionStorage.removeItem('nsp-center:via-nav');}catch{/* ignore */}},[p]);
 if((['/profile/','/personal/profile/'].includes(p)&&u.searchParams.get('admin')==='1')||['plan','marathon'].includes(u.searchParams.get('from')??'')||ownsBackLink(p)||noBack(p)||(tabs(p)&&viaNav))return null;
 // One step up: a catalog section's own parent section, else the address one level shorter. A page right under the
 // home page shows the link only when the visitor came from a page the site can name (e.g. the test from the plan).
 const section=data.categories.find(c=>c.path===p);const parent=section?.parent??(p.replace(/[^/]+\/$/,'')||'/');
 if(parent==='/'&&!from)return null;return <BackLink fallback={parent} className={['/profile/purchases/','/profile/orders/'].includes(p)?'back-link phone-back-link':'back-link'}/>;}
// The footer (links, contacts, seller, "БАД не является лекарственным средством") is on every page on a computer, as in
// the first design (owner, 2026-11-12). On a phone the personal app screens — sign-in and profile, «Мои покупки», the
// plan — and the chat end without it, as in shop apps (owner, 2026-11-10): those get a class that hides it there.
const PHONE_NO_FOOTER=new Set(['/consultation/','/profile/','/personal/profile/','/profile/purchases/','/profile/orders/','/health/']);
export const footerOnPhone=(path:string)=>!PHONE_NO_FOOTER.has(path);
// The page colour beyond the bottom edge of every page (src/home-scroll-edges.mjs), installed once for the whole site.
function ScrollEdges(){useEffect(()=>installHomeScrollEdges(window,document),[]);useEffect(()=>installHomeReveal(window,document),[]);return null;}
export function App({url,pageData}:{url:string;pageData?:PageData}){const path=new URL(url,'http://nsp.local').pathname;const accountRoute=['/cart/','/personal/basket/','/profile/','/personal/profile/'].includes(path);return <StoreProvider><ScrollEdges/><Reminders/><InstallBanner/><a className="skip-link" href="#main">К содержимому</a><SiteBackdrop/><Header path={path}/><main id="main" className={`site-main${accountRoute?' site-main--account-route':''}`}><PagePath.Provider value={path}><PageBack url={url}/><RouteView url={url} pageData={pageData}/></PagePath.Provider></main><Footer phone={footerOnPhone(path)}/><BottomNav path={path}/></StoreProvider>;}
