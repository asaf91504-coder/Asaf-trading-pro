import {validCandleTime} from './candle-time.mjs';
import {chartIndicators} from './chart-indicators.mjs';
export const alertLabels={'price-up':'חציית מחיר מעלה','price-down':'חציית מחיר מטה','ma20-up':'חצייה מעל MA20','ma20-down':'חצייה מתחת MA20','rsi-up':'חציית RSI מעלה','rsi-down':'חציית RSI מטה','macd-up':'MACD חוצה מעל איתות','macd-down':'MACD חוצה מתחת איתות','supertrend-up':'Supertrend מתהפך לעולה','supertrend-down':'Supertrend מתהפך ליורד','adx-up':'ADX חוצה עוצמה מעלה'};
export const alertKinds=Object.keys(alertLabels);
export const alertNeedsLevel=kind=>['price-up','price-down','rsi-up','rsi-down','adx-up'].includes(kind);
export function alertRules(value){if(!Array.isArray(value)||value.length>20)throw Error('מקסימום 20 כללים');const ids=new Set();return value.map(r=>{if(!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||ids.has(r.id)||typeof r.symbol!=='string'||!/^([A-Z]+:)?[A-Z0-9][A-Z0-9._-]{0,19}$/.test(r.symbol)||!alertKinds.includes(r.kind)||typeof r.enabled!=='boolean'||typeof r.quiet!=='boolean'||![r.quietStart,r.quietEnd].every(x=>Number.isInteger(x)&&x>=0&&x<=23)||r.quiet&&r.quietStart===r.quietEnd)throw Error('כלל התראה אינו תקין');ids.add(r.id);const level=alertNeedsLevel(r.kind)?r.level:null;if(alertNeedsLevel(r.kind)&&level===null)throw Error('חסרה רמת התראה');if(level!==null&&(typeof level!=='number'||!Number.isFinite(level)||level<=0||level>1e9||(r.kind.startsWith('rsi')||r.kind==='adx-up')&&level>100))throw Error('רמת התראה אינה תקינה');return {id:r.id,symbol:r.symbol,kind:r.kind,level,enabled:r.enabled,quiet:r.quiet,quietStart:r.quietStart,quietEnd:r.quietEnd}})}
export function alertSignature(r){return JSON.stringify([r.symbol,r.kind,r.level,r.enabled,r.quiet,r.quietStart,r.quietEnd])}
export function alertCandidate(rule,input,now=Date.now(),{source='Twelve Data'}={}){
 if(!rule.enabled)return null;const hour=new Date(now).getUTCHours();if(rule.quiet&&(rule.quietStart<rule.quietEnd?hour>=rule.quietStart&&hour<rule.quietEnd:hour>=rule.quietStart||hour<rule.quietEnd))return null;
 if(!Array.isArray(input)||input.some((b,i)=>!b||!validCandleTime(b.date)||![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.high<b.low||b.close<b.low||b.close>b.high||(i&&b.date<=input[i-1].date)))return null;
 const today=new Date(now).toISOString().slice(0,10),bars=input.filter(b=>b.date.length===10&&b.date<today);if(bars.length<2)return null;const last=bars.at(-1),prior=bars.at(-2),end=Date.parse(last.date+'T00:00:00Z')+86400000;
 if(!Number.isFinite(end)||now-end>7*86400000||end<rule.createdAt)return null;
 let before=prior.close,current=last.close,threshold=rule.level;
 if(rule.kind.startsWith('ma20-')){const ma=chartIndicators(bars).ma20;if(ma.at(-2)===null||ma.at(-1)===null)return null;before-=ma.at(-2);current-=ma.at(-1);threshold=0}
 if(rule.kind.startsWith('rsi')){const values=chartIndicators(bars).rsi14;before=values.at(-2);current=values.at(-1);if(!Number.isFinite(before)||!Number.isFinite(current))return null}
 if(rule.kind.startsWith('macd-')){const v=chartIndicators(bars);if(![v.macd.at(-2),v.macd.at(-1),v.macdSignal.at(-2),v.macdSignal.at(-1)].every(Number.isFinite))return null;before=v.macd.at(-2)-v.macdSignal.at(-2);current=v.macd.at(-1)-v.macdSignal.at(-1);threshold=0}
 if(rule.kind==='adx-up'){const v=chartIndicators(bars).adx14;before=v.at(-2);current=v.at(-1);if(![before,current].every(Number.isFinite))return null}
 if(rule.kind.startsWith('supertrend-')){const v=chartIndicators(bars).supertrendDirection;if(!v.at(-2)||!v.at(-1))return null;before=v.at(-2)==='up'?1:-1;current=v.at(-1)==='up'?1:-1;threshold=0}
 const up=rule.kind.endsWith('up'),crossed=rule.kind.startsWith('macd-')?(up?before<=threshold&&current>threshold:before>=threshold&&current<threshold):(up?before<threshold&&current>=threshold:before>threshold&&current<=threshold);if(!crossed)return null;
 return {key:rule.id+':'+last.date+':'+alertSignature(rule),ruleId:rule.id,symbol:rule.symbol,kind:rule.kind,level:rule.level,barTime:last.date,close:last.close,createdAt:new Date(now).toISOString(),source,message:rule.symbol+' · חצייה '+(up?'מעלה':'מטה')+' · '+rule.kind+' · נר יומי סגור '+last.date};
}
