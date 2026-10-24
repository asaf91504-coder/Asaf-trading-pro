import {chartIndicators} from './chart-indicators.mjs';

export const patternLabels={breakout20:'סגירה מעל שיא 20 נרות',breakdown20:'סגירה מתחת לשפל 20 נרות',consolidation:'טווח צר של 20 נרות',squeeze:'רוחב בולינגר באחוזון נמוך',doubleBottom:'מועמד לדאבל בוטום',gapUp:'פער פתיחה מעלה ≥2%',gapDown:'פער פתיחה מטה ≥2%'};
export const patternStages={crossed:'חצייה בנר האחרון',waiting:'ממתין לחצייה',above:'כבר מעל הרמה',observed:'נצפה בנתונים'};
export function measuredScenario(side,close,trigger,support,target){
 if(!['long','short'].includes(side)||![close,trigger,support,target].every(v=>Number.isFinite(v)&&v>0))return null;
 const entry=side==='long'?Math.max(close,trigger):Math.min(close,trigger),stop=side==='long'?support*.99:support*1.01;
 const risk=side==='long'?entry-stop:stop-entry,reward=side==='long'?target-entry:entry-target;
 if(![entry,stop,target,risk,reward].every(v=>Number.isFinite(v)&&v>0))return null;
 const riskReward=reward/risk,movePercent=reward/entry*100;if(![riskReward,movePercent].every(Number.isFinite))return null;
 return {side,entry,stop,target,riskReward,movePercent,method:'Measured range height; stop reference 1% beyond range. Illustrative only, no execution or probability estimate.'};
}

// Engineering heuristics over loaded daily candles, not a certified pattern classifier.
export function patternResearch(input){
 const unavailable=reason=>({available:false,reason,candidates:[]});
 if(!Array.isArray(input)||input.length<21)return unavailable('נדרשים לפחות 21 נרות יומיים.');
 const bars=input.slice(-200),validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(bars.some((b,i)=>!validDate(b?.date)||![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0&&v<=1e12)||b.high<b.low||b.close<b.low||b.close>b.high||(i&&b.date<=bars[i-1].date)))return unavailable('נדרשת סדרת OHLC יומית תקינה ומסודרת.');
 const last=bars.at(-1),prior=bars.at(-2),window=bars.slice(-21,-1),resistance=Math.max(...window.map(b=>b.high)),support=Math.min(...window.map(b=>b.low)),height=resistance-support;
 const finite=v=>Number.isFinite(v)?v:null;
 const candidates=[],rangePercent=finite(height/last.close*100),add=(kind,stage,details)=>candidates.push({kind,label:patternLabels[kind],stage,asOf:last.date,...details});
 if(last.close>resistance)add('breakout20','crossed',{trigger:resistance,support,scenario:measuredScenario('long',last.close,resistance,support,resistance+height)});
 if(last.close<support)add('breakdown20','crossed',{trigger:support,resistance,scenario:measuredScenario('short',last.close,support,resistance,support-height)});
 if(rangePercent!==null&&rangePercent<=8&&last.close>=support&&last.close<=resistance)add('consolidation','waiting',{support,resistance,rangePercent,scenario:null});
 const gapPercent=Number.isFinite(last.open)&&last.open>0&&(last.open>=last.low&&last.open<=last.high)?finite((last.open/prior.close-1)*100):null;
 if(gapPercent>=2)add('gapUp','observed',{gapPercent,scenario:null});if(gapPercent!==null&&gapPercent<=-2)add('gapDown','observed',{gapPercent,scenario:null});
 const indicators=chartIndicators(bars),widths=indicators.ma20.map((middle,i)=>middle===null?null:100*(indicators.bbUpper[i]-indicators.bbLower[i])/middle),width=widths.at(-1),baseline=widths.slice(0,-1).filter(Number.isFinite).slice(-60);
 const widthPercentile=baseline.length===60&&Number.isFinite(width)?baseline.filter(v=>v<width).length/60*100:null;
 if(widthPercentile!==null&&widthPercentile<=10)add('squeeze','observed',{widthPercent:width,percentile:widthPercentile,baselineBars:60,scenario:null});
 // A pivot needs two later completed observations BEFORE the latest candle.
 const lows=[];for(let i=Math.max(2,bars.length-80);i<bars.length-3;i++)if([i-2,i-1,i+1,i+2].every(j=>bars[i].low<bars[j].low))lows.push(i);
 let found=false;
 for(let q=lows.length-1;q>=1&&!found;q--)for(let p=q-1;p>=0;p--){
  const a=lows[p],b=lows[q],low=Math.min(bars[a].low,bars[b].low),similarity=Math.abs(bars[a].low-bars[b].low)/((bars[a].low+bars[b].low)/2);
  if(a<8||b-a<5||b-a>40||bars.length-1-b>20||similarity>.03)continue;
  const neckline=Math.max(...bars.slice(a+1,b).map(x=>x.high));
  if(neckline/low<1.05||Math.max(...bars.slice(a-8,a).map(x=>x.close))/low<1.08||bars.slice(b+1).some(x=>x.low<low*.97))continue;
  const stage=last.close>neckline?(prior.close<=neckline?'crossed':'above'):'waiting';
  add('doubleBottom',stage,{firstLowDate:bars[a].date,secondLowDate:bars[b].date,firstLow:bars[a].low,secondLow:bars[b].low,support:low,trigger:neckline,targetFromHeight:neckline+(neckline-low),scenario:measuredScenario('long',last.close,neckline,low,neckline+(neckline-low))});found=true;break;
 }
 return {available:true,asOf:last.date,bars:bars.length,support20:support,resistance20:resistance,rangePercent20:rangePercent,gapOpenPercent:gapPercent,bollingerWidthPercent:width,bollingerWidthPercentile:widthPercentile,candidates,
  limitations:['Heuristics on at most 200 loaded daily bars; latest bar may be incomplete.','Market cap, corporate actions, earnings and live prices are not verified.','Measured targets and stop references are scenarios, not predictions, orders or guaranteed returns.'],
  rules:{rangeBars:20,consolidationMaxPercent:8,gapOpenMinPercent:2,squeezeBaselineBars:60,squeezeMaxPercentile:10,pivotSideBars:2,doubleBottomLowTolerancePercent:3,doubleBottomSeparationBars:[5,40],doubleBottomMinHeightPercent:5,doubleBottomPriorPeakAboveLowPercent:8,doubleBottomMaxAgeBars:20}};
}
