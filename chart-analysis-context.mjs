// Resolve browser viewport dates against the actual validated candle series.
// Browser-provided prices, counts and summaries are never trusted.
export function chartViewContext(bars, range) {
 if (!Array.isArray(bars) || !range || typeof range.start !== 'string' || typeof range.end !== 'string') return null;
 const start=bars.findIndex(bar=>bar.date===range.start), end=bars.findIndex(bar=>bar.date===range.end);
 if(start<0 || end<start)return null;
 const visible=bars.slice(start,end+1),first=visible[0],last=visible.at(-1);
 return {firstCandleTime:first.date,lastCandleTime:last.date,candleCount:visible.length,
  low:Math.min(...visible.map(bar=>bar.low)),high:Math.max(...visible.map(bar=>bar.high)),
  closeChangePercent:(last.close/first.close-1)*100,
  includesLatestLoadedBar:end===bars.length-1,
  scope:'Browser-selected dates resolved against validated candles; indicator periods still use full loaded history.'};
}

export function technicalEvidence(context,bars) {
 const last=bars.at(-1),prev=bars.at(-2);
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const previousVolumes=bars.slice(-21,-1).map(bar=>bar.volume),averageVolume=previousVolumes.length===20&&previousVolumes.every(finite)?previousVolumes.reduce((a,b)=>a+b,0)/20:null;
 return {changeFromPreviousClosePercent:context.dailyChangePercent,
  aboveMA20:typeof context.aboveMA20==='boolean'?context.aboveMA20:null,
  aboveMA150:typeof context.aboveMA150==='boolean'?context.aboveMA150:null,
  distanceFromMA20Percent:finite(context.sma20)&&context.sma20>0?(last.close/context.sma20-1)*100:null,
  volumeAbovePreviousBar:finite(last.volume)&&finite(prev?.volume)?last.volume>prev.volume:null,
  volumeAbovePrior20Average:finite(last.volume)&&averageVolume>0?last.volume>averageVolume:null,
  prior20Low:Math.min(...bars.slice(-21,-1).map(bar=>bar.low)),
  marketCap:null,earningsDate:null,targetUpsidePercent:null,
  missingEvidence:['Market cap, earnings dates and a justified 15% upside target are not established by OHLCV candles.'],
  periodUnit:'candles, not necessarily days'};
}

export function analysisReceipt(context) {
 if(!context || typeof context.symbol!=='string' || typeof context.lastCandleTime!=='string')return '';
 const verified=['server-provider-cache','server-crypto-cache'].includes(context.provenance);
 const parts=[context.symbol,context.source||'מקור לא מאומת',context.interval||'',
  'נר אחרון בסדרה: '+context.lastCandleTime,
  Number.isInteger(context.candleCount)?context.candleCount+' נרות':'',
  verified?'תואם לעותק הנתונים בשרת':'מקור הנתונים לא אומת בשרת'];
 const view=context.visibleChart;
 if(view)parts.push('טווח שנראה בבקשה: '+view.firstCandleTime+' עד '+view.lastCandleTime+(view.includesLatestLoadedBar?'':' · תצוגה היסטורית'));
 parts.push('אינו מבטיח נתונים בזמן אמת');
 return parts.filter(Boolean).join(' · ');
}
