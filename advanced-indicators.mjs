// Intraday date buckets follow supplied candle timestamps, not an inferred exchange calendar.
export function advancedIndicators(bars){
 const n=bars.length,empty=()=>Array(n).fill(null),vwap=empty(),tenkan=empty(),kijun=empty(),cloudA=empty(),cloudB=empty();
 let day=null,sum=0,volume=0,valid=true;
 for(let i=0;i<n;i++){
  const b=bars[i],date=b.date?.slice(0,10);
  if(date!==day){day=date;sum=0;volume=0;valid=true}
  if(typeof b.date==='string'&&b.date.length>10){
   if(![b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.volume<0)valid=false;
   if(valid){sum+=(b.high/3+b.low/3+b.close/3)*b.volume;volume+=b.volume;if(volume>0&&Number.isFinite(sum))vwap[i]=sum/volume}
  }
  const mid=period=>{if(i<period-1)return null;const w=bars.slice(i-period+1,i+1);if(w.some(x=>![x.high,x.low].every(Number.isFinite)||x.low<=0||x.high<x.low))return null;return Math.max(...w.map(x=>x.high))/2+Math.min(...w.map(x=>x.low))/2};
  tenkan[i]=mid(9);kijun[i]=mid(26);
  if(i+26<n){if(tenkan[i]!==null&&kijun[i]!==null)cloudA[i+26]=tenkan[i]/2+kijun[i]/2;cloudB[i+26]=mid(52)}
 }
 return {vwap,tenkan,kijun,cloudA,cloudB};
}
