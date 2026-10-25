import {scannerSettings} from './scanner-presets.mjs';
import {validCandleTime} from './candle-time.mjs';
import {chartStyles,drawingTools,drawingText,drawingRR,drawingTradePlan,channelOffset} from './chart-styles.mjs';
import {safeSourceUrl} from './scanner-core.mjs';
export const personalSections=['journal','research','chartPreferences','drawings','conversations','layouts','scannerPresets'];
export const personalKeys={journal:'asaf_trades_v1',research:'asaf_research_sources_v1',chartPreferences:'asaf_chart_preferences_v1',drawings:'asaf_chart_drawings_v1',conversations:'asaf_conversation_archive_v1',layouts:'asaf_layouts_v1',scannerPresets:'asaf_scanner_presets_v1'};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(v);
const symbol=v=>typeof v==='string'&&/^[A-Z0-9:._-]{1,30}$/.test(v);
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e12;
const stamp=validCandleTime;
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
 if(section==='conversations'){
  const seen=new Set();const result=array(value,20).map(t=>{
   if(!object(t)||!id(t.id)||seen.has(t.id)||!symbol(t.symbol)||!text(t.title,120)||!t.title.trim()||!text(t.saved,40)||!Number.isFinite(Date.parse(t.saved)))throw Error('שיחה שמורה אינה תקינה');seen.add(t.id);
   const messages=array(t.messages,8);if(!messages.length||messages.length%2)throw Error('יש לשמור זוגות מלאים של שאלות ותשובות');
   return {id:t.id,symbol:t.symbol,title:t.title,saved:t.saved,messages:messages.map((m,i)=>{if(!object(m)||m.role!==(i%2?'assistant':'user')||!text(m.content,6000)||!m.content.trim())throw Error('הודעת שיחה אינה תקינה או ארוכה מדי');return {role:m.role,content:m.content}})};
  });if(new TextEncoder().encode(JSON.stringify(result)).length>350000)throw Error('ארכיון השיחות גדול מ־350KB. גבה וצמצם שיחות לפני שמירה.');return result;
 }
 if(section==='scannerPresets'){const seen=new Set();return array(value,10).map(t=>{if(!object(t)||!id(t.id)||seen.has(t.id)||!text(t.name,60)||!t.name.trim()||!text(t.saved,40)||!Number.isFinite(Date.parse(t.saved)))throw Error('תבנית סריקה אינה תקינה או שנשמרו יותר מ-10');seen.add(t.id);return {id:t.id,name:t.name.trim(),saved:t.saved,settings:scannerSettings(t.settings)}})}
 if(section==='layouts'){
  const seen=new Set();return array(value,10).map(t=>{if(!object(t)||!id(t.id)||seen.has(t.id)||!text(t.name,60)||!t.name.trim()||!symbol(t.symbol)||!['1min','5min','15min','30min','1h','1day','1week','1month'].includes(t.interval)||!(Number.isInteger(t.range)&&t.range>=1&&t.range<=2000)||!text(t.saved,40)||!Number.isFinite(Date.parse(t.saved)))throw Error('פריסת עבודה אינה תקינה או שנשמרו יותר מ-10 פריסות');seen.add(t.id);return {id:t.id,name:t.name.trim(),symbol:t.symbol,interval:t.interval,range:t.range,preferences:personalData('chartPreferences',t.preferences),saved:t.saved}});
 }
 if(section==='chartPreferences'){
  if(!object(value))throw Error('העדפות הגרף אינן תקינות');const result={};
  if(value.style!==undefined){if(!chartStyles.includes(value.style))throw Error('סגנון גרף אינו תקין');result.style=value.style}
  for(const key of ['chartMA20','chartMA150','chartEMA50','chartRSI14','chartBB20','chartMACD','chartATR14','chartMA50','chartMA100','chartMA200','chartStochastic','chartOBV','chartADX14','chartSupertrend','chartVWAP','chartIchimoku'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw Error('העדפת אינדיקטור אינה תקינה');result[key]=value[key]}
  return result;
 }
 if(section==='drawings'){
  if(!object(value)||Object.keys(value).length>30)throw Error('מקסימום 30 מניות עם קווים');const result={};
  for(const [key,item] of Object.entries(value)){if(!symbol(key)||!object(item)||!Number.isFinite(item.savedAt)||item.savedAt<0)throw Error('נתוני קווים אינם תקינים');result[key]={savedAt:item.savedAt,lines:array(item.lines,30).map(line=>{if(!Array.isArray(line)||line.length!==2||!line.every(p=>object(p)&&stamp(p.date)&&positive(p.price)&&(p.tool===undefined||drawingTools.includes(p.tool))))throw Error('נקודת ציור אינה תקינה');if((line[0].tool||'trend')!==(line[1].tool||'trend'))throw Error('נקודות ציור חייבות להשתמש באותו כלי');if(line[0].tool==='channel'&&(line[0].date===line[1].date||line.some(p=>p.price+channelOffset(line[0].offset)>1e12)))throw Error('תעלה אינה תקינה');const points=line.map(p=>({date:p.date,price:p.price,...(p.tool?{tool:p.tool}:{}),...(p.tool==='text'?{text:drawingText(p.text)}:{}),...(p.tool==='channel'?{offset:channelOffset(line[0].offset)}:{}),...(['long','short'].includes(p.tool)?{rr:drawingRR(p.rr??2)}:{})}));if(['long','short'].includes(points[0].tool))drawingTradePlan(points[0],points[1]);return points})}}
  return result;
 }
 throw Error('סוג נתונים לא מוכר');
}
export const emptyPersonal=section=>['journal','research','conversations','layouts','scannerPresets'].includes(section)?[]:{};
// Cloud wins equal IDs. Import never silently drops records at the section limit.
export function mergePersonal(section,local,remote){
 const a=personalData(section,local),b=personalData(section,remote);
 if(['journal','research','conversations','layouts','scannerPresets'].includes(section)){const ids=new Set(b.map(x=>x.id));return personalData(section,[...b,...a.filter(x=>!ids.has(x.id))])}
 return personalData(section,{...a,...b});
}
export function personalBackup(section,value){return {kind:'asaf-personal',version:1,section,exportedAt:new Date().toISOString(),data:personalData(section,value)}}
export function parsePersonalBackup(text,section){if(typeof text!=='string'||new TextEncoder().encode(text).length>750000)throw Error('גיבוי גדול מדי');const v=JSON.parse(text);if(v?.kind!=='asaf-personal'||v.version!==1||v.section!==section)throw Error('הגיבוי אינו מתאים לסוג הנתונים שנבחר');return personalData(section,v.data)}
