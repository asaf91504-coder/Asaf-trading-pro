import {parseCSV,analyze} from './analyzer.mjs';
export function scanFile(name,text){
 const all=parseCSV(text),bars=all.slice(-200);
 const tickers=[...new Set(all.map(b=>b.ticker).filter(Boolean))];
 if(tickers.length>1)throw Error('הקובץ מכיל כמה מניות; יש להפריד לקבצים');
 if(bars.some(b=>b.date.length>10))throw Error('הסורק משתמש בנרות יומיים בלבד כדי להשוות MA ו-ATR; לגרף ניתן להעלות גם נתונים תוך־יומיים');
 const inferred=String(name).replace(/\.csv$/i,'').toUpperCase();
 const symbol=tickers[0]||(/^[A-Z0-9:._-]{1,30}$/.test(inferred)?inferred:null);
 if(!symbol)throw Error('אין סימול בקובץ. הוסף עמודת Symbol או שם קובץ כמו AAPL.csv');
 return {symbol,bars,summary:analyze(bars),symbolFrom:tickers.length?'column':'filename'};
}
export function screenResult(record,{minPrice=5,minVolume=1,above20=true,minATR=0,breakout20=false,risingVolume=false}={}){
 const a=record.summary,reasons=[];
 if(a.close<=minPrice)reasons.push('מחיר אינו מעל '+minPrice);
 if(above20&&!a.aboveMA20)reasons.push('מתחת ל-MA20 או שווה לו');
 if(a.volumeRatio===null)reasons.push('מחזור חסר');
 else if(a.volumeRatio<minVolume)reasons.push('מחזור יחסי נמוך');
 if(minATR>0&&(a.atrPercent==null||a.atrPercent<minATR))reasons.push('ATR% מתחת לסף או חסר');
 if(breakout20&&!a.breakout20)reasons.push('אין סגירה מעל שיא 20 הימים הקודמים');
 if(risingVolume){
  const last=record.bars.at(-1),prior=record.bars.at(-2);
  if(!prior||last.close<=prior.close)reasons.push('הסגירה אינה מעל הסגירה הקודמת');
  if(a.volumeRatio===null||a.volumeRatio<=1)reasons.push('אין מחזור מעל ממוצע 20 הימים הקודמים');
 }
 return {matches:!reasons.length,reasons};
}
export function safeSourceUrl(value){const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('יש להזין קישור HTTP/HTTPS ללא פרטי גישה');return u.href}
export const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
