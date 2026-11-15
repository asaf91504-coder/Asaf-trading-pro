import {command,storageKey} from './storage.mjs';
import {parsePublicRSS} from './public-news.mjs';
export const newsLocales={he:['he','IL','IL:he','מניות וול סטריט'],en:['en-US','US','US:en','stock market'],es:['es','ES','ES:es','bolsa acciones Wall Street'],ar:['ar','SA','SA:ar','أسواق الأسهم وول ستريت'],fr:['fr','FR','FR:fr','bourse actions Wall Street'],de:['de','DE','DE:de','Aktien Börse Wall Street'],pt:['pt-BR','BR','BR:pt-419','bolsa ações Wall Street'],ru:['ru','RU','RU:ru','акции фондовый рынок'],zh:['zh-TW','TW','TW:zh-Hant','股市 美股'],ja:['ja','JP','JP:ja','株式市場 米国株']};
export function localizedFeedUrl(language){const locale=newsLocales[language];if(!locale)throw Error('Unsupported language');const [hl,gl,ceid,q]=locale;const url=new URL('https://news.google.com/rss/search');url.search=new URLSearchParams({q:q+' when:7d',hl,gl,ceid}).toString();return url.href}
export async function readLocalizedNews(language,{env=process.env,run=command,fetcher=fetch,now=Date.now()}={}){
 const key=storageKey('news:localized:v1:'+language,env),raw=await run(['GET',key],{env});let cached;try{cached=raw?JSON.parse(raw):null}catch{}
 if(cached?.articles?.length&&now-Date.parse(cached.updatedAt)<900000)return cached;
 if(await run(['SET',key+':lock','1','NX','EX','60'],{env})!=='OK')return cached;
 try{
  const response=await fetcher(localizedFeedUrl(language),{signal:AbortSignal.timeout(9000),redirect:'error',headers:{Accept:'application/rss+xml','User-Agent':'ASAFTradingPro-RSS/1.0'}});
  if(!response.ok)throw Error('Feed unavailable');const reader=response.body.getReader();let length=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>1000000)throw Error('Feed too large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const articles=parsePublicRSS(Buffer.concat(chunks).toString('utf8'),{id:'localized-'+language,name:'Google News'},now).map(a=>({...a,titleLanguage:language}));
  if(!articles.length)return cached;
  const snapshot={articles,updatedAt:new Date(now).toISOString(),language,translation:'native',mode:'localized-rss',enabled:true};
  await run(['SET',key,JSON.stringify(snapshot),'EX','172800'],{env});return snapshot;
 }catch{return cached}
}
