import {chartStyles,drawingTools} from './chart-styles.mjs';
import {safeSourceUrl} from './scanner-core.mjs';
export const personalSections=['journal','research','chartPreferences','drawings'];
export const personalKeys={journal:'asaf_trades_v1',research:'asaf_research_sources_v1',chartPreferences:'asaf_chart_preferences_v1',drawings:'asaf_chart_drawings_v1'};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(v);
const symbol=v=>typeof v==='string'&&/^[A-Z0-9:._-]{1,30}$/.test(v);
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e12;
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function array(v,max){if(!Array.isArray(v)||v.length>max)throw Error('מספר הרשומות גדול מדי או שהנתונים אינם תקינים');return v}
export const tradeProfit=t=>(t.side==='short'?t.entry-t.exit:t.exit-t.entry)*t.qty-t.fees;
export function personalData(section,value){
 if(section==='journal'){
  const seen=new Set();return array(value,300).map(t=>{
   if(!object(t)||!id(t.id)||seen.has(t.id)||!symbol(t.symbol)||!date(t.date)||!['long','short'].includes(t.side)||![t.entry,t.exit,t.qty].every(positive)||typeof t.fees!=='number'||!Number.isFinite(t.fees)||t.fees<0||t.fees>1e12||!text(t.setup,100)||!['A','B','C'].includes(t.quality)||!text(t.note,1000)||!Number.isFinite(tradeProfit(t)))throw Error('רשומת יומן אינה תקינה');seen.add(t.id);
   return Object.fromEntries(['id','symbol','date','side','entry','exit','qty','fees','setup','quality','note'].map(k=>[k,t[k]]));
  });
 }
 if(section==='research'){
  const seen=new Set();return array(value,100).map(t=>{if(!object(t)||!id(t.id)||seen.has(t.id)||!text(t.title,180)||!t.title.trim()||!text(t.note,2000)||!(t.symbol===''||symbol(t.symbol))||!text(t.url,2048)||!text(t.saved,40)||!Number.isFinite(Date.parse(t.saved)))throw Error('מקור מחקר אינו תקין');seen.add(t.id);return {id:t.id,title:t.title,symbol:t.symbol,note:t.note,url:safeSourceUrl(t.url),saved:t.saved}});
 }
 if(section==='chartPreferences'){
  if(!object(value))throw Error('העדפות הגרף אינן תקינות');const result={};
  if(value.style!==undefined){if(!chartStyles.includes(value.style))throw Error('סגנון גרף אינו תקין');result.style=value.style}
  for(const key of ['chartMA20','chartMA150','chartEMA50','chartRSI14','chartBB20','chartMACD','chartATR14'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw Error('העדפת אינדיקטור אינה תקינה');result[key]=value[key]}
  return result;
 }
 if(section==='drawings'){
  if(!object(value)||Object.keys(value).length>30)throw Error('מקסימום 30 מניות עם קווים');const result={};
  for(const [key,item] of Object.entries(value)){if(!symbol(key)||!object(item)||!Number.isFinite(item.savedAt)||item.savedAt<0)throw Error('נתוני קווים אינם תקינים');result[key]={savedAt:item.savedAt,lines:array(item.lines,30).map(line=>{if(!Array.isArray(line)||line.length!==2||!line.every(p=>object(p)&&stamp(p.date)&&positive(p.price)&&(p.tool===undefined||drawingTools.includes(p.tool))))throw Error('נקודת ציור אינה תקינה');return line.map(p=>({date:p.date,price:p.price,...(p.tool?{tool:p.tool}:{})}))})}}
  return result;
 }
 throw Error('סוג נתונים לא מוכר');
}
export const emptyPersonal=section=>['journal','research'].includes(section)?[]:{};
// Cloud wins equal IDs. Import never silently drops records at the section limit.
export function mergePersonal(section,local,remote){
 const a=personalData(section,local),b=personalData(section,remote);
 if(['journal','research'].includes(section)){const ids=new Set(b.map(x=>x.id));return personalData(section,[...b,...a.filter(x=>!ids.has(x.id))])}
 return personalData(section,{...a,...b});
}
export function personalBackup(section,value){return {kind:'asaf-personal',version:1,section,exportedAt:new Date().toISOString(),data:personalData(section,value)}}
export function parsePersonalBackup(text,section){if(typeof text!=='string'||new TextEncoder().encode(text).length>750000)throw Error('גיבוי גדול מדי');const v=JSON.parse(text);if(v?.kind!=='asaf-personal'||v.version!==1||v.section!==section)throw Error('הגיבוי אינו מתאים לסוג הנתונים שנבחר');return personalData(section,v.data)}
