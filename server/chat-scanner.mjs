import {readSharedScan} from './shared-scanner.mjs';
import {screenWithMethodology,selectMethodologyCandidate} from './asaf-methodology.mjs';
import {marketCapAvailable} from '../market-quality.mjs';
import {aiProviderConfig,openaiDataAllowed} from './ai-provider.mjs';
import {MarketError,approvedMarketSymbols} from './market-feed.mjs';
import {priceResearchLevels} from '../price-research-levels.mjs';

const rounded=value=>Number.isFinite(value)?Number(value.toFixed(2)):null;
export const CHAT_SCANNER_PAGE_SIZE=25;
export const CHAT_SCANNER_TIMEOUT_MS=12000;
export async function readChatScanner(intent,{env=process.env,memberId=null,now=Date.now(),readScan=readSharedScan,timeoutMs=CHAT_SCANNER_TIMEOUT_MS,...options}={}){
 if(env.ASAF_MARKET_AI_LICENSE_CONFIRMED!=='true'||aiProviderConfig(env).provider==='openai'&&!openaiDataAllowed('Twelve Data',env))throw new MarketError('ניתוח הסורק אינו פעיל לחשבון זה.',403);
 const filters=intent.filters??{};
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.entries(filters).some(([key,value])=>!['minMarketCap','minPrice'].includes(key)||!Number.isFinite(value)||value<0||value>1e15))throw new MarketError('מסנני החיפוש אינם תקינים.',400);
 const exclusions=intent.excludeSymbols??[];
 if(!Array.isArray(exclusions)||exclusions.length>1000||exclusions.some(s=>typeof s!=='string'||!/^(?:(?:NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|OTC):)?[A-Z0-9][A-Z0-9._-]{0,19}$/.test(s.trim().toUpperCase())))throw new MarketError('רשימת המניות להחרגה אינה תקינה.',400);
 const excluded=new Set(exclusions.map(s=>s.trim().toUpperCase().split(':').at(-1)));
 // Read only small pages of already-cached records. Loading all 10,000 full
 // candle series before answering two candidates can exceed the host timeout.
 // Exclusions narrow the read, and every page still enforces access/freshness.
 const ranked=[],seen=new Set(),deadline=Date.now()+Math.min(CHAT_SCANNER_TIMEOUT_MS,Math.max(1,timeoutMs));
 const symbols=excluded.size?approvedMarketSymbols(env).filter(s=>!excluded.has(s)):undefined;
 let offset=0,scan,hasMore=false,timedOut=false;
 for(let pages=0;pages<400;pages++){
  let timer;
  const remaining=deadline-Date.now();
  if(remaining<=0){timedOut=true;break;}
  try{
   scan=await Promise.race([
    readScan({...options,env,memberId,now,...(symbols?{symbols}:{}),page:{offset,limit:CHAT_SCANNER_PAGE_SIZE}}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new MarketError('קריאת נתוני הסורק התעכבה. נסה שוב בעוד רגע.',503)),remaining)})
   ]);
  }catch(error){if(!ranked.length||error?.status===403||error?.status===400)throw error;timedOut=true;break;}finally{clearTimeout(timer)}
  for(const input of scan.records){
   if(seen.has(input.symbol))continue;seen.add(input.symbol);
   // Explicit user filters apply to watch candidates too. A weaker fallback
   // cannot silently ignore a requested company-size or price threshold.
   if(excluded.has(input.symbol))continue;
   if(Object.hasOwn(filters,'minMarketCap')&&(!marketCapAvailable(input,now)||input.fundamentals.marketCap<filters.minMarketCap))continue;
   if(Object.hasOwn(filters,'minPrice')&&(!Number.isFinite(input.summary?.close)||input.summary.close<=filters.minPrice))continue;
   const result=screenWithMethodology(input,{scenarioSide:intent.side},{now}),{record,methodology}=result,s=record.summary;
   const best=result.opportunities.filter(o=>o.eligible).sort((a,b)=>b.rank-a.rank)[0];
   if(!best)continue;
   const selection=selectMethodologyCandidate(record,{side:best.side,fullMatch:best.status==='match'}),setup=selection.candidate;
   const scenario=setup?.scenario,prior=record.bars.at(-2)?.close;
   const levels=priceResearchLevels(record.bars);
   ranked.push({rank:best.rank,symbol:record.symbol,side:best.side,status:best.status,
    asOf:s.date,interval:'1day',receivedAt:record.receivedAt,
    close:rounded(s.close),sma20:rounded(s.sma20),sma150:rounded(s.sma150),
    priceLevels:levels?{support:levels.support.map(rounded),resistance:levels.resistance.map(rounded)}:null,
    changePercent:Number.isFinite(prior)&&prior>0?rounded((s.close/prior-1)*100):null,
    aboveMA20:s.aboveMA20,aboveMA150:s.aboveMA150,atrPercent:rounded(s.atrPercent),
    marketCapUsd:marketCapAvailable(record,now)?record.fundamentals.marketCap:null,
    relativeVolume:record.volumeComparison?.status==='verified'?rounded(record.volumeComparison.ratio):null,
    pattern:setup?{kind:setup.kind,stage:setup.stage}:null,
    scenario:scenario?{entry:rounded(scenario.entry),stop:rounded(scenario.stop),target:rounded(scenario.target),movePercent:rounded(scenario.movePercent),riskReward:rounded(scenario.riskReward),side:scenario.side,watchOnly:selection.watchOnly,methodologyQualified:selection.qualified}:null,
    missingConditions:best.reasons,checks:methodology.checks.map(({key,passed})=>({key,passed}))});
  }
  hasMore=scan.pagination?.hasMore===true;
  if(ranked.length>=intent.limit||!hasMore)break;
  const next=scan.pagination.nextOffset;
  if(!Number.isSafeInteger(next)||next<=offset)break;
  offset=next;
 }
 if(!scan)throw new MarketError('קריאת נתוני הסורק התעכבה. נסה שוב בעוד רגע.',503);
 ranked.sort((a,b)=>b.rank-a.rank||a.symbol.localeCompare(b.symbol));
 return {status:'available',scanned:seen.size,total:scan.total||seen.size,partial:scan.partial===true||hasMore||timedOut,updatedAt:scan.updatedAt||scan.completedAt,candidates:ranked.slice(0,intent.limit),requested:intent.limit,...(Object.keys(filters).length?{appliedFilters:filters}:{}),...(excluded.size?{excludedSymbols:[...excluded]}:{}),
  note:'Completed daily sessions only; close is the dated daily close, not a live quote. Small cache pages are searched until the requested count or the time budget is reached; these are ranked candidates from the inspected records, not the best stocks in the entire market. Rank is not a probability. A watch candidate fails one or more screening gates and must not be called a confirmed setup. A one-month horizon does not certify future performance. Earnings dates, borrow availability and event risk are unverified. Never invent candidates to fill the requested count.'};
}
export const SCANNER_CHAT_POLICY=`\nThe user requested multiple stock candidates. Answer from SCANNER_DISCOVERY, independently of the open chart and past conversation. Give the requested number of distinct symbols when enough server candidates exist, one compact bullet per symbol: long/short, full match or watch status, dated close, signed percentage move, and nearest support/resistance or relevant conditional scenario when supplied. Use one brief date/timeframe label for the group. Clearly label missing conditions and watch-only candidates; never promote them to confirmed trades. If fewer candidates exist, state the actual count without inventing stocks. You have searched the supplied scanner records, not just the open chart. When candidates contain dated prices, do not say no data is available; explain any missing confirmation precisely. Do not ask for a new conversation or claim you only have one stock when multiple candidates are supplied. Preserve supplied numbers and side exactly. Do not claim current session prices, a promised month-long return or earnings knowledge. No sources section. Up to 160 words for three candidates.\n`;
