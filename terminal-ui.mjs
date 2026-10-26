import {authState} from './auth-ui.mjs';
import {watchRecords,normalizeSymbol} from './workspace-core.mjs';
const $=id=>document.getElementById(id),main=document.querySelector('main'),header=document.querySelector('header');
// Reuse the working account, chart, scanner and journal controls; no parallel state.
const stage=document.createElement('div');stage.className='terminal-stage';
const rail=document.createElement('aside');rail.className='terminal-watch';rail.setAttribute('aria-label','רשימת מעקב מהירה');rail.dir='rtl';
const center=document.createElement('div');center.className='terminal-center';center.dir='rtl';
const ai=document.createElement('aside');ai.className='terminal-ai';ai.dir='rtl';ai.setAttribute('aria-label','עוזר מחקר לצד הגרף');
for(const section of [...main.querySelectorAll(':scope > section')]){section.dataset.workspacePanel='';(section.id==='chat'?ai:center).append(section)}
stage.append(rail,center,ai);main.insertBefore(stage,main.querySelector('footer'));
const command=$('charts').querySelector(':scope > .row');command.classList.add('terminal-command');header.append(command);
$('loadChart').textContent='פתח';$('chartChat').textContent='נתח גרף';
const dataButton=document.createElement('button');dataButton.type='button';dataButton.className='terminal-data-button';dataButton.textContent='נתוני שוק';header.append(dataButton);
const accountButton=document.createElement('button');accountButton.type='button';accountButton.className='terminal-account-button';accountButton.textContent='התחברות';header.append(accountButton);
const globalTools=document.createElement('details');globalTools.className='terminal-global-tools';const globalSummary=document.createElement('summary');globalSummary.textContent='עזרה ומצב שירותים';main.querySelector('.tabs').before(globalTools);globalTools.append(globalSummary,$('keyboardHelp'),document.querySelector('.server-tools'));
const connection=$('charts').querySelector('.connection-settings'),imports=$('chartCsv').closest('.row');
const dataTools=document.createElement('details');dataTools.id='terminalDataTools';dataTools.className='terminal-data-tools';const dataSummary=document.createElement('summary');dataSummary.textContent='מקור נתונים וכלים מתקדמים';dataTools.append(dataSummary);connection.before(dataTools);dataTools.append(connection,imports,$('pasteCsvDetails'),$('referenceChart'));
function selectTab(id){document.querySelector('[data-tab="'+id+'"]').click()}
dataButton.onclick=()=>{selectTab('charts');dataTools.open=!dataTools.open;if(dataTools.open)connection.open=true;dataSummary.focus()};
// Collapsible statistics and indicators leave the actual chart room to breathe.
const metrics=$('chartMetrics'),method=metrics.nextElementSibling;
const stats=document.createElement('details');stats.className='terminal-chart-stats';const statsSummary=document.createElement('summary');statsSummary.textContent='ערכי אינדיקטורים ושיטת החישוב';metrics.before(stats);stats.append(statsSummary,metrics,method);
const tools=$('localChartPanel').querySelector('.chart-tools'),toolDetails=document.createElement('details'),toolSummary=document.createElement('summary');toolDetails.className='terminal-indicators';toolSummary.textContent='אינדיקטורים וסגנון גרף';tools.before(toolDetails);toolDetails.append(toolSummary,tools);
$('localChartCanvas').after(stats);stats.after($('chartPreciseDrawingDetails'));
const chat=$('chat');chat.querySelector('h2').textContent='ASAF AI';
const context=document.createElement('p');context.id='terminalAIContext';context.className='terminal-ai-context';context.setAttribute('role','status');context.textContent='אין נתוני גרף מחוברים. הניתוח ישתמש בגרף הפתוח כשיהיו נתונים.';
const auto=document.createElement('label');auto.className='terminal-auto-chart';auto.innerHTML='<input id="chatAutoChart" type="checkbox" checked> צרף את הגרף הפתוח אוטומטית';
const account=document.createElement('details');account.className='terminal-account';const summary=document.createElement('summary');summary.textContent='כניסה ופרטי חשבון';account.append(summary,chat.querySelector('.member-panel'));
const advanced=document.createElement('details');advanced.className='terminal-ai-advanced';const advancedSummary=document.createElement('summary');advancedSummary.textContent='כלי שיחה, מקורות וצירוף קובץ חלופי';advanced.append(advancedSummary);
const log=$('chatLog'),form=$('chatForm'),status=$('chatStatus'),request=$('chatRequestState');
for(const node of [...chat.children])if(![chat.querySelector('h2'),log,form,status,request].includes(node))advanced.append(node);
chat.append(context,auto,account,log,status,request,form,advanced);
const clear=document.createElement('button');clear.type='button';clear.className='terminal-new-chat';clear.textContent='שיחה חדשה';clear.onclick=()=>$('clearConversation').click();chat.querySelector('h2').append(clear);
accountButton.onclick=()=>{selectTab('chat');account.open=true;summary.focus()};
function auth(){accountButton.textContent=authState.authenticated?'החשבון שלי':'התחברות';if(authState.authenticated)accountButton.classList.add('signed-in');else accountButton.classList.remove('signed-in')}
window.addEventListener('asaf:auth',auth);auth();
const railHeading=document.createElement('div');railHeading.className='terminal-rail-heading';const railTitle=document.createElement('h2');railTitle.textContent='רשימת מעקב';const manage=document.createElement('button');manage.type='button';manage.textContent='עריכה';manage.onclick=()=>selectTab('watch');railHeading.append(railTitle,manage);rail.append(railHeading);
const watchList=document.createElement('div');watchList.className='terminal-watch-list';rail.append(watchList);
const railNote=document.createElement('p');railNote.className='terminal-rail-note';railNote.textContent='מחירים יופיעו רק מנתונים שנטענו. אין כרגע פיד חי.';rail.append(railNote);
const quotes=new Map();
function renderWatch(){
 watchList.replaceChildren();let watch=[];try{watch=watchRecords(JSON.parse(localStorage.getItem('asaf_watch_v2')||'null'))}catch{}
 // The full watchlist module owns the canonical key; fall back to its visible rows.
 if(!watch.length)watch=[...$('watchRows').querySelectorAll('article > strong')].map(el=>({symbol:el.textContent}));
 for(const item of watch){const row=document.createElement('button');row.type='button';row.className='terminal-watch-row';row.setAttribute('aria-label','פתח גרף '+item.symbol);const symbol=document.createElement('strong');symbol.textContent=item.symbol;symbol.dir='ltr';const price=document.createElement('span'),quote=quotes.get(item.symbol);price.textContent=quote?quote.close.toLocaleString('en-US',{maximumFractionDigits:4}):'—';price.title=quote?'נר '+quote.date+' · '+quote.source:'אין נתוני מחיר';row.append(symbol,price);row.classList.toggle('selected',normalizeSymbol($('symbol').value)===item.symbol);row.onclick=()=>{$('symbol').value=item.symbol;$('symbol').dispatchEvent(new Event('input'));selectTab('charts');$('loadChart').click()};watchList.append(row)}
 if(!watchList.children.length){const p=document.createElement('p');p.textContent='הוסף מניות לרשימת המעקב שלך.';watchList.append(p)}
}
window.addEventListener('asaf:watch-changed',renderWatch);window.addEventListener('storage',renderWatch);$('symbol').addEventListener('input',()=>{context.textContent='אין נתוני גרף תואמים לסימול שנבחר.';renderWatch()});
window.addEventListener('asaf:dataset-ready',e=>{const d=e.detail,last=d?.bars?.at(-1);if(!last)return;quotes.set(d.symbol,{close:last.close,date:last.date,source:d.source||'CSV'});context.textContent=d.symbol+' · '+(d.interval||'1day')+' · '+(d.source==='Twelve Data'?'נתוני ספק':'נתונים מקומיים')+' · נר '+last.date+' · '+d.bars.length+' נרות. יישלחו עם השאלה; אין צורך להעלות צילום.';renderWatch()});
window.addEventListener('asaf:dataset-cleared',()=>{quotes.clear();renderWatch();context.textContent='אין נתוני גרף מחוברים. לא ניתן לנתח מחיר עדכני בלי נתונים.'});
renderWatch();
const wide=matchMedia('(min-width: 901px)');
function view(){const selected=document.querySelector('[data-tab].active')?.dataset.tab||'charts';document.body.dataset.view=selected;if(wide.matches){chat.setAttribute('role','region');chat.setAttribute('aria-label','ASAF AI');chat.removeAttribute('aria-labelledby')}else{chat.setAttribute('role','tabpanel');chat.setAttribute('aria-labelledby','tab-chat')}window.dispatchEvent(new Event('asaf:layout'))}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',view);wide.addEventListener('change',view);view();

