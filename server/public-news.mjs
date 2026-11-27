import {normalizeNews} from './news-core.mjs';
import {indexStocks} from '../index-stock-catalogue.mjs';
export const PUBLIC_NEWS_FEEDS=[{"id": "markets", "name": "US markets · major publishers", "url": "https://news.google.com/rss/search?q=%28site%3Afinance.yahoo.com+OR+site%3Amarketwatch.com+OR+site%3Awsj.com+OR+site%3Aft.com+OR+site%3Afool.com%29+%28%22Wall+Street%22+OR+%22US+stocks%22+OR+Nasdaq+OR+NYSE%29+when%3A1d&hl=en-US&gl=US&ceid=US%3Aen"}, {"id": "economy", "name": "Federal Reserve", "url": "https://www.federalreserve.gov/feeds/press_all.xml"}, {"id": "major-news", "name": "Reuters · CNBC · Bloomberg", "url": "https://news.google.com/rss/search?q=%28site%3Areuters.com+OR+site%3Acnbc.com+OR+site%3Abloomberg.com%29+%28%22Wall+Street%22+OR+%22US+stocks%22+OR+Nasdaq+OR+earnings%29+when%3A1d&hl=en-US&gl=US&ceid=US%3Aen"}];
export function publicNewsEnabled(env=process.env){return env.ASAF_PUBLIC_NEWS_ENABLED!=='false'&&env.ASAF_EXTERNAL_SERVICES_APPROVED==='true'}
export function xmlText(value=''){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>{const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(known[e])return known[e];const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):''}).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
// Tag only known catalogue symbols. Ordinary words that also happen to be
// tickers need an explicit cashtag, exchange marker or adjacent stock context.
const catalogueSymbols=new Set(indexStocks.map(stock=>stock.symbol));
const ambiguousTickers=new Set('ALL ARE ART AWAY BALL BEST BIG BILL BOOM BOX BUY CAR CARE CASH CAT COLD COMP COOK CORN COST CURE CUT DAY DOW EAT EDIT EVER FAST FIVE FIX FLOW FOR FOUR FREE FUN GAIN GATE GOLF GOOD GO GROW HAS HEAR HERO HOME HOPE HOUR JOBS JUST LAND LAW LIFE LIVE LOVE LOW MAIN MAN MANY MORE MOVE NEAR NEW NEXT NICE NOW ODD OPEN OUT OWN PACK PAST PATH PAY PEAK PINS PLAY POOL POST SAFE SAVE SEE SELF SHOP SITE SKIN SKY SNOW SOFT SOME SPOT STAR STEP STOP TALK TEAM TECH TREE TRUE TURN TWO UNIT USA USE VIEW VOTE WASH WAY WELL WING WIRE WORK WOW YOU ZONE'.split(' '));
const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const namedAliases=new Map([
 ['AAPL',['Apple']],['MSFT',['Microsoft']],['NVDA',['Nvidia']],
 ['TSLA',['Tesla']],['AMZN',['Amazon']],['META',['Meta Platforms','Facebook']],
 ['GOOGL',['Alphabet','Google']]
]);
for(const stock of indexStocks){
 const name=stock.name.replace(/\s+CLASS\s+[A-Z0-9]+\b.*$/i,'').replace(/(?:\s+(?:INCORPORATED|CORPORATION|CORP|INC|PLC|LTD|LIMITED|REIT))+(?:\.)?$/i,'').trim();
 // Multiword company names are safer than generic one-word catalogue names.
 if(name.split(/\s+/).length>1&&name.length>=6)namedAliases.set(stock.symbol,[...(namedAliases.get(stock.symbol)||[]),name]);
}
const companyMatchers=[...namedAliases].filter(([symbol])=>catalogueSymbols.has(symbol)).map(([symbol,names])=>[symbol,new RegExp('(?<![\\p{L}\\p{N}_])(?:'+[...new Set(names)].map(escapePattern).join('|')+')(?![\\p{L}\\p{N}_])','iu')]);
export function publicHeadlineSymbols(title=''){
 const symbols=new Set();
 for(const match of title.matchAll(/(?<![\p{L}\p{N}_])\$?([A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*)(?![\p{L}\p{N}_])/gu)){
  const symbol=match[1];if(!catalogueSymbols.has(symbol))continue;
  const ambiguous=symbol.length<=2||ambiguousTickers.has(symbol);
  const before=title.slice(0,match.index),after=title.slice(match.index+match[0].length);
  const explicit=match[0].startsWith('$')||/\b(?:NASDAQ|NYSE|AMEX)\s*:\s*$/i.test(before);
  const stockContext=/^\s+(?:stock|shares|earnings|dividend)\b/i.test(after)||/\b(?:stock|shares|ticker)\s*[:(]?\s*$/i.test(before);
  if(!ambiguous||explicit||stockContext)symbols.add(symbol);
 }
 for(const [symbol,matcher]of companyMatchers)if(matcher.test(title))symbols.add(symbol);
 return [...symbols];
}
export function parsePublicRSS(xml,feed,now=Date.now()){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss\b/i.test(xml))throw Error('Invalid RSS');
 const field=(item,name)=>xmlText(item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'');
 const data=[];for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  if(data.length>=50)break;const item=match[1],title=field(item,'title'),url=field(item,'link'),date=Date.parse(field(item,'pubDate'));if(!title||!Number.isFinite(date)||date>now+300000||now-date>7*86400000)continue;
  if(feed.id==='x-index'){const origin=item.match(/<source\b[^>]*url=["']([^"']+)/i)?.[1];try{if(!['x.com','twitter.com','www.x.com','www.twitter.com'].includes(new URL(origin).hostname))continue}catch{continue}}
  const publisher=field(item,'source'),symbols=publicHeadlineSymbols(title).map(symbol=>({symbol}));
  data.push({uuid:feed.id+':'+url,title,url,published_at:new Date(date).toISOString(),source:feed.id==='x-index'?'X · מאונדקס ולא מאומת':publisher||feed.name,entities:symbols});
 }
 return normalizeNews({data});
}
export function mergePublicArticles(groups){const seen=new Set();return groups.flat().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).filter(a=>{const key=a.title.toLowerCase().replace(/\s+/g,' ').trim();if(seen.has(a.url)||seen.has(key))return false;seen.add(a.url);seen.add(key);return true}).slice(0,50)}
