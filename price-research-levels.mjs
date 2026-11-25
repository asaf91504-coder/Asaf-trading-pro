// Candidate price zones, not guaranteed support/resistance or trade orders.
// Confirm pivots using two later bars, excluding the newest possibly open bar.
export function priceResearchLevels(bars){
 if(!Array.isArray(bars)||bars.length<21)return null;
 const recent=bars.slice(-200),last=recent.at(-1).close;
 if(!Number.isFinite(last)||last<=0)return null;
 const lows=[],highs=[];
 for(let i=2;i<recent.length-3;i++){
  if([i-2,i-1,i+1,i+2].every(j=>recent[i].low<recent[j].low))lows.push(recent[i].low);
  if([i-2,i-1,i+1,i+2].every(j=>recent[i].high>recent[j].high))highs.push(recent[i].high);
 }
 const prior=recent.slice(-21,-1);
 lows.push(Math.min(...prior.map(b=>b.low)));
 highs.push(Math.max(...prior.map(b=>b.high)));
 const distinct=values=>[...new Set(values.filter(Number.isFinite))];
 return {support:distinct(lows).filter(x=>x<last).sort((a,b)=>b-a).slice(0,2),
  resistance:distinct(highs).filter(x=>x>last).sort((a,b)=>a-b).slice(0,2),
  brokenRangeHigh:last>Math.max(...prior.map(b=>b.high))?Math.max(...prior.map(b=>b.high)):null,
  brokenRangeLow:last<Math.min(...prior.map(b=>b.low))?Math.min(...prior.map(b=>b.low)):null,
  basis:'Candidate zones from confirmed swing pivots and prior 20-bar range; not guaranteed reactions.',
  barsUsed:recent.length};
}
