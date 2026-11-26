import {stockDiscoveryIntent} from './chat-asset-intent.mjs';
// Previous text supplies exclusions only, never prices, screening evidence or
// instructions. Limit extraction to a prior scanner answer and allowed tickers.
export function previousScannerSymbols(history,allowed){
 if(!Array.isArray(history))return [];
 const prior=history.slice(-40).reverse().find(m=>m?.role==='assistant'&&m.chartContext?.source==='Twelve Data'&&!m.chartContext?.symbol&&typeof m.content==='string');
 if(!prior)return [];
 const permitted=new Set(allowed),matches=prior.content.slice(0,12000).match(/(?<![\p{L}\p{N}_])[A-Z][A-Z0-9]{1,9}(?:[.-][A-Z0-9]{1,4})?(?![\p{L}\p{N}_])/gu)||[];
 return [...new Set(matches.filter(s=>permitted.has(s)))].slice(0,12);
}

const hasDirection=text=>/(?:לונג|שורט|\blong\b|\bshort\b)/iu.test(text);
export function resolveDiscoveryContext(intent,history,question){
 if(!intent?.more||!Array.isArray(history))return intent;
 const merge=(prior,current,text)=>({...prior,...current,side:hasDirection(text)?current.side:prior.side,...(prior.filters||current.filters?{filters:{...prior.filters,...current.filters}}:{})});
 let previous=null;
 for(const message of history.slice(-40)){
  if(message?.role!=='user'||typeof message.content!=='string')continue;
  const parsed=stockDiscoveryIntent(message.content);if(!parsed||parsed.unsupportedCriteria||parsed.side==='invalid')continue;
  previous=parsed.more&&previous?merge(previous,parsed,message.content):parsed;
 }
 return previous?merge(previous,intent,question):intent;
}
