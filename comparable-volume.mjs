import {validCandleTime} from './candle-time.mjs';
import {newYorkDate} from './market-quality.mjs';

export const volumeUnavailableReason='לא ניתן לאמת מחזור השוואתי ל־20 ימי המסחר הקודמים';

export const partialVolumeReason='מחזור חלקי בלבד; אינו מספיק לאימות תנאי המחזור';

const knownCoverage=new Set(['partial','consolidated']);
const adjustments=new Set(['unadjusted','splits','splits-and-dividends']);
const identifier=/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/;
export const sameVolumeBasis=(a,b)=>['feed','session','coverage','basis','adjustment'].every(key=>a?.[key]===b?.[key]);

// This evidence is valid only for a single server-attested daily series. Scope
// is inherited from that series unless a candle declares conflicting provenance.
export function comparableDailyVolume(bars, meta={}, {verifyWholeSeries=false}={}){
 const unverifiable=reason=>({status:'unverifiable',reason,coverage:null,ratio:null,aboveAverage:null,abovePreviousVolume:null,rising:null});
 const basis=meta.volumeBasis;
 if(meta.interval!=='1day'||meta.barPolicy!=='previous-daily-sessions'||meta.latestBarMayBePartial!==false)return unverifiable('daily-sessions-unverified');
 if(!basis||!identifier.test(basis.feed||'')||basis.session!=='regular'||
    !knownCoverage.has(basis.coverage)||!identifier.test(basis.basis||'')||!adjustments.has(basis.adjustment))return unverifiable('provenance-unverified');
 if(!Array.isArray(bars)||bars.length<21)return unverifiable('insufficient-history');
 const window=bars.slice(-21),checked=verifyWholeSeries?bars:window;
 const receipt=typeof meta.receivedAt==='string'?Date.parse(meta.receivedAt):null;
 if(receipt!==null&&!Number.isFinite(receipt))return unverifiable('invalid-session-history');
 const receiptDate=receipt===null?null:newYorkDate(receipt);
 const conflicts=new Set(Array.isArray(meta.volumeConflictDates)?meta.volumeConflictDates:[]);
 if(basis.verifiedFrom!==undefined&&(!validCandleTime(basis.verifiedFrom)||basis.verifiedFrom.length!==10))return unverifiable('provenance-unverified');
 for(const [i,b] of checked.entries()){
  if(!b||typeof b.date!=='string'||b.date.length!==10||!validCandleTime(b.date)||(i&&b.date<=checked[i-1].date))
   return unverifiable('invalid-session-history');
  if(receiptDate&&b.date>=receiptDate)return unverifiable('daily-sessions-unverified');
  if(basis.verifiedFrom&&b.date<basis.verifiedFrom)return unverifiable('provenance-unverified');
  if(conflicts.has(b.date)||b.complete===false||(b.volumeBasis!==undefined&&!sameVolumeBasis(b.volumeBasis,basis)))return unverifiable('mixed-or-open-session');
  if(!Number.isFinite(b.volume)||b.volume<=0||!Number.isFinite(b.close)||b.close<=0)return unverifiable('missing-or-invalid-volume');
 }
 const last=window.at(-1),prior=window.at(-2);
 const average=window.slice(0,20).reduce((total,b)=>total+b.volume,0)/20;
 const ratio=last.volume/average;
 if(!Number.isFinite(average)||average<=0||!Number.isFinite(ratio)||ratio<=0)return unverifiable('missing-or-invalid-volume');
 const aboveAverage=last.volume>average;
 return {status:'verified',reason:null,coverage:basis.coverage,ratio,aboveAverage,abovePreviousVolume:last.volume>prior.volume,rising:aboveAverage&&last.close>prior.close};
}
