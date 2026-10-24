import {patternResearch,patternLabels} from './pattern-research.mjs';
import {parseCSV,analyze} from './analyzer.mjs';
import {indicatorSnapshot} from './chart-indicators.mjs';
export function scanFile(name,text){
 const all=parseCSV(text),bars=all.slice(-200);
 const tickers=[...new Set(all.map(b=>b.ticker).filter(Boolean))];
 if(tickers.length>1)throw Error('הקובץ מכיל כמה מניות; יש להפריד לקבצים');
 if(bars.some(b=>b.date.length>10))throw Error('הסורק משתמש בנרות יומיים בלבד כדי להשוות MA ו-ATR; לגרף ניתן להעלות גם נתונים תוך־יומיים');
 const inferred=String(name).replace(/\.csv$/i,'').toUpperCase();
 const symbol=tickers[0]||(/^[A-Z0-9:._-]{1,30}$/.test(inferred)?inferred:null);
 if(!symbol)throw Error('אין סימול בקובץ. הוסף עמודת Symbol או שם קובץ כמו AAPL.csv');
 return {...scanBars(symbol,bars),symbolFrom:tickers.length?'column':'filename'};
}
export function scanBars(symbol,bars){
 const indicators=indicatorSnapshot(bars);
 return {symbol,bars,research:patternResearch(bars),summary:{...analyze(bars),rsi14:indicators.rsi14,macd:indicators.macd12269.line,macdSignal:indicators.macd12269.signal,macdHistogram:indicators.macd12269.histogram,stochasticK:indicators.stochastic1433.k,stochasticD:indicators.stochastic1433.d,obv:indicators.obv,obvPrevious:indicators.obvPrevious},symbolFrom:'provider'};
}
export function screenResult(record,{minPrice=5,minVolume=1,above20=true,minATR=0,breakout20=false,risingVolume=false,rsiEnabled=false,minRSI=0,maxRSI=100,macdAboveSignal=false,macdPositive=false,stochasticAboveSignal=false,obvRising=false,pattern='any',crossedOnly=false,minMeasuredMove=0,minScenarioRR=0}={}){
 const a=record.summary,reasons=[];
 if(a.close<=minPrice)reasons.push('מחיר אינו מעל '+minPrice);
 if(above20&&!a.aboveMA20)reasons.push('מתחת ל-MA20 או שווה לו');
 if(a.volumeRatio===null)reasons.push('מחזור חסר');
 else if(a.volumeRatio<minVolume)reasons.push('מחזור יחסי נמוך');
 if(minATR>0&&(a.atrPercent==null||a.atrPercent<minATR))reasons.push('ATR% מתחת לסף או חסר');
 if(breakout20&&!a.breakout20)reasons.push('אין סגירה מעל שיא 20 הימים הקודמים');
 if(rsiEnabled){if(![minRSI,maxRSI].every(v=>Number.isFinite(v)&&v>=0&&v<=100)||minRSI>maxRSI)reasons.push('טווח RSI אינו תקין');else if(!Number.isFinite(a.rsi14))reasons.push('אין מספיק נרות ל-RSI14');else if(a.rsi14<minRSI||a.rsi14>maxRSI)reasons.push('RSI14 מחוץ לטווח שנבחר')}
 if(macdAboveSignal){if(!Number.isFinite(a.macd)||!Number.isFinite(a.macdSignal))reasons.push('אין מספיק נרות לקו איתות MACD');else if(a.macd<=a.macdSignal)reasons.push('MACD אינו מעל קו האיתות')}
 if(macdPositive){if(!Number.isFinite(a.macd))reasons.push('אין מספיק נרות ל-MACD');else if(a.macd<=0)reasons.push('MACD אינו חיובי')}
 if(stochasticAboveSignal){if(!Number.isFinite(a.stochasticK)||!Number.isFinite(a.stochasticD))reasons.push('אין Stochastic מוגדר: היסטוריה או טווח מחיר חסרים');else if(a.stochasticK<=a.stochasticD)reasons.push('Stochastic %K אינו מעל %D')}
 if(obvRising){if(!Number.isFinite(a.obv)||!Number.isFinite(a.obvPrevious))reasons.push('אין רצף מחזורים מלא לחישוב OBV');else if(a.obv<=a.obvPrevious)reasons.push('OBV אינו עולה בנר האחרון')}
 if(risingVolume){
  const last=record.bars.at(-1),prior=record.bars.at(-2);
  if(!prior||last.close<=prior.close)reasons.push('הסגירה אינה מעל הסגירה הקודמת');
  if(a.volumeRatio===null||a.volumeRatio<=1)reasons.push('אין מחזור מעל ממוצע 20 הימים הקודמים');
 }
 if(pattern!=='any'&&!Object.hasOwn(patternLabels,pattern))reasons.push('סוג תבנית אינו תקין');
 if(!Number.isFinite(minMeasuredMove)||minMeasuredMove<0||minMeasuredMove>1000||!Number.isFinite(minScenarioRR)||minScenarioRR<0||minScenarioRR>100)reasons.push('ספי תרחיש אינם תקינים');
 if(pattern!=='any'||crossedOnly||minMeasuredMove>0||minScenarioRR>0){
  const candidates=(record.research?.candidates||[]).filter(c=>pattern==='any'||c.kind===pattern);
  if(!record.research?.available)reasons.push('אין נתוני מחקר יומיים לתבניות');
  else if(!candidates.length)reasons.push('לא נמצא מועמד לתבנית שנבחרה');
  else if(!candidates.some(c=>(!crossedOnly||c.stage==='crossed')&&(!(minMeasuredMove>0||minScenarioRR>0)||(c.scenario&&c.scenario.movePercent>=minMeasuredMove&&c.scenario.riskReward>=minScenarioRR))))reasons.push('המועמדים אינם עומדים בחצייה או בספי התרחיש שנבחרו');
 }
 return {matches:!reasons.length,reasons};
}
export function safeSourceUrl(value){const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('יש להזין קישור HTTP/HTTPS ללא פרטי גישה');return u.href}
export const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