window.dispatchEvent(new Event('asaf:request-dataset'));

// Keep navigation and drawing actions close to the chart, independent of indicator settings.
const drawingToolbar=document.createElement('div');drawingToolbar.className='terminal-drawing-toolbar';drawingToolbar.setAttribute('role','group');drawingToolbar.setAttribute('aria-label','כלי ציור ופרשנות לגרף');
for(const id of ['chartDrawingTool','drawingText','drawingRR','drawingChannelWidth']){const input=$(id);drawingToolbar.append(input.closest('label'))}
for(const id of ['chartTrend','chartUndo','chartRedo','chartClearLines'])drawingToolbar.append($(id));
toolDetails.after(drawingToolbar);
const focusButton=document.createElement('button');focusButton.type='button';focusButton.className='terminal-focus-button';focusButton.textContent='הסתר AI · הרחב גרף';focusButton.setAttribute('aria-pressed','false');header.append(focusButton);
function chartFocus(enabled){document.body.classList.toggle('terminal-chart-focus',enabled);focusButton.setAttribute('aria-pressed',String(enabled));focusButton.textContent=enabled?'הצג AI לצד הגרף':'הסתר AI · הרחב גרף';window.dispatchEvent(new Event('asaf:layout'))}
focusButton.onclick=()=>chartFocus(!document.body.classList.contains('terminal-chart-focus'));
// Opening the AI explicitly always brings its panel back.
for(const button of [accountButton,$('chartChat')])button.addEventListener('click',()=>chartFocus(false));

$('chatForm').querySelector('button').textContent='שלח';$('chatInput').placeholder='כתוב הודעה… Enter לשליחה, Shift+Enter לשורה חדשה';
$('chatForm').before($('cancelChat'));

$('chatIncludeNews').closest('label').classList.add('terminal-news-context');$('chatIncludeNews').closest('label').lastChild.textContent=' צרף כותרות אחרונות מהמטמון — ללא קריאת כתבות מלאות';auto.after($('chatIncludeNews').closest('label'));
