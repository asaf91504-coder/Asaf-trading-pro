import {assets} from './asset-search.mjs';
import {parseChartCommand} from './chat-chart-actions.mjs';
import {isLearningQuestion} from './chat-request-intent.mjs';

const ignored=new Set(['AI','ATR','RSI','MACD','ADX','OBV','VWAP','USD','EOD','ETF','IPO','CEO','MA20','MA150','LONG','SHORT','BUY','SELL','AND','THE','FOR','IT','ON','AT','ALL']);
const known=new Map(assets.map(a=>[a.symbol.split(':').at(-1),a.type==='crypto'?'COINLORE:'+a.symbol:a.symbol]));
const ticker=s=>String(s||'').split(':').at(-1).toUpperCase();
export const sameChatAsset=(a,b)=>!!a&&!!b&&ticker(a)===ticker(b);
// Only explicit mentions in this turn select an asset; earlier prose is not a selection.
export function questionAsset(value){
 const text=String(value||'');if(isLearningQuestion(text))return null;
 const found=new Map();
 const add=s=>{if(s)found.set(ticker(s),s)};
 const parsed=parseChartCommand('נתח '+text);
 for(const a of parsed.actions||[])if(a.type==='symbol')add(a.symbol);
 for(const m of text.matchAll(/(?<![\p{L}\p{N}_])\$?((?:NASDAQ:|NYSE:|NYSEARCA:|COINLORE:)?[A-Z][A-Z0-9]{1,9}(?:[.-][A-Z0-9]{1,4})?)(?![\p{L}\p{N}_])/gu)){
  const s=m[1],t=ticker(s);if(ignored.has(t))continue;
  if(s.includes(':')||m[0].startsWith('$')||known.has(t))add(known.get(t)||s);
 }
 for(const m of text.matchAll(/(?:על|מניית|מנית|מניה|מנייה|סימול|\babout\b|\bstock\b)\s+\$?([a-z][a-z0-9.-]{1,13})(?![\p{L}\p{N}_])/giu)){
  const s=m[1].toUpperCase();if(!ignored.has(s)&&(known.has(s)||m[1]===s))add(known.get(s)||s);
 }
 return found.size===1?[...found.values()][0]:null;
}
export function stockDiscoveryIntent(value){
 const text=String(value||'').normalize('NFKC');
 if(isLearningQuestion(text)||/^(?:הסבר|תסביר|איך|כיצד|מה ההבדל|explain|how to|what is)/iu.test(text))return null;
 if(!/(?:מניות|מועמדות|סטאפים|\b(?:stocks|candidates|setups)\b)/iu.test(text)||!/(?:תן|תתן|תיתן|תביא|מצא|תמצא|חפש|תחפש|אני רוצה|אפשר|\b(?:find|give|show|scan|want)\b)/iu.test(text))return null;
 const long=/(?:לונג|\blong\b)/iu.test(text),short=/(?:שורט|\bshort\b)/iu.test(text);
 const n=text.match(/(?:^|\s)(\d{1,2})\s+(?:מניות|מועמדות|סטאפים|stocks|candidates|setups)/iu);
 const words=[[/שלוש|שלושה|\bthree\b/iu,3],[/חמש|חמישה|\bfive\b/iu,5],[/שתי|שתיים|\btwo\b/iu,2],[/עשר|עשרה|\bten\b/iu,10]];
 return {side:long===short?'any':short?'short':'long',limit:Math.max(1,Math.min(12,n?Number(n[1]):words.find(([re])=>re.test(text))?.[1]||3))};
}
