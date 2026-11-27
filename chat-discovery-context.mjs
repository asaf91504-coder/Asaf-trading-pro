import {stockDiscoveryIntent} from './chat-asset-intent.mjs';
// Previous text supplies exclusions only, never prices, screening evidence or
// instructions. Limit extraction to a prior scanner answer and allowed tickers.
export function previousScannerSymbols(history,allowed){
 if(!Array.isArray(history))return [];
 const prior=history.slice(-40).filter(m=>m?.role==='assistant'&&m.chartContext?.source==='Twelve Data'&&!m.chartContext?.symbol&&typeof m.content==='string');
 if(!prior.length)return [];
 const permitted=new Set(allowed),matches=prior.flatMap(m=>m.content.slice(0,12000).match(/(?<![\p{L}\p{N}_])[A-Z][A-Z0-9]{1,9}(?:[.-][A-Z0-9]{1,4})?(?![\p{L}\p{N}_])/gu)||[]);
 return [...new Set(matches.filter(s=>permitted.has(s)))].slice(0,1000);
}

const hasDirection=text=>/(?:לונג|שורט|\blong\b|\bshort\b)/iu.test(text);
export function resolveDiscoveryContext(intent,history,question){
 // A short follow-up is meaningful only immediately after stock discovery.
 // Do not resurrect a scanner request across an intervening asset/topic.
 if(!intent&&Array.isArray(history)){
  const last=history.slice(-40).filter(m=>m?.role==='user'&&typeof m.content==='string').at(-1);
  const follow=String(question||'').trim(),prior=last&&stockDiscoveryIntent(last.content);
  if(prior&&!prior.unsupportedCriteria&&prior.side!=='invalid'&&/^(?:(?:תן|תביא|תרשום|רשום|אפשר)\s+(?:לי\s+)?)?עוד\s+(?:\d{1,2}|שתיים|שתי|שלוש|שלושה|ארבע|חמש)(?:\s+(?:אחרות|אחרים|ללונג|לשורט))*[?.!]?$/u.test(follow)){intent=stockDiscoveryIntent('תן לי '+follow.replace(/[?.!]$/u,'')+' מניות');const count=follow.match(/עוד\s+(\d{1,2})/u);if(intent&&count)intent.limit=Math.max(1,Math.min(12,Number(count[1])));}
 }
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
