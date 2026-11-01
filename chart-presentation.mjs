// Stable, round-number axis ticks; prices and candles remain unmodified.
export function priceTicks(min,max,target=5){
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return [];
 const rough=(max-min)/Math.max(2,target),base=10**Math.floor(Math.log10(rough));
 const step=[1,2,2.5,5,10].map(n=>n*base).find(n=>n>=rough);
 if(!Number.isFinite(step)||step<=0)return [];
 const first=Math.ceil(min/step),last=Math.floor(max/step),ticks=[];
 for(let n=first;n<=last&&ticks.length<20;n++)ticks.push(Number((n*step).toPrecision(12)));
 return ticks;
}
export function chartTimeLabel(date,intraday=false){
 const value=String(date||'');return intraday&&value.includes('T')?value.slice(11,16):value.slice(5,10);
}
