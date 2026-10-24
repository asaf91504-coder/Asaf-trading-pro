export const chartStyles=['candles','line','area','bars','hollow','heikin','baseline'];
export const drawingTools=['trend','horizontal','vertical','rectangle','fibonacci','arrow','measure','text','long','short','channel'];
export function heikinAshi(bars){
 let previous=null;return bars.map(b=>{if(![b.open,b.high,b.low,b.close].every(Number.isFinite))throw Error('Heikin Ashi דורש נתוני פתיחה לכל הנרות');const close=(b.open+b.high+b.low+b.close)/4,open=previous?(previous.open+previous.close)/2:(b.open+b.close)/2;previous={...b,open,close,high:Math.max(b.high,open,close),low:Math.min(b.low,open,close)};return previous});
}
export const fibonacciLevels=(a,b)=>[0,.236,.382,.5,.618,.786,1].map(ratio=>({ratio,price:b+(a-b)*ratio}));

export function drawingFromAnchors(bars,tool,start,end){
 if(!drawingTools.includes(tool))throw Error('כלי ציור אינו מוכר');
 function anchor(point){const index=bars.findIndex(b=>b.date===point?.date),price=['number','string'].includes(typeof point?.price)?Number(point.price):NaN;if(index<0||!Number.isFinite(price)||price<=0||price>1e12)throw Error('בחר תאריך נר שקיים בנתונים ומחיר חיובי תקין');return {index,price,tool,...(tool==='text'?{text:drawingText(point.text)}:{}),...(tool==='channel'?{offset:channelOffset(point.offset??start.offset)}:{}),...(['long','short'].includes(tool)?{rr:drawingRR(point.rr??2)}:{})}}
 const a=anchor(start),b=['horizontal','vertical','text'].includes(tool)?{...a}:anchor(end);if(['long','short'].includes(tool))drawingTradePlan(a,b);if(tool==='channel')channelGeometry(a,b);return [a,b];
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

export function drawingText(value){if(typeof value!=='string'||!value.trim()||value.length>100)throw Error('הזן טקסט עד 100 תווים');const clean=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!clean)throw Error('הזן טקסט עד 100 תווים');return clean}
export function drawingRR(value){const rr=['number','string'].includes(typeof value)?Number(value):NaN;if(!Number.isFinite(rr)||rr<.1||rr>100)throw Error('יחס יעד חייב להיות בין 0.1 ל-100');return rr}
export function drawingTradePlan(a,b){
 const side=a.tool;if(!['long','short'].includes(side)||![a.price,b.price].every(v=>Number.isFinite(v)&&v>0&&v<=1e12))throw Error('תרחיש ציור אינו תקין');
 const rr=drawingRR(a.rr??2),risk=side==='long'?a.price-b.price:b.price-a.price,target=side==='long'?a.price+risk*rr:a.price-risk*rr;
 if(risk<=0||!Number.isFinite(target)||target<=0||target>1e12)throw Error('בלונג הסטופ מתחת לכניסה; בשורט מעליה. היעד חייב להיות חיובי.');return {side,entry:a.price,stop:b.price,target,rr,risk};
}

export function channelOffset(value){const n=['number','string'].includes(typeof value)?Number(value):NaN;if(!Number.isFinite(n)||n<=0||n>1e12)throw Error('רוחב תעלה חייב להיות מספר חיובי');return n}
export function channelGeometry(a,b){const offset=channelOffset(a.offset);if(![a.index,b.index].every(n=>Number.isSafeInteger(n)&&n>=0)||a.index===b.index||![a.price,b.price].every(n=>Number.isFinite(n)&&n>0&&n+offset<=1e12))throw Error('תעלה דורשת שני נרות שונים ומחירים תקינים');return [[a,b],[{...a,price:a.price+offset},{...b,price:b.price+offset}]]}
