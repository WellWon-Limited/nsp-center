import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

const unavailable=res=>{if(res.headersSent)return res.destroy();res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Сервер временно недоступен. Попробуйте позже.'}));};
const hopByHop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
function cleanHeaders(headers){const excluded=new Set([...hopByHop,...String(headers.connection||'').toLowerCase().split(',').map(x=>x.trim())]);return Object.fromEntries(Object.entries(headers).filter(([k])=>!excluded.has(k)));}

export function createApiClient(origin=process.env.API_ORIGIN||'http://127.0.0.1:8701',socketPath=process.env.API_SOCKET){
  const base=new URL(socketPath?'http://localhost':origin);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('API_ORIGIN must be an HTTP(S) origin without credentials or a path');
  return {
    proxy(req,res){
      // Preserve the public host for origin checks. The API remains on a private listener.
      const headers=cleanHeaders(req.headers);
      headers['x-forwarded-host']=req.headers.host;
      headers['x-forwarded-for']=process.env.TRUST_PROXY==='1'&&req.headers['x-forwarded-for']
        ?String(req.headers['x-forwarded-for']).split(',')[0].trim():req.socket.remoteAddress||'';
      headers['x-forwarded-proto']=req.socket.encrypted?'https':process.env.TRUST_PROXY==='1'&&req.headers['x-forwarded-proto']==='https'?'https':'http';
      const target=new URL(base);target.pathname=req.url.split('?')[0];target.search=req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'';
      const upstream=(base.protocol==='https:'?httpsRequest:httpRequest)(target,{method:req.method,headers,...(socketPath?{socketPath}:{})},response=>{
        res.writeHead(response.statusCode,cleanHeaders(response.headers));response.pipe(res);
        response.on('error',()=>res.destroy());
      });
      upstream.setTimeout(60_000,()=>upstream.destroy());
      upstream.on('error',()=>unavailable(res));
      req.on('aborted',()=>upstream.destroy());
      res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});
      req.pipe(upstream);
    },
    async page(path){
      const url=new URL('/api/storefront/page',base);url.searchParams.set('path',path);
      if(socketPath)return new Promise((resolve,reject)=>{
        const req=httpRequest({socketPath,path:url.pathname+url.search,method:'GET'},res=>{
          if(res.statusCode!==200){res.resume();reject(new Error('Storefront API unavailable'));return;}
          const chunks=[];let size=0;
          res.on('data',chunk=>{size+=chunk.length;if(size>32*1024*1024){req.destroy(new Error('Storefront response too large'));return;}chunks.push(chunk);});
          res.on('error',reject);
          res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});
        });
        req.setTimeout(5000,()=>req.destroy(new Error('Storefront API timed out')));req.on('error',reject);req.end();
      });
      const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error('Storefront API unavailable');
      return response.json();
    }
  };
}
