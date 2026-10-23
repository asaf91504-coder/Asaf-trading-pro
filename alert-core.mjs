import {chartIndicators} from './chart-indicators.mjs';
export const alertKinds=['price-up','price-down','ma20-up','rsi-up','rsi-down'];
export function alertRules(value){if(!Array.isArray(value)||value.length>20)throw Error('מקסימום 20 כללים');const ids=new Set();return value.map(r=>{if(!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||ids.has(r.id)||typeof r.symbol!=='string'||!/^([A-Z]+:)?[A-Z0-9][A-Z0-9._-]{0,19}$/.test(r.symbol)||!alertKinds.includes(r.kind)||typeof r.enabled!=='boolean'||typeof r.quiet!=='boolean'||![r.quietStart,r.quietEnd].every(x=>Number.isInteger(x)&&x>=0&&x<=23)||r.quiet&&r.quietStart===r.quietEnd)throw Error('כלל התראה אינו תקין');ids.add(r.id);const level=r.kind==='ma20-up'?null:r.level;if(level!==null&&(typeof level!=='number'||!Number.isFinite(level)||level<=0||level>1e9||r.kind.startsWith('rsi')&&level>100))throw Error('רמת התראה אינה תקינה');return {id:r.id,symbol:r.symbol,kind:r.kind,level,enabled:r.enabled,quiet:r.quiet,quietStart:r.quietStart,quietEnd:r.quietEnd}})}
export function alertSignature(r){return JSON.stringify([r.symbol,r.kind,r.level,r.enabled,r.quiet,r.quietStart,r.quietEnd])}
export function alertCandidate(rule,input,now=Date.now()){
 if(!rule.enabled)return null;const hour=new Date(now).getUTCHours();if(rule.quiet&&(rule.quietStart<rule.quietEnd?hour>=rule.quietStart&&hour<rule.quietEnd:hour>=rule.quietStart||hour<rule.quietEnd))return null;
 const today=new Date(now).toISOString().slice(0,10),bars=input.filter(b=>b.date.length===10&&b.date<today);if(bars.length<2)return null;const last=bars.at(-1),prior=bars.at(-2),end=Date.parse(last.date+'T00:00:00Z')+86400000;
 if(!Number.isFinite(end)||now-end>7*86400000||end<rule.createdAt)return null;
 let before=prior.close,current=last.close,threshold=rule.level;
 if(rule.kind==='ma20-up'){const ma=chartIndicators(bars).ma20;if(ma.at(-2)===null||ma.at(-1)===null)return null;before-=ma.at(-2);current-=ma.at(-1);threshold=0}
 if(rule.kind.startsWith('rsi')){const values=chartIndicators(bars).rsi14;before=values.at(-2);current=values.at(-1);if(!Number.isFinite(before)||!Number.isFinite(current))return null}
 const up=rule.kind.endsWith('up'),crossed=up?before<threshold&&current>=threshold:before>threshold&&current<=threshold;if(!crossed)return null;
 return {key:rule.id+':'+last.date+':'+alertSignature(rule),ruleId:rule.id,symbol:rule.symbol,kind:rule.kind,level:rule.level,barTime:last.date,close:last.close,createdAt:new Date(now).toISOString(),source:'Twelve Data',message:rule.symbol+' · חצייה '+(up?'מעלה':'מטה')+' · '+rule.kind+' · נר יומי סגור '+last.date};
}
