export const chartStyles=['candles','line','area','bars','hollow','heikin','baseline'];
export const drawingTools=['trend','horizontal','vertical','rectangle','fibonacci'];
export function heikinAshi(bars){
 let previous=null;return bars.map(b=>{if(![b.open,b.high,b.low,b.close].every(Number.isFinite))throw Error('Heikin Ashi דורש נתוני פתיחה לכל הנרות');const close=(b.open+b.high+b.low+b.close)/4,open=previous?(previous.open+previous.close)/2:(b.open+b.close)/2;previous={...b,open,close,high:Math.max(b.high,open,close),low:Math.min(b.low,open,close)};return previous});
}
export const fibonacciLevels=(a,b)=>[0,.236,.382,.5,.618,.786,1].map(ratio=>({ratio,price:b+(a-b)*ratio}));
