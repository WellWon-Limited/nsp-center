import {homedir} from 'node:os';
import {join} from 'node:path';
import {createAccounts} from './accounts.mjs';
import {productBase} from './site-admin.mjs';
import {createAi} from './ai-agent.mjs';
import {createCdek} from './cdek.mjs';
import {storefrontPage} from './storefront.mjs';

const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};

/** No frontend files, HTML renderer, or database credentials are needed by consumers of this API. */
export async function createApi({content,env=process.env,accountsOptions={}}){
  const accounts=await createAccounts({databaseUrl:env.DATABASE_URL,
    productIds:new Set(content.products.map(p=>p.id)),
    productBase:id=>productBase(content.products.find(p=>p.id===id)),
    cardProducts:content.products,buildRate:content.pricing.rubPerUnit,
    categories:content.categories,knowledgeThemes:content.themes,cbr:env.CBR_ENABLED!=='0',
    articlePaths:content.articles.map(a=>a.path),
    lectureCorpusFile:env.AI_CORPUS_FILE||join(homedir(),'.local/state/nsp-center/lecture-corpus.jsonl'),
    ...accountsOptions});
  const ai=createAi({content,env,pool:accounts.enabled?accounts.pool:null});
  const cdek=createCdek({clientId:env.CDEK_CLIENT_ID||'',clientSecret:env.CDEK_CLIENT_SECRET||'',base:env.CDEK_API_BASE||'https://api.cdek.ru/v2',yandexKey:env.YANDEX_MAPS_KEY||''});
  return {
    close:()=>accounts.close(),
    async handle(req,res){
      try{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{service:'nsp-api',databaseConfigured:accounts.enabled});
        if(url.pathname==='/api/storefront/page'){
          if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
          if(!accounts.enabled)return json(res,200,{enabled:false});
          const path=url.searchParams.get('path')||'';
          if(!/^\/(?:sitemap\.xml|catalog\/(?:[a-z0-9-]+\/)*|(?:product|blog)\/[a-z0-9-]+\/)$/.test(path))return json(res,400,{error:'Invalid page path'});
          await accounts.ready();
          return json(res,200,{enabled:true,...await storefrontPage(accounts.pool,content,path)});
        }
        if(url.pathname.startsWith('/api/ai/'))return await ai.handle(req,res,url);
        if(url.pathname==='/api/cdek')return await cdek.handle(req,res,url);
        if(url.pathname.startsWith('/api/'))return await accounts.handle(req,res,url);
        return json(res,404,{error:'Not found'});
      }catch{
        if(!res.headersSent)json(res,503,{error:'Сервис временно недоступен. Попробуйте позже.'});
        else res.destroy();
      }
    }
  };
}
