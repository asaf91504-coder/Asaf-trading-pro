// Local raw-OHLC calculations; no requests, forecasts or trading actions.
export function trendIndicators(bars){
 const n=bars.length,empty=()=>Array(n).fill(null),adx14=empty(),plusDI14=empty(),minusDI14=empty(),dx14=empty(),supertrend=empty(),supertrendDirection=empty(),supertrendUp=empty(),supertrendDown=empty();
 let valid=true,trSum=0,plusSum=0,minusSum=0,dxSum=0,adx=null,atrSum=0,atr=null,upper=null,lower=null,direction=null;
 for(let i=0;i<n;i++){
  const b=bars[i];if(!b||![b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.high<b.low||b.close<b.low||b.close>b.high)valid=false;
  // Missing/malformed bars break continuity; never silently bridge the gap.
  if(!valid)continue;
  const prev=bars[i-1],tr=i?Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)):b.high-b.low;
  // Supertrend ATR10 uses Wilder smoothing, seeded by the first ten TRs,
  // including the first bar's high-low. Initial direction is down.
  if(i<10){atrSum+=tr;if(i===9)atr=atrSum/10}else atr=(atr*9+tr)/10;
  if(atr!==null){
   const mid=b.high/2+b.low/2,basicUpper=mid+3*atr,basicLower=mid-3*atr;
   if(direction===null){upper=basicUpper;lower=basicLower;direction='down'}
   else{
    const oldUpper=upper,oldLower=lower;
    upper=basicUpper<oldUpper||prev.close>oldUpper?basicUpper:oldUpper;
    lower=basicLower>oldLower||prev.close<oldLower?basicLower:oldLower;
    direction=direction==='down'?(b.close>upper?'up':'down'):(b.close<lower?'down':'up');
   }
   const line=direction==='up'?lower:upper;
   if(Number.isFinite(line)){supertrend[i]=line;supertrendDirection[i]=direction;(direction==='up'?supertrendUp:supertrendDown)[i]=line}
  }
  if(!i)continue;
  const up=b.high-prev.high,down=prev.low-b.low,plus=up>down&&up>0?up:0,minus=down>up&&down>0?down:0;
  if(i<=14){trSum+=tr;plusSum+=plus;minusSum+=minus;if(i<14)continue}
  else{trSum=trSum-trSum/14+tr;plusSum=plusSum-plusSum/14+plus;minusSum=minusSum-minusSum/14+minus}
  const p=trSum?100*plusSum/trSum:0,m=trSum?100*minusSum/trSum:0,dx=p+m?100*Math.abs(p-m)/(p+m):0;
  if(![p,m,dx].every(Number.isFinite)){valid=false;continue}
  plusDI14[i]=p;minusDI14[i]=m;dx14[i]=dx;
  // Fourteen DX values at indices 14..27 seed the first ADX.
  if(i<=27){dxSum+=dx;if(i===27)adx=dxSum/14}else adx=(adx*13+dx)/14;
  adx14[i]=adx;
 }
 return {adx14,plusDI14,minusDI14,dx14,supertrend,supertrendDirection,supertrendUp,supertrendDown};
}
