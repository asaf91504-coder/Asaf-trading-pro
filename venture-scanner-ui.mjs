import {partialVolumeReason,volumeUnavailableReason} from './comparable-volume.mjs';
import {csvCell} from './scanner-core.mjs';
const $=id=>document.getElementById(id),pretty=v=>Number.isFinite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:2}):'חסר';
const headers=['מניה / יום בסיס','התאמה למסננים','מעל MA20 / MA150','ATR%','מחזור יחסי EOD','כיוון Supertrend','RSI14','ADX14','תבניות','יעד מדוד (%)','יחס סיכוי / סיכון','כיוון תרחיש','שווי שוק אומת','סיבות / מקור','פעולות'];
export function mountVentureScanner({filters,openCharts}){
 const records=new Map();let busy=false,controller=null,revision=0,lastFilters='',dirty=true,inspectedSymbol=null;
 const translate=value=>window.asafTranslate?.(value)??value;
 const localized=(element,parts)=>{element.translate=false;element.textContent=parts.map(translate).join('');};
 const enumLabel=value=>document.documentElement?.lang&&document.documentElement.lang!=='he'?value:({up:'עולה',down:'יורד',long:'לונג',short:'שורט',crossed:'נחצה בנר האחרון',waiting:'ממתין לחצייה',above:'כבר מעל הרמה',below:'כבר מתחת לרמה',observed:'זוהה בנתונים'}[value]||value);
 [...$('scanRows').closest('table').querySelectorAll('thead th')].forEach((h,i)=>h.textContent=headers[i]);
 const update=document.createElement('button');update.type='button';update.textContent='עדכן תוצאות לפי המסננים';update.className='primary';$('scanExport').before(update);
 const open=record=>{openCharts();window.dispatchEvent(new CustomEvent('asaf:open-provider-chart',{detail:{symbol:record.symbol}}))};
 function ordered(){return [...records.values()].sort((a,b)=>$('scanSort').value==='symbol'?a.symbol.localeCompare(b.symbol):$('scanSort').value==='scenario'?Math.max(-1,...b.patterns.map(p=>p.movePercent??-1))-Math.max(-1,...a.patterns.map(p=>p.movePercent??-1)):$('scanSort').value==='volume'?(b.metrics.relativeVolume??-1)-(a.metrics.relativeVolume??-1):(b.metrics.atrPercent??-1)-(a.metrics.atrPercent??-1))}
 function render(){
  const host=$('scanRows');host.replaceChildren();const shortlist=$('scanShortlist');shortlist?.replaceChildren();let matched=0;
  for(const r of ordered()){
   if(!dirty&&r.screen.matches)matched++;
   if(!dirty&&$('scanOnlyMatches').checked&&!r.screen.matches)continue;
   const m=r.metrics,patterns=r.patterns,yes=v=>v===true?'כן':v===false?'לא':'חסר';
   const join=(items,separator)=>items.flatMap((item,index)=>index?[separator,item]:[item]);
   const formatted=(value,suffix='')=>Number.isFinite(value)?pretty(value)+suffix:'חסר';
   const values=[r.symbol+' · '+r.asOf,dirty?'נדרש עדכון':r.screen.matches?'עברה':r.screen.reasons.some(reason=>reason===volumeUnavailableReason||reason===partialVolumeReason)?'לא ניתן לאמת':'נפסלה',[yes(m.aboveMA20),' / ',yes(m.aboveMA150)],formatted(m.atrPercent,'%'),[m.volumeComparison==='unverifiable'?'מחזור לא מאומת':formatted(m.relativeVolume,'×'),...(m.volumeCoverage==='partial'?[' · ','מחזור חלקי']:[])],[enumLabel(m.supertrendDirection||'חסר')],formatted(m.rsi14),formatted(m.adx14),patterns.length?join(patterns.map(p=>p.label),' | '):'לא נמצאה',patterns.length?join(patterns.map(p=>formatted(p.movePercent)),' / '):'—',patterns.length?join(patterns.map(p=>formatted(p.riskReward)),' / '):'—',patterns.length?join(patterns.map(p=>enumLabel(p.side||'—')),' / '):'—',r.marketCapStatus==='available'?'כן':'לא',dirty?'המסננים השתנו. לחץ עדכן תוצאות.':r.screen.reasons.length?join(r.screen.reasons,' · '):'Twelve Data · נרות יומיים קודמים'];
   const row=document.createElement('tr');for(const value of values){const td=document.createElement('td');if(Array.isArray(value))localized(td,value);else td.textContent=value;row.append(td)}
   const actions=document.createElement('td'),button=document.createElement('button'),inspect=document.createElement('button');button.type=inspect.type='button';button.textContent='פתח תמונת גרף';button.onclick=()=>open(r);inspect.textContent='פרטי מחקר';inspect.onclick=()=>details(r);actions.append(button,inspect);row.append(actions);host.append(row);
   if(shortlist&&shortlist.children.length<6){const card=document.createElement('article');card.className='scanner-candidate';const title=document.createElement('h4'),text=document.createElement('p'),go=document.createElement('button');localized(title,[r.symbol,' · ',dirty?'נדרש עדכון':r.screen.matches?'עברה את המסננים':'לבדיקה נוספת']);const cardSummary='ATR '+(Number.isFinite(m.atrPercent)?pretty(m.atrPercent):'—')+'% · מחזור יחסי EOD '+(Number.isFinite(m.relativeVolume)?pretty(m.relativeVolume):'—')+'× · בסיס '+r.asOf;
   localized(text,[cardSummary,...(m.volumeComparison==='unverifiable'?[' · ','מחזור לא מאומת']:m.volumeCoverage==='partial'?[' · ','מחזור חלקי']:[])]);go.type='button';go.textContent='פתח תמונת גרף';go.onclick=()=>open(r);card.append(title,text,go);shortlist.append(card)}
  }
  if(!host.children.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=15;cell.textContent=records.size?'אין התאמות במסננים האלה.':'לחץ על מצא לי מניות. נתוני המקור נשארים בשרת.';row.append(cell);host.append(row)}
  $('scanSummary').textContent=`נבדקו ${records.size} מניות · ${dirty?'יש לעדכן מסננים':matched+' התאמות'} · מחקר על ימים שהסתיימו`;
  $('scanStatus').textContent=dirty&&records.size?'המסננים השתנו. לחץ ״עדכן תוצאות״ לחישוב בשרת.':'תוצאות נגזרות בלבד · Data provided by Twelve Data · ללא מחירי מקור או נתוני נרות להורדה.';
  $('scanExport').disabled=dirty||!records.size;
 }
 function details(r){const host=$('scanResearchDetails');host.replaceChildren();host.hidden=false;inspectedSymbol=r.symbol;
  const h=document.createElement('h3'),p=document.createElement('p');h.textContent=r.symbol+' · מחקר נגזר';
  // The translator deliberately treats template placeholders as data. Translate known coverage
  // sentences before placing them in the template, without translating tickers or dates.
  const coverage=(r.coverage||'').split(/(?<=\.)\s+/).filter(Boolean).map(sentence=>translate(sentence+' ').trim()).join(' ');
  localized(p,['Twelve Data · יום בסיס '+r.asOf+' · '+coverage+' הרמות והגרף מחושבים בשרת. יעד מדוד אינו תחזית.']);
  host.append(h,p);for(const c of r.patterns){const item=document.createElement('p');item.textContent=c.label+' · '+enumLabel(c.stage)+' · יעד מדוד '+(Number.isFinite(c.movePercent)?pretty(c.movePercent):'—')+'% · יחס '+(Number.isFinite(c.riskReward)?pretty(c.riskReward):'—');host.append(item)}
  const close=document.createElement('button');close.type='button';close.textContent='סגור פרטי מחקר';close.onclick=()=>{inspectedSymbol=null;host.hidden=true};host.append(close);
 }
 async function scan({discover=false,cachedOnly=false}={}){
  if(busy)return;busy=true;const current=++revision;controller=new AbortController();const signal=controller.signal,selected=filters(),signature=JSON.stringify(selected),status=$('scanDiscoverStatus')||$('scanProviderStatus');
  const stop=$('scanDiscoverStop');if(stop)stop.hidden=false;update.disabled=true;$('scanProvider').disabled=true;if($('scanDiscover'))$('scanDiscover').disabled=true;$('scanProviderAuto').checked=false;
  try{
   let symbols,batchSize=10,delay=31000,shared=false,sharedReceipt='';
   if(cachedOnly){symbols=[...records.keys()];if(!symbols.length)throw Error('יש לבצע סריקה ראשונה לפני עדכון המסננים.');}
   else if(discover){const response=await fetch('/.netlify/functions/scan-market',{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),credentials:'same-origin'}),config=await response.json();if(!response.ok||!config.enabled||!config.symbols?.length)throw Error('יש להתחבר לחשבון עם גישה פעילה לסריקה.');shared=config.shared===true;symbols=config.symbols.slice(0,50);batchSize=Math.min(10,config.maxSymbols||10);delay=Math.max(31000,config.batchDelayMs||0);}
   else symbols=$('scanProviderSymbols').value.split(',').map(s=>s.trim()).filter(Boolean);
   if(!symbols.length||(!discover&&!cachedOnly&&symbols.length>10))throw Error('בחר 1 עד 10 סימולים בכל סריקה ידנית.');
   // A failed cached filter update must remain retryable without refetching market data.
   const staged=cachedOnly?new Map():records;
   if(!cachedOnly)records.clear();dirty=true;render();
   for(let offset=0;offset<symbols.length;offset+=batchSize){
    if(offset&&!cachedOnly&&!shared){status.textContent='ממתין למכסת הקבוצה הבאה…';await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},delay);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})}
    status.textContent=`בודק ${offset+1}–${Math.min(symbols.length,offset+batchSize)} מתוך ${symbols.length}…`;
    const response=await fetch('/.netlify/functions/scan-market',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:symbols.slice(offset,offset+batchSize),filters:selected,cachedOnly}),signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])}),data=await response.json();
    if(!response.ok)throw Error(data.error||'הסריקה נכשלה.');if(current!==revision||signal.aborted)return;
    if(data.shared){shared=true;sharedReceipt='סריקה משותפת · עדכון '+data.completedAt+' · עדכון הבא '+new Date(data.nextUpdateAt).toLocaleString(globalThis.document?.documentElement?.lang||'he-IL')+(data.stale?' · ממתין לרענון':'');}
    for(const r of data.records||[])if(r.presentation==='derived-only')staged.set(r.symbol,r);
    if(!cachedOnly){dirty=JSON.stringify(filters())!==signature;lastFilters=signature;render();}
    if(data.errors?.length)$('scanProviderStatus').textContent=data.errors.map(e=>e.symbol+': '+e.error).join(' | ');
   }
   if(cachedOnly){records.clear();for(const [symbol,result] of staged)records.set(symbol,result);dirty=JSON.stringify(filters())!==signature;lastFilters=signature;render();}
   status.textContent=sharedReceipt||`הסריקה הסתיימה: התקבלו ${records.size} תוצאות נגזרות. `+(dirty?'המסננים השתנו במהלך הסריקה. עדכן תוצאות.':'החישוב בשרת; נפח יומי EOD, ללא מחירי מקור להורדה.');
  }catch(e){status.textContent=e.name==='AbortError'?'הסריקה נעצרה.':e.message;}
  finally{if(current===revision){busy=false;controller=null;update.disabled=false;$('scanProvider').disabled=false;if($('scanDiscover'))$('scanDiscover').disabled=false;if(stop)stop.hidden=true}}
 }
 $('scanProvider').onclick=()=>scan();update.onclick=()=>scan({cachedOnly:true});
 document.addEventListener('click',e=>{if(e.target.id==='scanDiscover')scan({discover:true});if(e.target.id==='scanDiscoverStop')controller?.abort()});
 $('scanner').addEventListener('input',()=>{dirty=JSON.stringify(filters())!==lastFilters;render()});$('scanner').addEventListener('change',()=>{dirty=JSON.stringify(filters())!==lastFilters;render()});
 window.addEventListener('asaf:language',()=>{render();if(inspectedSymbol&&records.has(inspectedSymbol))details(records.get(inspectedSymbol));});
 $('scanClear').onclick=()=>{controller?.abort();records.clear();dirty=true;inspectedSymbol=null;$('scanResearchDetails').hidden=true;render()};
 window.addEventListener('asaf:logout',()=>{revision++;controller?.abort();busy=false;records.clear();dirty=true;inspectedSymbol=null;$('scanResearchDetails').hidden=true;render();update.disabled=false;$('scanProvider').disabled=false;if($('scanDiscover'))$('scanDiscover').disabled=false;if($('scanDiscoverStop'))$('scanDiscoverStop').hidden=true});
 $('scanProviderAuto').disabled=true;$('scanProviderAuto').closest('label').hidden=true;
 $('scanExport').textContent='ייצא תוצאות ניתוח בלבד';$('scanExport').onclick=()=>{if(dirty||!records.size)return;const rows=[['Symbol','AsOf','Matches','AboveMA20','AboveMA150','ATRPercent','RelativeVolumeEOD','VolumeCoverage','RSI14','ADX14','PatternKinds','Reasons'],...ordered().filter(r=>!$('scanOnlyMatches').checked||r.screen.matches).map(r=>[r.symbol,r.asOf,r.screen.matches,r.metrics.aboveMA20,r.metrics.aboveMA150,r.metrics.atrPercent,r.metrics.relativeVolume,r.metrics.volumeCoverage,r.metrics.rsi14,r.metrics.adx14,r.patterns.map(p=>p.kind).join(' | '),r.screen.reasons.join(' | ')])];const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='asaf-analysis.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 render();
}
