import {assets} from './asset-search.mjs';
import {parseChartCommand} from './chat-chart-actions.mjs';
import {isLearningQuestion} from './chat-request-intent.mjs';

const ignored=new Set(['AI','ATR','RSI','MACD','ADX','OBV','VWAP','USD','EOD','ETF','IPO','CEO','MA20','MA150','LONG','SHORT','BUY','SELL','AND','THE','FOR','IT','ON','AT','ALL']);
const known=new Map(assets.map(a=>[a.symbol.split(':').at(-1),a.type==='crypto'?'COINLORE:'+a.symbol:a.symbol]));
const cryptoAliases=new Map([['BTC','COINLORE:BTCUSD'],['ETH','COINLORE:ETHUSD'],['BTCUSD','COINLORE:BTCUSD'],['ETHUSD','COINLORE:ETHUSD']]);
const canonical=s=>s&&!s.includes(':')?(cryptoAliases.get(s.toUpperCase())||s):s;
const ticker=s=>String(s||'').split(':').at(-1).toUpperCase();
const assetId=value=>{const s=canonical(String(value||'').toUpperCase());return (s.startsWith('COINLORE:')?'crypto:':'stock:')+ticker(s)};
export const sameChatAsset=(a,b)=>!!a&&!!b&&assetId(a)===assetId(b);
// Only explicit mentions in this turn select an asset; earlier prose is not a selection.
export function questionAsset(value){
 const text=String(value||'');if(isLearningQuestion(text))return null;
 const found=new Map();
 const add=value=>{const s=canonical(value);if(s)found.set(assetId(s),s)};
 const parsed=parseChartCommand('נתח '+text);
 if(parsed.unresolvedSymbol)return null;
 for(const a of parsed.actions||[])if(a.type==='symbol')add(a.symbol);
 for(const m of text.matchAll(/(?<![\p{L}\p{N}_])\$?((?:NASDAQ:|NYSE:|NYSEARCA:|COINLORE:)?[A-Z][A-Z0-9]{1,9}(?:[.-][A-Z0-9]{1,4})?)(?![\p{L}\p{N}_])/gu)){
  const s=m[1],t=ticker(s);if(ignored.has(t))continue;
  if(s.includes(':')||m[0].startsWith('$')||known.has(t))add(s.includes(':')?s:known.get(t)||s);
 }
 for(const m of text.matchAll(/(?:על|מניית|מנית|מניה|מנייה|סימול|\babout\b|\bstock\b)\s+\$?([a-z][a-z0-9.-]{1,13})(?![\p{L}\p{N}_:])/giu)){
  const s=m[1].toUpperCase();if(!ignored.has(s)&&(known.has(s)||m[1]===s))add(known.get(s)||s);
 }
 return found.size===1?[...found.values()][0]:null;
}
export function stockDiscoveryIntent(value){
 const text=String(value||'').normalize('NFKC');
 if(isLearningQuestion(text)||/^(?:הסבר|תסביר|איך|כיצד|מה ההבדל|explain|how to|what is)/iu.test(text))return null;
 if(!/(?:מניות|מועמדות|סטאפים|מנ(?:י|יי)ה\s+אחת|\b(?:stocks|candidates|setups|one stock|1 stock)\b)/iu.test(text)||!/(?:תן|תתן|תיתן|תביא|מצא|תמצא|חפש|תחפש|אני רוצה|אפשר|\b(?:find|give|show|scan|want)\b)/iu.test(text))return null;
 const negative=side=>new RegExp('(?:^|[\\s,;])(?:ו?(?:לא|בלי|ללא)|not|no|without)\\s+(?:ל|ב|a |any |for )?(?:'+side+')(?![\\p{L}\\p{N}_])','iu').test(text);
 const noLong=negative('לונג|long'),noShort=negative('שורט|short');
 const long=!noLong&&(/(?:לונג|\blong\b)/iu.test(text)||noShort),short=!noShort&&(/(?:שורט|\bshort\b)/iu.test(text)||noLong);
 const n=text.match(/(?:^|\s)(\d{1,4})\s+(?:מניות|מועמדות|סטאפים|stocks|candidates|setups|stock)/iu);
 const words=[[/שתים[־ -]עשרה|שנים[־ -]עשר|\btwelve\b/iu,12],[/אחת[־ -]עשרה|אחד[־ -]עשר|\beleven\b/iu,11],[/שלוש|שלושה|\bthree\b/iu,3],[/ארבע|ארבעה|\bfour\b/iu,4],[/חמש|חמישה|\bfive\b/iu,5],[/שש|שישה|\bsix\b/iu,6],[/שבע|שבעה|\bseven\b/iu,7],[/שמונה|\beight\b/iu,8],[/תשע|תשעה|\bnine\b/iu,9],[/שתי|שתיים|\btwo\b/iu,2],[/עשר|עשרה|\bten\b/iu,10],[/אחת|אחד|\bone\b/iu,1]];
 const filters={};
 const cap=text.match(/(?:שווי\s*שוק|market\s*cap)[^.!?;]{0,16}?(?:מעל|לפחות|over|above|at least)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(מיליארד|מיליון|billion|million|bn|[bm])?/iu);
 if(cap){const units={מיליארד:1e9,מיליון:1e6,billion:1e9,million:1e6,bn:1e9,b:1e9,m:1e6};filters.minMarketCap=Number(cap[1].replace(',','.'))*(units[cap[2]?.toLowerCase()]||1)}
 const price=text.match(/(?:מחיר|price)[^.!?;]{0,10}?(?:מעל|לפחות|over|above|at least)\s*\$?\s*(\d+(?:[.,]\d+)?)/iu);if(price)filters.minPrice=Number(price[1].replace(',','.'));
 const unsupported=/(?:RSI|ATR|ADX|MACD|סקטור|sector|פוטנציאל|potential|מחזור|volume|מתחת|below|under|ממוצע|moving average|תבנית|pattern|%)/iu.test(text)||(/שווי\s*שוק|market\s*cap/iu.test(text)&&!cap)||(/מחיר|price/iu.test(text)&&!price);
 return {side:noLong&&noShort?'invalid':long===short?'any':short?'short':'long',limit:Math.max(1,Math.min(12,n?Number(n[1]):words.find(([re])=>re.test(text))?.[1]||3)),...(Object.keys(filters).length?{filters}:{}),...(unsupported?{unsupportedCriteria:true}:{}),...(/(?:עוד|אחרות|אחרים|\b(?:more|other|different|another)\b)/iu.test(text)?{more:true}:{})};
}
