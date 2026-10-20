// No active schedule is installed. Enable the reviewed cron only after approval.
import {command,storeConfigured,storageKey} from '../../server/storage.mjs';
import {newsConfigured,normalizeNews} from '../../server/news-core.mjs';
export default async function handler(){
 if(process.env.CONTEXT!=='production'||!newsConfigured()||!storeConfigured())return new Response(null,{status:204});
 const bucket=Math.floor(Date.now()/900000),lock=storageKey('news:slot:'+bucket);
 try{
  // One attempt per quarter-hour across instances, including failures. No retry storm.
  if(await command(['SET',lock,'reserved','NX','EX','1800'])!=='OK')return new Response(null,{status:204});
  const url=new URL('https://api.marketaux.com/v1/news/all');url.searchParams.set('api_token',process.env.MARKETAUX_API_TOKEN);url.searchParams.set('language','en');url.searchParams.set('countries','us');url.searchParams.set('entity_types','equity');url.searchParams.set('limit','10');url.searchParams.set('group_similar','true');
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Provider unavailable');
  const articles=normalizeNews(await response.json());
  // Failed provider calls preserve the previous snapshot and its original timestamp.
  await command(['SET',storageKey('news:snapshot'),JSON.stringify({articles,updatedAt:new Date().toISOString()}),'EX','172800']);
  return new Response(null,{status:204});
 }catch{return Response.json({error:'News refresh failed; previous snapshot retained'},{status:503})}
}
