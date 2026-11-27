import {scannerScenarioFilters} from './scanner-scenario-filters.mjs';
import {rankedScannerCandidates} from './scanner-candidates.mjs';
import {partialVolumeReason,volumeUnavailableReason} from './comparable-volume.mjs';
const $=id=>document.getElementById(id),pretty=v=>Number.isFinite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:2}):'חסר';
const capValue=r=>r.marketCapStatus==='available'&&Number.isFinite(r.company?.marketCapUsd)?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(r.company.marketCapUsd):null;
const headers=['מניה / יום בסיס','התאמה למסננים','מעל MA20 / MA150','ATR%','מחזור יחסי EOD','כיוון Supertrend','RSI14','ADX14','תבניות','יעד מדוד (%)','יחס סיכוי / סיכון','כיוון תרחיש','שווי שוק ($)','סיבות / מקור','פעולות'];
// Combine cancellation and timeout without AbortSignal.any(), absent on older Safari.
export async function scannerJson(fetcher,url,options,signal,timeoutMs){
 const scoped=new AbortController();
 const relay=()=>scoped.abort(signal.reason);
 if(signal.aborted)relay();else signal.addEventListener('abort',relay,{once:true});
 const timer=setTimeout(()=>scoped.abort(new DOMException('Request timed out','TimeoutError')),timeoutMs);
 try {
  if(scoped.signal.aborted)throw scoped.signal.reason||new DOMException('Cancelled','AbortError');
  const response=await fetcher(url,{...options,signal:scoped.signal});
  return {response,data:await response.json()};
 } finally {
  clearTimeout(timer);signal.removeEventListener('abort',relay);
 }
}
export function mountVentureScanner({filters,openCharts}){
 const records=new Map();let busy=false,controller=null,revision=0,lastFilters='',dirty=true,inspectedSymbol=null,page=0,sharedScan=false;
 const pageSize=100;
 const translate=value=>window.asafTranslate?.(value)??value;
 const localized=(element,parts)=>{element.translate=false;element.textContent=parts.map(translate).join('');};
 const enumLabel=value=>document.documentElement?.lang&&document.documentElement.lang!=='he'?value:({up:'עולה',down:'יורד',long:'לונג',short:'שורט',crossed:'נחצה בנר האחרון',waiting:'ממתין לחצייה',above:'כבר מעל הרמה',below:'כבר מתחת לרמה',observed:'זוהה בנתונים'}[value]||value);
 [...$('scanRows').closest('table').querySelectorAll('thead th')].forEach((h,i)=>h.textContent=headers[i]);
 const update=document.createElement('button');update.type='button';update.textContent='עדכן תוצאות לפי המסננים';update.className='primary';$('scanClear').before(update);
 const pager=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button'),pageLabel=document.createElement('span');
 pager.className='scanner-pagination';previous.type=next.type='button';previous.onclick=()=>{page=Math.max(0,page-1);render()};next.onclick=()=>{page++;render()};pager.append(previous,pageLabel,next);$('scanRows').closest('table').before(pager);
 const open=(record,side=record.methodology?.side)=>{openCharts();window.dispatchEvent(new CustomEvent('asaf:open-provider-chart',{detail:{symbol:record.symbol,scannerContext:{asOf:record.asOf,receivedAt:record.receivedAt,filters:scannerScenarioFilters(Object.fromEntries(['pattern','crossedOnly','minMeasuredMove','minScenarioRR'].map(key=>[key,filters()[key]]).filter(([,value])=>value!==undefined))),...(['long','short'].includes(side)?{side}:{})}}}))};
 function ordered(){return [...records.values()].sort((a,b)=>$('scanSort').value==='symbol'?a.symbol.localeCompare(b.symbol):$('scanSort').value==='scenario'?Math.max(-1,...b.patterns.map(p=>p.movePercent??-1))-Math.max(-1,...a.patterns.map(p=>p.movePercent??-1)):$('scanSort').value==='volume'?(b.metrics.relativeVolume??-1)-(a.metrics.relativeVolume??-1):(b.metrics.atrPercent??-1)-(a.metrics.atrPercent??-1))}
 function render(){
  const host=$('scanRows');host.replaceChildren();const shortlist=$('scanShortlist');shortlist?.replaceChildren();
  const sorted=ordered(),matched=dirty?0:sorted.filter(r=>r.screen.matches).length,visible=sorted.filter(r=>dirty||!$('scanOnlyMatches').checked||r.screen.matches);
  const pages=Math.max(1,Math.ceil(visible.length/pageSize));page=Math.min(page,pages-1);
  pager.hidden=pages<=1;previous.disabled=page===0;next.disabled=page>=pages-1;localized(previous,['הקודם']);localized(next,['הבא']);localized(pageLabel,['עמוד ',String(page+1),' מתוך ',String(pages)]);
  for(const r of visible.slice(page*pageSize,(page+1)*pageSize)){
   const m=r.metrics,patterns=r.patterns,yes=v=>v===true?'כן':v===false?'לא':'חסר';
   const join=(items,separator)=>items.flatMap((item,index)=>index?[separator,item]:[item]);
   const formatted=(value,suffix='')=>Number.isFinite(value)?pretty(value)+suffix:'חסר';
   const values=[r.symbol+' · '+r.asOf,dirty?'נדרש עדכון':r.screen.matches?(r.methodology?.label||'עברה'):r.screen.reasons.some(reason=>reason===volumeUnavailableReason||reason===partialVolumeReason)?'לא ניתן לאמת':'נפסלה',[yes(m.aboveMA20),' / ',yes(m.aboveMA150)],formatted(m.atrPercent,'%'),[m.volumeComparison==='unverifiable'?'מחזור לא מאומת':formatted(m.relativeVolume,'×'),...(m.volumeCoverage==='partial'?[' · ','מחזור חלקי']:[])],[enumLabel(m.supertrendDirection||'חסר')],formatted(m.rsi14),formatted(m.adx14),patterns.length?join(patterns.map(p=>p.label),' | '):'לא נמצאה',patterns.length?join(patterns.map(p=>formatted(p.movePercent)),' / '):'—',patterns.length?join(patterns.map(p=>formatted(p.riskReward)),' / '):'—',patterns.length?join(patterns.map(p=>enumLabel(p.side||'—')),' / '):'—',capValue(r)||'חסר',dirty?'המסננים השתנו. לחץ עדכן תוצאות.':r.screen.reasons.length?join(r.screen.reasons,' · '):'Twelve Data · נרות יומיים קודמים'];
   const row=document.createElement('tr');for(const value of values){const td=document.createElement('td');if(Array.isArray(value))localized(td,value);else td.textContent=value;row.append(td)}
   const actions=document.createElement('td'),button=document.createElement('button'),inspect=document.createElement('button');button.type=inspect.type='button';button.textContent='פתח גרף מסומן';button.onclick=()=>open(r);inspect.textContent='פרטי מחקר';inspect.onclick=()=>details(r);actions.append(button,inspect);row.append(actions);host.append(row);

  }
  // Watch candidates remain visible even when no stock passes every gate.
  // They never count as full matches and never conceal the missing conditions.
  let watchCount=0;
  if(shortlist&&!dirty){
   const candidates=rankedScannerCandidates([...records.values()],{side:filters().scenarioSide||'any'});
   if(candidates.length){const heading=document.createElement('h3');localized(heading,['מניות שנמצאו למחקר']);shortlist.append(heading);}
   for(const {record:r,opportunity:o} of candidates){
    const m=r.metrics,full=o.status==='match'&&r.screen.matches;
    if(!full)watchCount++;
    const card=document.createElement('article');card.className='scanner-candidate';
    const title=document.createElement('h4'),text=document.createElement('p'),company=document.createElement('p'),reason=document.createElement('p'),go=document.createElement('button');
    localized(title,[r.symbol,' · ',enumLabel(o.side),' · ',full?'התאמה מלאה':'מועמדת למעקב']);
    localized(text,['ATR '+(Number.isFinite(m.atrPercent)?pretty(m.atrPercent):'—')+'% · מחזור יחסי EOD '+(Number.isFinite(m.relativeVolume)?pretty(m.relativeVolume):'—')+'× · בסיס '+r.asOf]);
    localized(company,['שווי שוק ($)',': ',capValue(r)||'חסר']);
    if(r.company?.receivedAt)company.title=translate('התקבל: ')+new Date(r.company.receivedAt).toLocaleString(document.documentElement.lang||'he');
    if(!full){localized(reason,['חסר לאישור: ',...o.reasons.slice(0,3).flatMap((item,i)=>i?[' · ',item]:[item])]);card.append(title,company,text,reason);}
    else card.append(title,company,text);
    const inspect=document.createElement('button');inspect.type='button';localized(inspect,['פרטי מחקר']);inspect.onclick=()=>details(r);card.append(inspect);
    go.type='button';localized(go,['פתח גרף מסומן']);go.onclick=()=>open(r,o.side);card.append(go);shortlist.append(card);
   }
  }
  if(!host.children.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=15;cell.textContent=records.size?(watchCount?'אין התאמות מלאות; מועמדות למעקב מוצגות למעלה.':'אין התאמות במסננים האלה.'):'לחץ על מצא לי מניות. נתוני המקור נשארים בשרת.';row.append(cell);host.append(row)}
  $('scanSummary').textContent=`נבדקו ${records.size} מניות · ${dirty?'יש לעדכן מסננים':matched+' התאמות'} · מחקר על ימים שהסתיימו`;
  if(!dirty&&watchCount){const note=document.createElement('p');localized(note,['מועמדות למעקב אינן התאמות מלאות. התנאים החסרים מוצגים בכל מניה.']);shortlist.append(note);}
  $('scanStatus').textContent=dirty&&records.size?'המסננים השתנו. לחץ ״עדכן תוצאות״ לחישוב בשרת.':'תוצאות נגזרות בלבד · Data provided by Twelve Data · ללא מחירי מקור או נתוני נרות להורדה.';
 }
 function details(r){const host=$('scanResearchDetails');host.replaceChildren();host.hidden=false;inspectedSymbol=r.symbol;
  const h=document.createElement('h3'),p=document.createElement('p');h.textContent=r.symbol+' · מחקר נגזר';
  // The translator deliberately treats template placeholders as data. Translate known coverage
  // sentences before placing them in the template, without translating tickers or dates.
  const coverage=(r.coverage||'').split(/(?<=\.)\s+/).filter(Boolean).map(sentence=>translate(sentence+' ').trim()).join(' ');
  localized(p,['Twelve Data · יום בסיס '+r.asOf+' · '+coverage+' הרמות והגרף מחושבים בשרת. יעד מדוד אינו תחזית.']);
  const company=document.createElement('p');localized(company,['שווי שוק ($)',': ',capValue(r)||'חסר',...(r.company?.receivedAt?[' · ','התקבל: ',new Date(r.company.receivedAt).toLocaleString(document.documentElement.lang||'he')]:[])]);
  host.append(h,p,company);if(r.screen.reasons.length){const missing=document.createElement('p');localized(missing,['חסר לאישור: ',...r.screen.reasons.flatMap((item,i)=>i?[' · ',item]:[item])]);host.append(missing);}if(r.methodology){const method=document.createElement('p');localized(method,[r.methodology.label,' · ',enumLabel(r.methodology.side||'long'),' · ','סטופ 2×ATR']);host.append(method);for(const check of r.methodology.checks){const item=document.createElement('p');localized(item,[check.passed?'✓ ':'✗ ',check.passed?({closedDaily:'נרות יומיים שהושלמו ו־ATR תקין',marketCap:'שווי שוק מאומת מעל הסף',price:'מחיר מעל $5',ma20:r.methodology.side==='short'?'מחיר מתחת MA20':'מחיר מעל MA20',risingClose:r.methodology.side==='short'?'סגירה יורדת':'סגירה עולה',volume:'מחזור מאומת מעל הממוצע',pattern:r.methodology.side==='short'?'תבנית שורט עם פוטנציאל מדוד של 15% לפחות':'תבנית לונג עם פוטנציאל מדוד של 15% לפחות'}[check.key]||check.key):check.reason]);host.append(item)}for(const warning of r.methodology.warnings){const item=document.createElement('p');localized(item,[warning]);host.append(item)}}for(const c of r.patterns){const item=document.createElement('p');item.textContent=c.label+' · '+enumLabel(c.stage)+' · יעד מדוד '+(Number.isFinite(c.movePercent)?pretty(c.movePercent):'—')+'% · יחס '+(Number.isFinite(c.riskReward)?pretty(c.riskReward):'—');host.append(item)}
  const close=document.createElement('button');close.type='button';close.textContent='סגור פרטי מחקר';close.onclick=()=>{inspectedSymbol=null;host.hidden=true};host.append(close);
 }
 async function scan({discover=false,cachedOnly=false}={}){
  if(busy)return;busy=true;const current=++revision;controller=new AbortController();const signal=controller.signal,selected=filters(),signature=JSON.stringify(selected),status=$('scanDiscoverStatus')||$('scanProviderStatus');
  const stop=$('scanDiscoverStop');if(stop)stop.hidden=false;update.disabled=true;$('scanProvider').disabled=true;if($('scanDiscover'))$('scanDiscover').disabled=true;$('scanProviderAuto').checked=false;
  try{
   let symbols,batchSize=10,delay=31000,shared=false,sharedReceipt='';
   if(cachedOnly){shared=sharedScan;batchSize=shared?100:10;symbols=[...records.keys()];if(!symbols.length)throw Error('יש לבצע סריקה ראשונה לפני עדכון המסננים.');}
   else if(discover){const {response,data:config}=await scannerJson(fetch,'/.netlify/functions/scan-market',{credentials:'same-origin'},signal,15000);if(!response.ok||!config.enabled||!config.symbols?.length)throw Error('יש להתחבר לחשבון עם גישה פעילה לסריקה.');shared=config.shared===true;symbols=config.symbols.slice(0,1000);batchSize=Math.min(shared?100:10,config.maxSymbols||10);sharedScan=shared;delay=Math.max(31000,config.batchDelayMs||0);}
   else symbols=$('scanProviderSymbols').value.split(',').map(s=>s.trim()).filter(Boolean);
   if(!symbols.length||(!discover&&!cachedOnly&&symbols.length>10))throw Error('בחר 1 עד 10 סימולים בכל סריקה ידנית.');
   // A failed cached filter update must remain retryable without refetching market data.
   const staged=cachedOnly?new Map():records;
   if(!cachedOnly)records.clear();page=0;dirty=true;render();
   for(let offset=0;offset<symbols.length;offset+=batchSize){
    if(offset&&!cachedOnly&&!shared){status.textContent='ממתין למכסת הקבוצה הבאה…';await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},delay);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})}
    status.textContent=`בודק ${offset+1}–${Math.min(symbols.length,offset+batchSize)} מתוך ${symbols.length}…`;
    const {response,data}=await scannerJson(fetch,'/.netlify/functions/scan-market',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:symbols.slice(offset,offset+batchSize),filters:selected,cachedOnly})},signal,35000);
    if(!response.ok)throw Error(data.error||'הסריקה נכשלה.');if(current!==revision||signal.aborted)return;
    if(data.shared){shared=sharedScan=true;sharedReceipt='סריקה משותפת · עדכון '+(data.updatedAt||data.completedAt)+' · עדכון הבא '+new Date(data.nextUpdateAt).toLocaleString(globalThis.document?.documentElement?.lang||'he-IL')+(data.stale?' · ממתין לרענון':'');if(data.progress&&!data.progress.complete)sharedReceipt+=' · '+translate('עדכון ברקע: {processed} מתוך {total} מניות').replace('{processed}',String(data.progress.processed)).replace('{total}',String(data.progress.total));}
    for(const r of data.records||[])if(r.presentation==='derived-only')staged.set(r.symbol,r);
    if(!cachedOnly){dirty=JSON.stringify(filters())!==signature;lastFilters=signature;render();}
    if(data.errors?.length)$('scanProviderStatus').textContent=data.errors.slice(0,3).map(e=>e.symbol+': '+e.error).join(' | ');
   }
   if(cachedOnly){records.clear();for(const [symbol,result] of staged)records.set(symbol,result);dirty=JSON.stringify(filters())!==signature;lastFilters=signature;render();}
   status.textContent=sharedReceipt||`הסריקה הסתיימה: התקבלו ${records.size} תוצאות נגזרות. `+(dirty?'המסננים השתנו במהלך הסריקה. עדכן תוצאות.':'החישוב בשרת; נפח יומי EOD, ללא מחירי מקור להורדה.');
  }catch(e){status.textContent=e.name==='AbortError'?'הסריקה נעצרה.':e.message;}
  finally{if(current===revision){busy=false;controller=null;update.disabled=false;$('scanProvider').disabled=false;if($('scanDiscover'))$('scanDiscover').disabled=false;if(stop)stop.hidden=true}}
 }
 $('scanProvider').onclick=()=>scan();update.onclick=()=>scan({cachedOnly:true});
 document.addEventListener('click',e=>{if(e.target.id==='scanDiscover')scan({discover:true});if(e.target.id==='scanDiscoverStop')controller?.abort()});
 $('scanner').addEventListener('input',()=>{page=0;dirty=JSON.stringify(filters())!==lastFilters;render()});$('scanner').addEventListener('change',()=>{page=0;dirty=JSON.stringify(filters())!==lastFilters;render()});
 window.addEventListener('asaf:language',()=>{render();if(inspectedSymbol&&records.has(inspectedSymbol))details(records.get(inspectedSymbol));});
 $('scanClear').onclick=()=>{controller?.abort();records.clear();page=0;sharedScan=false;dirty=true;inspectedSymbol=null;$('scanResearchDetails').hidden=true;render()};
 window.addEventListener('asaf:logout',()=>{revision++;controller?.abort();busy=false;records.clear();page=0;sharedScan=false;dirty=true;inspectedSymbol=null;$('scanResearchDetails').hidden=true;render();update.disabled=false;$('scanProvider').disabled=false;if($('scanDiscover'))$('scanDiscover').disabled=false;if($('scanDiscoverStop'))$('scanDiscoverStop').hidden=true});
 $('scanProviderAuto').disabled=true;$('scanProviderAuto').closest('label').hidden=true;
 render();
}
