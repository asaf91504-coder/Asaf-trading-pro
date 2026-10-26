import {normalizeNews} from './news-core.mjs';
export const PUBLIC_NEWS_FEEDS=[
 {id:'markets',name:'Google News · שווקים',url:'https://news.google.com/rss/search?q=stock%20market%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen'},
 {id:'economy',name:'Federal Reserve',url:'https://www.federalreserve.gov/feeds/press_all.xml'},
 {id:'x-index',name:'X · קישורים מאונדקסים בלבד',url:'https://news.google.com/rss/search?q=site%3Ax.com%20%28stocks%20OR%20earnings%20OR%20Federal%20Reserve%29%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen'}
];
export function publicNewsEnabled(env=process.env){return env.ASAF_PUBLIC_NEWS_ENABLED!=='false'&&env.ASAF_EXTERNAL_SERVICES_APPROVED==='true'}
export function xmlText(value=''){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>{const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(known[e])return known[e];const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):''}).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
export function parsePublicRSS(xml,feed,now=Date.now()){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss\b/i.test(xml))throw Error('Invalid RSS');
 const field=(item,name)=>xmlText(item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'');
 const data=[];for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  if(data.length>=50)break;const item=match[1],title=field(item,'title'),url=field(item,'link'),date=Date.parse(field(item,'pubDate'));if(!title||!Number.isFinite(date)||date>now+300000||now-date>7*86400000)continue;
  if(feed.id==='x-index'){const origin=item.match(/<source\b[^>]*url=["']([^"']+)/i)?.[1];try{if(!['x.com','twitter.com','www.x.com','www.twitter.com'].includes(new URL(origin).hostname))continue}catch{continue}}
  const publisher=field(item,'source'),symbols=[];for(const [ticker,re] of [['AAPL',/\b(Apple|AAPL)\b/i],['MSFT',/\b(Microsoft|MSFT)\b/i],['NVDA',/\b(Nvidia|NVDA)\b/i],['TSLA',/\b(Tesla|TSLA)\b/i],['AMZN',/\b(Amazon|AMZN)\b/i],['META',/\b(Meta Platforms|Facebook|META)\b/i],['GOOGL',/\b(Alphabet|Google|GOOGL)\b/i]])if(re.test(title))symbols.push({symbol:ticker});
  data.push({uuid:feed.id+':'+url,title,url,published_at:new Date(date).toISOString(),source:feed.id==='x-index'?'X · מאונדקס ולא מאומת':publisher||feed.name,entities:symbols});
 }
 return normalizeNews({data});
}
export function mergePublicArticles(groups){const seen=new Set();return groups.flat().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).filter(a=>{const key=a.title.toLowerCase().replace(/\s+/g,' ').trim();if(seen.has(a.url)||seen.has(key))return false;seen.add(a.url);seen.add(key);return true}).slice(0,50)}
