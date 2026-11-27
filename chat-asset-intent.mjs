import {assets,resolveAssetQuery} from './asset-search.mjs';
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
 for(const m of text.matchAll(/(?:על|עם|מניית|מנית|מניה|מנייה|סימול|\babout\b|\bstock\b)\s+\$?([a-z][a-z0-9.-]{1,13})(?![\p{L}\p{N}_:])/giu)){
  const s=m[1].toUpperCase();if(!ignored.has(s)&&(known.has(s)||m[1]===s))add(known.get(s)||s);
 }
 return found.size===1?[...found.values()][0]:null;
}
// Thresholds use the UI's Hebrew/English notation: comma/space grouping,
// decimal point. Never accept a numeric prefix of a malformed larger amount.
function thresholdNumber(raw){
 let token=raw.trim().replace(/[.,]$/u,'');
 const parts=token.split('.');if(parts.length>2||parts[1]!==undefined&&!/^\d+$/u.test(parts[1]))return null;
 let integer=parts[0];
 const separators=integer.match(/[,\u00a0\u202f ]/gu)||[];
 if(separators.length){
  const kinds=new Set(separators.map(c=>c===','?',':'space'));if(kinds.size!==1)return null;
  const groups=integer.replace(/^\+/u,'').split(kinds.has(',')?',':/[\u00a0\u202f ]/u);
  if(!/^\d{1,3}$/u.test(groups[0])||groups.slice(1).some(g=>!/^\d{3}$/u.test(g)))return null;
  integer=integer.replace(/[,\u00a0\u202f ]/gu,'');
 }
 if(!/^\+?\d+$/u.test(integer))return null;
 const value=Number(integer+(parts[1]!==undefined?'.'+parts[1]:''));return Number.isFinite(value)&&value>=0&&value<=1e15?value:null;
}
const thresholdToken='([+-]?\\d[\\d.,]*(?:[\\u00a0\\u202f ]\\d[\\d.,]*)*)';
const thresholdScales={טריליון:1e12,מיליארד:1e9,מיליון:1e6,אלף:1e3,trillion:1e12,billion:1e9,million:1e6,thousand:1e3,bn:1e9,b:1e9,m:1e6,k:1e3};
function thresholdMatch(text,field,{scale=false}={}){
 const expression=new RegExp('(?:'+field+')[^.!?;]{0,16}?(?:מעל|לפחות|over|above|at least)\\s*\\$?\\s*'+thresholdToken+'\\s*'+(scale?'(טריליון|מיליארד|מיליון|אלף|trillion|billion|million|thousand|bn|[bmk])?':''),'iu');
 const match=text.match(expression);if(!match)return null;
 const value=thresholdNumber(match[1]),tail=text.slice(match.index+match[0].length);
 const attached=/[\p{L}\p{N}_]/u.test(tail[0]||'')&&!/\s$/u.test(match[0]);
 if(value===null||attached&&!/^(?:דולר(?:ים)?|dollars?|USD)(?![\p{L}\p{N}_])/iu.test(tail))return null;
 const result=value*(scale?(thresholdScales[match[2]?.toLowerCase()]||1):1);
 return Number.isFinite(result)&&result<=1e15?result:null;
}
function discoveryExclusions(text){
 const clauses=text.split(/(?:\b(?:excluding|exclude|except|without)\b|לא כולל|למעט|חוץ מ|בלי|ללא)\s+/iu).slice(1);
 const symbols=[];let invalid=false;
 for(const raw of clauses){
 const clause=raw.split(/[.!?;]/u)[0].split(/\s+(?:with|whose|having|עם|במחיר|שווי)\s+/iu)[0];
 if(/^(?:ל|ב)?(?:לונג|שורט|long|short)(?![\p{L}\p{N}_])/iu.test(clause))continue;
 for(const piece of clause.split(/\s*(?:,|\band\b|\bor\b|\sו\s|\sו(?=[\p{L}$]))\s*/iu).filter(Boolean)){
  let symbol=questionAsset(piece.trim());
  if(!symbol){const resolved=resolveAssetQuery(piece.trim());if(resolved&&known.has(ticker(resolved)))symbol=resolved;}
  if(!symbol||symbol.startsWith('COINLORE:')){invalid=true;continue;}
  const selected=ticker(symbol);if(!symbols.includes(selected))symbols.push(selected);
 }
 }
 return {symbols,invalid};
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
 const filters={},exclusions=discoveryExclusions(text);
 const cap=thresholdMatch(text,'שווי\\s*שוק|market\\s*cap',{scale:true});if(cap!==null)filters.minMarketCap=cap;
 const price=thresholdMatch(text,'מחיר|price');if(price!==null)filters.minPrice=price;
 const unsupported=exclusions.invalid||/(?:\bcrores?\b|\blakhs?\b|\b(?:EUR|GBP|JPY|INR|ILS|euros?|pounds?|yen|rupees?)\b|יורו|אירו|שקלים?|ש״ח|€|£|₹|₪)/iu.test(text)||/(?:RSI|ATR|ADX|MACD|סקטור|sector|פוטנציאל|potential|מחזור|volume|מתחת|below|under|ממוצע|moving average|תבנית|pattern|%)/iu.test(text)||(/שווי\s*שוק|market\s*cap/iu.test(text)&&cap===null)||(/מחיר|price/iu.test(text)&&price===null);
 return {side:noLong&&noShort?'invalid':long===short?'any':short?'short':'long',limit:Math.max(1,Math.min(12,n?Number(n[1]):words.find(([re])=>re.test(text))?.[1]||3)),...(Object.keys(filters).length?{filters}:{}),...(exclusions.symbols.length?{excludeSymbols:exclusions.symbols}:{}),...(unsupported?{unsupportedCriteria:true}:{}),...(/(?:עוד|אחרות|אחרים|\b(?:more|other|different|another)\b)/iu.test(text)?{more:true}:{})};
}
