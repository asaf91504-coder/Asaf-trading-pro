import {validCandleTime} from '../candle-time.mjs';

// Same Wilder convention as the scanner: seed from 14 changes, then smooth.
// Compute from the trusted closed prices, not the rounded display summary.
export function closedSetupAtr14(record){
 const bars=record.bars;
 if(record.interval!=='1day'||record.barPolicy!=='previous-daily-sessions'||record.latestBarMayBePartial!==false||
    !Array.isArray(bars)||bars.length<15||bars.at(-1)?.date!==record.summary?.date)return null;
 const conflicts=new Set(record.volumeConflictDates||[]);
 let sum=0,atr=null;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],previous=bars[i-1];
  if(typeof b?.date!=='string'||b.date.length!==10||!validCandleTime(b.date)||conflicts.has(b.date)||
     ![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0&&v<=1e12)||b.high<b.close||b.low>b.close||
     (previous&&b.date<=previous.date))return null;
  if(!previous)continue;
  const tr=Math.max(b.high-b.low,Math.abs(b.high-previous.close),Math.abs(b.low-previous.close));
  if(i<=14){sum+=tr;if(i===14)atr=sum/14;}else atr=(atr*13+tr)/14;
 }
 return Number.isFinite(atr)&&atr>0?atr:null;
}

export function exactTwoAtrStop(s,atr){
 if(!Number.isFinite(atr)||atr<=0||!Number.isFinite(s?.entry)||s.entry<=0||!['long','short'].includes(s.side))return null;
 const stop=s.entry+(s.side==='long'?-2:2)*atr;
 return Number.isFinite(stop)&&stop>0&&stop<=1e12&&stop!==s.entry?{...s,stop}:null;
}
export function stopWithinSetupAtr(s,atr){
 const exact=exactTwoAtrStop(s,atr);
 return exact!==null&&s.stop===exact.stop;
}
