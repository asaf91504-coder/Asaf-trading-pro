// Read the existing public snapshot. Do not trigger a refresh or send a user's
// question, chart context, or any licensed market-data payload to a news source.
import {readPublicNews} from './public-news-service.mjs';
import {publicNewsEnabled} from './public-news.mjs';
import {storeConfigured} from './storage.mjs';

const MAX_HEADLINE_AGE_MS=24*60*60*1000;
const US_MARKET=/\b(?:wall street|u\.?s\.? (?:stock(?:s| market)?|market(?:s)?|equities|stock futures)|s\s*&\s*p\s*500|dow jones|dow (?:gains|drops|rises|falls|futures|slips|climbs|jumps|slides)|nasdaq(?:[- ]100| composite| futures)|(?:stock|equity) index futures|major (?:u\.?s\.? )?(?:stock )?indexes)\b/i;
const CATALYST=/\b(?:federal reserve|fomc|monetary policy|interest rates?)\b/i;
const unavailable=()=>({status:'unavailable',articles:[],updatedAt:null});

export async function readUSMarketHeadlines({now=Date.now(),env=process.env,run}={}){
 if(!Number.isFinite(now)||!publicNewsEnabled(env)||!storeConfigured(env))return unavailable();
 try{
  const {articles,updatedAt,stale}=await readPublicNews({env,now,run});
  if(stale||Date.parse(updatedAt)>now)return unavailable();
  const seen=new Set();
  const recent=articles.filter(({publishedAt})=>{const time=Date.parse(publishedAt);return time<=now&&now-time<=MAX_HEADLINE_AGE_MS});
  const pick=(list,limit)=>list.filter(({title})=>{
   const key=title.toLowerCase().replace(/\s+/g,' ').trim();if(seen.has(key))return false;
   seen.add(key);return true;
  }).slice(0,limit).map(({title,url,source,publishedAt})=>({title,url,source,publishedAt}));
  const market=pick(recent.filter(({id,title})=>/^(markets|major-news):/.test(id)&&US_MARKET.test(title)),5);
  if(!market.length)return unavailable();
  const catalysts=pick(recent.filter(({id,title})=>id.startsWith('economy:')&&CATALYST.test(title)),1);
  return {status:'available',articles:[...market,...catalysts],updatedAt};
 }catch{return unavailable()}
}
