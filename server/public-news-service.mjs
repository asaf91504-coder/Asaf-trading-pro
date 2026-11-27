import {command,storageKey,storeConfigured} from './storage.mjs';
import {PUBLIC_NEWS_FEEDS,parsePublicRSS,mergePublicArticles,publicNewsEnabled,publicHeadlineSymbols} from './public-news.mjs';
import {snapshotState} from './news-core.mjs';
export async function refreshPublicNews({env=process.env,now=Date.now(),run=command,fetcher=fetch}={}){
 if(!publicNewsEnabled(env)||!storeConfigured(env)||!storageKey('public-news',env).startsWith('asaf:production:'))return {status:'disabled'};
 const key=storageKey('news:public:us:snapshot',env),lock=storageKey('news:public:us:slot:'+Math.floor(now/900000),env);
 if(await run(['SET',lock,'reserved','NX','EX','1800'],{env})!=='OK')return {status:'cached'};
 const results=await Promise.allSettled(PUBLIC_NEWS_FEEDS.map(async feed=>{const r=await fetcher(feed.url,{redirect:'error',signal:AbortSignal.timeout(9000),headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'ASAFTradingPro-RSS/1.0'}});if(!r.ok)throw Error('RSS source unavailable');const length=Number(r.headers.get('content-length'));if(length>1000000)throw Error('RSS too large');const reader=r.body.getReader();let chunks=[],bytes=0;try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1000000)throw Error('RSS too large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}return {feed,articles:parsePublicRSS(Buffer.concat(chunks).toString('utf8'),feed,now)}}));
 const successful=results.flatMap((r,i)=>r.status==='fulfilled'?[{...r.value,source:PUBLIC_NEWS_FEEDS[i]}]:[]),articles=mergePublicArticles(successful.map(r=>r.articles));
 if(!articles.length)return {status:'unavailable'}; // Preserve previous cache and timestamp.
 const sources=results.map((r,i)=>({name:PUBLIC_NEWS_FEEDS[i].name,status:r.status==='fulfilled'?(r.value.articles.length?'ok':'empty'):'unavailable',items:r.status==='fulfilled'?r.value.articles.length:0}));
 await run(['SET',key,JSON.stringify({articles,updatedAt:new Date(now).toISOString(),sources}),'EX','172800'],{env});return {status:'updated',count:articles.length};
}
export async function readPublicNews({env=process.env,now=Date.now(),run=command}={}){const raw=await run(['GET',storageKey('news:public:us:snapshot',env)],{env}),value=raw?JSON.parse(raw):null;const scheduledRaw=await run(['GET',storageKey('news:public:scheduled',env)],{env});let scheduled=null;try{scheduled=scheduledRaw?JSON.parse(scheduledRaw):null}catch{}const snapshot=snapshotState(value,now);snapshot.articles=snapshot.articles.filter(isMarketHeadline).map(article=>({...article,symbols:[...new Set([...article.symbols,...publicHeadlineSymbols(article.title)])].slice(0,20)}));return {...snapshot,lastScheduledAt:typeof scheduled?.at==='string'&&Number.isFinite(Date.parse(scheduled.at))?scheduled.at:null,sources:Array.isArray(value?.sources)?value.sources.slice(0,3):[]}}

export function isMarketHeadline(article){
 if(/^(print edition|home(?:page)?|latest news|news headlines)\s*(?:[|–—-]|$)/i.test(article.title||''))return false;
 if(!/^(markets|major-news):/.test(article.id||''))return true;
 if(publicHeadlineSymbols(article.title||'').length)return true;
 return /\b(stock|stocks|share|shares|equity|equities|earnings|revenue|profit|profits|dividend|dividends|investor|investors|investing|investment|market|markets|nasdaq|nyse|wall street|s&p|dow|fed|federal reserve|inflation|interest rate|rates|treasury|bond|bonds|dollar|economy|economic|trade|tariff|tariffs|ipo|merger|acquisition|billion|trillion|bitcoin|crypto|ethereum|nvidia|huang|apple|microsoft|amazon|tesla|meta|alphabet|google|openai|anthropic|oil|gold|financial|finance|bank|banking|portfolio|fund|funds|hedge|etf|semiconductor|chip|chips)\b/i.test(article.title||'');
}
