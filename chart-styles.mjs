export const chartStyles=['candles','line','area','bars','hollow','heikin','baseline'];
export const drawingTools=['trend','horizontal','vertical','rectangle','fibonacci','arrow','measure'];
export function heikinAshi(bars){
 let previous=null;return bars.map(b=>{if(![b.open,b.high,b.low,b.close].every(Number.isFinite))throw Error('Heikin Ashi דורש נתוני פתיחה לכל הנרות');const close=(b.open+b.high+b.low+b.close)/4,open=previous?(previous.open+previous.close)/2:(b.open+b.close)/2;previous={...b,open,close,high:Math.max(b.high,open,close),low:Math.min(b.low,open,close)};return previous});
}
export const fibonacciLevels=(a,b)=>[0,.236,.382,.5,.618,.786,1].map(ratio=>({ratio,price:b+(a-b)*ratio}));

export function drawingFromAnchors(bars,tool,start,end){
 if(!drawingTools.includes(tool))throw Error('כלי ציור אינו מוכר');
 function anchor(point){const index=bars.findIndex(b=>b.date===point?.date),price=['number','string'].includes(typeof point?.price)?Number(point.price):NaN;if(index<0||!Number.isFinite(price)||price<=0||price>1e12)throw Error('בחר תאריך נר שקיים בנתונים ומחיר חיובי תקין');return {index,price,tool}}
 const a=anchor(start),b=['horizontal','vertical'].includes(tool)?{...a}:anchor(end);return [a,b];
}
export function drawingMeasurement(a,b){
 if(![a?.price,b?.price].every(v=>Number.isFinite(v)&&v>0)||![a?.index,b?.index].every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('נקודות מדידה אינן תקינות');
 const percent=(b.price/a.price-1)*100;return {change:b.price-a.price,percent:Number.isFinite(percent)?percent:null,bars:b.index-a.index};
}
export function arrowHead(a,b,size=10){
 if(![a?.x,a?.y,b?.x,b?.y,size].every(Number.isFinite)||size<=0)throw Error('נקודות חץ אינן תקינות');
 const distance=Math.hypot(b.x-a.x,b.y-a.y);if(!distance)return [];
 const angle=Math.atan2(b.y-a.y,b.x-a.x),length=Math.min(size,distance/2);return [-1,1].map(sign=>({x:b.x-length*Math.cos(angle+sign*Math.PI/6),y:b.y-length*Math.sin(angle+sign*Math.PI/6)}));
}
