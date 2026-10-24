import {pathToFileURL} from 'node:url';

export function deploymentOrigin(value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Supply an HTTPS site origin without a path, credentials or query.');return url.origin;
}

// Read-only checks and a rejected foreign-origin request. No sign-in, secrets,
// market/LLM fetch, account mutation, polling, load test or paid request.
export async function checkDeployment(value,{fetcher=fetch}={}){
 const origin=deploymentOrigin(value),checks=[],configuration={};
 async function check(name,path,accept,init={}){
  try{const response=await fetcher(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000),...init});const result=await accept(response);checks.push({name,passed:result===true});}
  catch{checks.push({name,passed:false});}
 }
 await check('health and configured capabilities','/.netlify/functions/health',async r=>{if(r.status!==200)return false;const h=await r.json();if(h.application!=='ASAF TRADING PRO'||h.status!=='ok'||typeof h.version!=='string')return false;
  configuration.version=h.version;for(const key of ['publicAuthEnabled','durableQuotaEnabled','freeAIEnabled','paidAIEnabled','googleAuthEnabled','publicMarketDataEnabled','backgroundMarketRefreshConfigured','newsEnabled'])configuration[key]=h[key]===true;
  return r.headers.get('cache-control')?.includes('no-store')&&h.publicAuthEnabled===true&&h.durableQuotaEnabled===true&&h.paidAIEnabled===false;
 });
 const tasks=[
  ['homepage security headers','/',r=>r.status===200&&r.headers.get('x-content-type-options')==='nosniff'&&r.headers.get('x-frame-options')==='SAMEORIGIN'],
  ['data-use explanation','/data-privacy.html',r=>r.status===200&&r.headers.get('x-content-type-options')==='nosniff'],
  ['anonymous workspace rejected','/.netlify/functions/workspace',r=>r.status===401],
  ['anonymous alerts rejected','/.netlify/functions/alerts',r=>r.status===401],
  ['anonymous account rejected','/.netlify/functions/account',r=>r.status===401],
  ['model route rejects GET','/.netlify/functions/free-chat',r=>r.status===405],
  ['legacy private market route retired in account mode','/.netlify/functions/market',r=>r.status===410,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}],
  ['admin job route rejects GET','/.netlify/functions/run-market-jobs',r=>r.status===405],
  ['foreign-origin workspace write rejected','/.netlify/functions/workspace',r=>r.status===403,{method:'PUT',headers:{origin:'https://foreign-origin.invalid','content-type':'application/json'},body:'{}'}]
 ];
 for(let i=0;i<tasks.length;i+=4)await Promise.all(tasks.slice(i,i+4).map(args=>check(...args)));
 return {origin,operational:checks.every(c=>c.passed),checks,configuration,scope:'Anonymous deployment checks only; signed-in save/load, real-device mobile, licensed data, schedules and host billing controls require separate acceptance.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=await checkDeployment(process.argv[2]||'https://joyful-seahorse-967889.netlify.app');console.log(JSON.stringify(report,null,2));process.exitCode=report.operational?0:1;}
 catch{console.error('Deployment check failed. Supply a valid HTTPS origin. No credentials are required.');process.exitCode=1;}
}
