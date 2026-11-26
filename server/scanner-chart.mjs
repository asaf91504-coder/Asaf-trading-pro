import {marketSelection,MarketError} from './market-feed.mjs';
import {readSharedScan,sharedScannerEnabled} from './shared-scanner.mjs';
import {readScannerSnapshot} from './scanner-market-data.mjs';
import {scanBars} from '../scanner-core.mjs';
import {screenWithMethodology,reviewScannerMethodology,selectMethodologyCandidate} from './asaf-methodology.mjs';

export async function scannerChartContext({selected,context,env,run,fetcher,now,memberId}){
 if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(k=>!['asOf','receivedAt','side','autoAnnotate'].includes(k))||
    !/^\d{4}-\d{2}-\d{2}$/.test(context.asOf||'')||typeof context.receivedAt!=='string'||!Number.isFinite(Date.parse(context.receivedAt))||
    context.side!==undefined&&!['long','short'].includes(context.side)||context.autoAnnotate!==undefined&&typeof context.autoAnnotate!=='boolean')throw new MarketError('הפניה מתוצאת הסריקה אינה תקינה.',400);
 const {symbol}=marketSelection(selected,'1day',env);
 let record;
 if(sharedScannerEnabled(env)){
  const scan=await readSharedScan({env,run,now,memberId,symbols:[symbol]});record=scan.records.find(r=>r.symbol===symbol);
 }else{
  const snapshot=await readScannerSnapshot({selected:symbol,memberId,env,run,fetcher,now,cachedOnly:true,maxAgeMs:86400000});
  record={...scanBars(symbol,snapshot.bars,snapshot),...snapshot};
 }
 if(!record||record.summary?.date!==context.asOf||record.receivedAt!==context.receivedAt)throw new MarketError('תוצאת הסריקה עודכנה. רענן את הסורק ופתח שוב את הגרף.',409);
 const reviewed=context.side?reviewScannerMethodology(record,{side:context.side,now}):screenWithMethodology(record,{scenarioSide:'any'},{now});
 const side=reviewed.methodology.side;
 const selection=selectMethodologyCandidate(reviewed.record,{side,fullMatch:reviewed.methodology.eligible}),candidate=selection.candidate;
 const tradeScenario=candidate?{...candidate.scenario,available:true,asOf:context.asOf,watchOnly:selection.watchOnly,methodologyQualified:selection.qualified}:null;
 const actions=[{type:'indicator',indicator:'MA20',enabled:true},{type:'indicator',indicator:'MA150',enabled:true},
  {type:'pattern',pattern:'all'},{type:'levels',kind:'both'},{type:'trendlines'},...(tradeScenario?[{type:'tradelevels',side}]:[])];
 return {snapshot:{...record,latestBarTime:context.asOf,cached:true,delayMinutes:Number(env.ASAF_MARKET_DELAY_MINUTES)},
  context:{asOf:context.asOf,receivedAt:context.receivedAt,side},actions,tradeScenario};
}
