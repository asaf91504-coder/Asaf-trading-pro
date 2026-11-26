import {readSharedScan} from './shared-scanner.mjs';
import {screenWithMethodology,selectMethodologyCandidate} from './asaf-methodology.mjs';
import {marketCapAvailable} from '../market-quality.mjs';
import {aiProviderConfig,openaiDataAllowed} from './ai-provider.mjs';
import {MarketError} from './market-feed.mjs';

const rounded=value=>Number.isFinite(value)?Number(value.toFixed(2)):null;
export async function readChatScanner(intent,{env=process.env,memberId=null,now=Date.now(),readScan=readSharedScan,...options}={}){
 if(env.ASAF_MARKET_AI_LICENSE_CONFIRMED!=='true'||aiProviderConfig(env).provider==='openai'&&!openaiDataAllowed('Twelve Data',env))throw new MarketError('ניתוח הסורק אינו פעיל לחשבון זה.',403);
 const filters=intent.filters??{};
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.entries(filters).some(([key,value])=>!['minMarketCap','minPrice'].includes(key)||!Number.isFinite(value)||value<0||value>1e15))throw new MarketError('מסנני החיפוש אינם תקינים.',400);
 const exclusions=intent.excludeSymbols??[];
 if(!Array.isArray(exclusions)||exclusions.length>1000||exclusions.some(s=>typeof s!=='string'||!/^(?:(?:NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|OTC):)?[A-Z0-9][A-Z0-9._-]{0,19}$/.test(s.trim().toUpperCase())))throw new MarketError('רשימת המניות להחרגה אינה תקינה.',400);
 const excluded=new Set(exclusions.map(s=>s.trim().toUpperCase().split(':').at(-1)));
 const scan=await readScan({...options,env,memberId,now});
 const ranked=[];
 for(const input of scan.records){
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
  ranked.push({rank:best.rank,symbol:record.symbol,side:best.side,status:best.status,
   asOf:s.date,interval:'1day',receivedAt:record.receivedAt,
   changePercent:Number.isFinite(prior)&&prior>0?rounded((s.close/prior-1)*100):null,
   aboveMA20:s.aboveMA20,aboveMA150:s.aboveMA150,atrPercent:rounded(s.atrPercent),
   marketCapUsd:marketCapAvailable(record,now)?record.fundamentals.marketCap:null,
   relativeVolume:record.volumeComparison?.status==='verified'?rounded(record.volumeComparison.ratio):null,
   pattern:setup?{kind:setup.kind,stage:setup.stage}:null,
   scenario:scenario?{entry:rounded(scenario.entry),stop:rounded(scenario.stop),target:rounded(scenario.target),movePercent:rounded(scenario.movePercent),riskReward:rounded(scenario.riskReward),side:scenario.side,watchOnly:selection.watchOnly,methodologyQualified:selection.qualified}:null,
   missingConditions:best.reasons,checks:methodology.checks.map(({key,passed})=>({key,passed}))});
 }
 ranked.sort((a,b)=>b.rank-a.rank||a.symbol.localeCompare(b.symbol));
 return {status:'available',scanned:scan.records.length,total:scan.total||scan.records.length,partial:scan.partial===true,updatedAt:scan.updatedAt||scan.completedAt,candidates:ranked.slice(0,intent.limit),requested:intent.limit,...(Object.keys(filters).length?{appliedFilters:filters}:{}),...(excluded.size?{excludedSymbols:[...excluded]}:{}),
  note:'Completed daily sessions only. Rank is not a probability. A watch candidate fails one or more screening gates and must not be called a confirmed setup. Earnings dates, borrow availability and event risk are unverified. Never invent candidates to fill the requested count.'};
}
export const SCANNER_CHAT_POLICY=`\nThe user requested multiple stock candidates. Answer from SCANNER_DISCOVERY, independently of the open chart and past conversation. Give the requested number of distinct symbols when enough server candidates exist, one compact bullet per symbol: long/short, full match or watch status, numeric move and relevant conditional scenario when available. Use one brief date/timeframe label for the group. Clearly label missing conditions and watch-only candidates; never promote them to confirmed trades. If fewer candidates exist, state the actual count without inventing stocks. You have searched the supplied scanner records, not just the open chart. Do not ask for a new conversation or claim you only have one stock when multiple candidates are supplied. Preserve supplied numbers and side exactly. Do not claim current session prices or earnings knowledge. No sources section. Up to 160 words for three candidates.\n`;
