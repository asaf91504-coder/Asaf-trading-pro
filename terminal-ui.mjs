import {quoteSummary} from './data-freshness.mjs';
import {mountAssetSearch} from './asset-search-ui.mjs';
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
const connection=$('charts').querySelector('.connection-settings');
const dataTools=document.createElement('details');dataTools.id='terminalDataTools';dataTools.className='terminal-data-tools';const dataSummary=document.createElement('summary');dataSummary.textContent='מקור נתונים וכלים מתקדמים';dataTools.append(dataSummary);connection.before(dataTools);dataTools.append(connection,$('referenceChart'));
function selectTab(id){document.querySelector('[data-tab="'+id+'"]').click()}
dataButton.onclick=()=>{selectTab('charts');dataTools.open=!dataTools.open;if(dataTools.open)connection.open=true;dataSummary.focus()};
// Collapsible statistics and indicators leave the actual chart room to breathe.
const metrics=$('chartMetrics'),method=metrics.nextElementSibling;
const stats=document.createElement('details');stats.className='terminal-chart-stats';const statsSummary=document.createElement('summary');statsSummary.textContent='ערכי אינדיקטורים ושיטת החישוב';metrics.before(stats);stats.append(statsSummary,metrics,method);
$('localChartCanvas').after(stats);
const chat=$('chat');chat.querySelector('h2').textContent='ASAF AI';
const context=document.createElement('p');context.id='terminalAIContext';context.className='terminal-ai-context';context.setAttribute('role','status');context.textContent='אין נתוני גרף מחוברים. הניתוח ישתמש בגרף הפתוח כשיהיו נתונים.';
const auto=document.createElement('label');auto.className='terminal-auto-chart';auto.innerHTML='<input id="chatAutoChart" type="checkbox" checked> צרף את הגרף הפתוח אוטומטית';
const account=document.createElement('dialog');account.id='terminalAccountDialog';account.className='terminal-account-dialog';account.setAttribute('aria-labelledby','terminalAccountTitle');
const accountTitle=document.createElement('h2');accountTitle.id='terminalAccountTitle';accountTitle.textContent='כניסה ופרטי חשבון';
const closeAccount=document.createElement('button');closeAccount.type='button';closeAccount.textContent='סגור וחזור לשיחה';
account.append(accountTitle,closeAccount,chat.querySelector('.member-panel'));document.body.append(account);
closeAccount.onclick=()=>account.close();
account.addEventListener('close',()=>accountButton.focus());
accountButton.setAttribute('aria-haspopup','dialog');accountButton.setAttribute('aria-controls',account.id);
const advanced=document.createElement('details');advanced.className='terminal-ai-advanced';const advancedSummary=document.createElement('summary');advancedSummary.textContent='כלי שיחה ומקורות';advanced.append(advancedSummary);
const history=chat.querySelector('.chat-history');
const log=$('chatLog'),form=$('chatForm'),status=$('chatStatus'),request=$('chatRequestState');
for(const node of [...chat.children])if(![chat.querySelector('h2'),history,log,form,status,request].includes(node))advanced.append(node);
chat.append(context,auto,...(history?[history]:[]),log,status,request,form,advanced);
const clear=document.createElement('button');clear.type='button';clear.className='terminal-new-chat';clear.textContent='שיחה חדשה';clear.onclick=()=>$('clearConversation').click();chat.querySelector('h2').append(clear);
accountButton.onclick=()=>{account.showModal();closeAccount.focus()};
let wasAuthenticated=authState.authenticated;
window.addEventListener('asaf:auth',()=>{
 const signedIn=authState.authenticated&&!wasAuthenticated;
 wasAuthenticated=authState.authenticated;
 if(signedIn&&account.open){account.close();selectTab('chat');requestAnimationFrame(()=>$('chatInput').focus())}
});
const conversationNav=document.createElement('div');conversationNav.className='terminal-conversation-nav';
const fullChat=document.createElement('button');fullChat.type='button';fullChat.textContent='פתח שיחה מלאה';fullChat.onclick=()=>{selectTab('chat');$('chatInput').focus()};
const openChart=document.createElement('button');openChart.type='button';openChart.textContent='פתח גרף';openChart.onclick=()=>{selectTab('charts');$('localChartCanvas').focus()};
conversationNav.append(fullChat,openChart);chat.querySelector('h2').after(conversationNav);
const contextDetails=document.createElement('details');contextDetails.className='terminal-conversation-context';const contextSummary=document.createElement('summary');contextSummary.textContent='הגרף והמקורות המצורפים לשיחה';contextDetails.append(contextSummary,context,auto);conversationNav.after(contextDetails);
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
 for(const item of watch){const row=document.createElement('button');row.type='button';row.className='terminal-watch-row';row.setAttribute('aria-label','פתח גרף '+item.symbol);const symbol=document.createElement('strong');symbol.textContent=item.symbol;symbol.dir='ltr';const price=document.createElement('span'),quote=quotes.get(item.symbol);price.textContent=quote?'סגירת נר: '+quote.close.toLocaleString('en-US',{maximumFractionDigits:4}):'—';price.title=quote?'נר '+quote.date+' · '+quote.source:'אין נתוני מחיר';row.append(symbol,price);row.classList.toggle('selected',normalizeSymbol($('symbol').value)===item.symbol);row.onclick=()=>{$('symbol').value=item.symbol;$('symbol').dispatchEvent(new Event('input'));selectTab('charts');$('loadChart').click()};watchList.append(row)}
 if(!watchList.children.length){const p=document.createElement('p');p.textContent='הוסף מניות לרשימת המעקב שלך.';watchList.append(p)}
}
window.addEventListener('asaf:watch-changed',renderWatch);window.addEventListener('storage',renderWatch);$('symbol').addEventListener('input',()=>{context.textContent='אין נתוני גרף תואמים לסימול שנבחר.';renderWatch()});
window.addEventListener('asaf:dataset-ready',e=>{const d=e.detail,last=d?.bars?.at(-1);if(!last)return;quotes.set(d.symbol,{close:last.close,date:last.date,source:d.source||'CSV'});context.textContent=d.symbol+' · '+(d.interval||'1day')+' · '+(d.source==='CoinLore'?'CoinLore · מחקר קריפטו':d.source==='Intrinio'?'Intrinio · ניסיון פנימי':d.source==='Twelve Data'?'נתוני ספק':'נתונים מקומיים')+' · נר '+last.date+' · סגירת הנר: '+last.close+' · '+quoteSummary(d)+' · '+'התקבלו: '+(d.receivedAt||'לא ידוע')+' · '+d.bars.length+' נרות. יישלחו עם השאלה; אין צורך להעלות צילום.';renderWatch()});
window.addEventListener('asaf:dataset-cleared',()=>{quotes.clear();renderWatch();context.textContent='אין נתוני גרף מחוברים. לא ניתן לנתח מחיר עדכני בלי נתונים.'});
renderWatch();
const wide=matchMedia('(min-width: 901px)');
function view(){const selected=document.querySelector('[data-tab].active')?.dataset.tab||'charts';document.body.dataset.view=selected;if(wide.matches){chat.setAttribute('role','region');chat.setAttribute('aria-label','ASAF AI');chat.removeAttribute('aria-labelledby')}else{chat.setAttribute('role','tabpanel');chat.setAttribute('aria-labelledby','tab-chat')}window.dispatchEvent(new Event('asaf:layout'))}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',view);wide.addEventListener('change',view);view();

window.dispatchEvent(new Event('asaf:request-dataset'));

// Viewing controls remain available; chart editing is requested in the conversation.
const focusButton=document.createElement('button');focusButton.type='button';focusButton.className='terminal-focus-button';focusButton.textContent='הסתר AI · הרחב גרף';focusButton.setAttribute('aria-pressed','false');header.append(focusButton);
function chartFocus(enabled){document.body.classList.toggle('terminal-chart-focus',enabled);focusButton.setAttribute('aria-pressed',String(enabled));focusButton.textContent=enabled?'הצג AI לצד הגרף':'הסתר AI · הרחב גרף';window.dispatchEvent(new Event('asaf:layout'))}
focusButton.onclick=()=>chartFocus(!document.body.classList.contains('terminal-chart-focus'));
// Opening the AI explicitly always brings its panel back.
for(const button of [accountButton,$('chartChat')])button.addEventListener('click',()=>chartFocus(false));

$('chatForm').querySelector('button').textContent='שלח';$('chatInput').placeholder='פתח AAPL, הוסף ממוצע 20 וסמן תמיכות…';
$('askAsaf').onclick=()=>{selectTab('chat');chartFocus(false);$('chatInput').focus()};
$('chatForm').before($('cancelChat'));

$('chatIncludeNews').closest('label').classList.add('terminal-news-context');$('chatIncludeNews').closest('label').lastChild.textContent=' צרף כותרות אחרונות מהמטמון — ללא קריאת כתבות מלאות';auto.after($('chatIncludeNews').closest('label'));
if(!new URL(location.href).searchParams.has('tab'))selectTab('chat');

// Compact chart workbench: keep the original controls and event handlers.
const chartPanel=$('localChartPanel'),chartNav=$('localChartRange').closest('.row');
chartNav.classList.add('chart-navigation-strip');
const chartTop=document.createElement('div');chartTop.className='chart-workbench-top';
chartPanel.prepend(chartTop);chartTop.append($('localChartTitle'));
const chartChatOnly=document.createElement('button');chartChatOnly.type='button';chartChatOnly.id='chartChatOnly';chartChatOnly.className='primary chart-chat-only';chartChatOnly.textContent='דבר עם הצ׳אט על הגרף';chartTop.append(chartChatOnly);
const fullscreen=$('chartFullscreen');chartTop.append(fullscreen);
$('localChartCanvas').after(chartNav);
const notes=document.createElement('details');notes.className='chart-notes';
const notesTitle=document.createElement('summary');notesTitle.textContent='מידע על הנתונים והחישובים';notes.append(notesTitle);
for(const node of [...chartPanel.children])if(node.matches('p'))notes.append(node);
chartPanel.append(notes);

// The chart has a single conversation entry point, with no manual drawing rail.
const chartBody=document.createElement('div');chartBody.className='chart-workbench-body';
const chartViewport=document.createElement('div');chartViewport.className='chart-viewport';
const quoteLine=document.createElement('div');quoteLine.id='chartOHLC';quoteLine.className='chart-ohlc';quoteLine.dir='ltr';quoteLine.setAttribute('aria-label','נתוני הנר הנבחר');
const canvas=$('localChartCanvas');canvas.before(chartBody);chartBody.append(chartViewport);chartViewport.append(quoteLine,canvas);
const quickRanges=document.createElement('div');quickRanges.className='chart-quick-ranges';quickRanges.setAttribute('role','group');quickRanges.setAttribute('aria-label','מספר נרות בתצוגה');
for(const value of ['30','60','120','200']){const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-label','הצג '+value+' נרות');button.onclick=()=>{$('localChartRange').value=value;$('localChartRange').dispatchEvent(new Event('change'))};quickRanges.append(button)}chartNav.prepend(quickRanges);
const advancedChart=document.createElement('details');advancedChart.className='chart-advanced-footer';const chartFooterSummary=document.createElement('summary');chartFooterSummary.textContent='נתוני נרות וייצוא';advancedChart.append(chartFooterSummary);
for(const node of [...chartPanel.children])if(node!==chartTop&&node!==chartBody&&node!==chartNav)advancedChart.append(node);chartPanel.append(advancedChart);

const exactRange=document.createElement('div');exactRange.className='row';const rangeLabel=chartNav.querySelector('label[for="localChartRange"]');if(rangeLabel)exactRange.append(rangeLabel);exactRange.append($('localChartRange'));advancedChart.append(exactRange);

// Chart workspace occupies the page; retain a single conversation and chart instance.
mountAssetSearch({host:command,open(symbol){$('symbol').value=symbol;$('symbol').dispatchEvent(new Event('input'));selectTab('charts');$('marketFetch').click()}});
const workspaceChat=document.createElement('button');workspaceChat.type='button';workspaceChat.className='workspace-chat-toggle';workspaceChat.textContent='✦ ASAF AI';workspaceChat.setAttribute('aria-expanded','false');command.append(workspaceChat);
function toggleWorkspaceChat(open){document.body.classList.toggle('chart-chat-open',open);workspaceChat.setAttribute('aria-expanded',String(open));workspaceChat.textContent=open?'סגור צ׳אט':'✦ ASAF AI';if(open)$('chatInput').focus();window.dispatchEvent(new Event('asaf:layout'))}
workspaceChat.onclick=()=>toggleWorkspaceChat(!document.body.classList.contains('chart-chat-open'));
chartChatOnly.onclick=()=>{chartFocus(false);toggleWorkspaceChat(true);if(!$('chatInput').value.trim())$('chatInput').value='נתח את הגרף והצג נקודת כניסה וסטופ־לוס עם התנאים לתרחיש';$('chatInput').dispatchEvent(new Event('input'));$('chatInput').focus()};
// Reveal executed chart changes, including requests made from the full chat page.
window.addEventListener('asaf:chart-actions',()=>{
 selectTab('charts');
 toggleWorkspaceChat(wide.matches);
 // On phones, close the composer keyboard and sidebar so the result is visible.
 $('localChartCanvas').focus({preventScroll:true});
});
const closeSidebar=document.createElement('button');closeSidebar.type='button';closeSidebar.className='chart-chat-close';closeSidebar.textContent='חזרה לגרף';closeSidebar.onclick=()=>toggleWorkspaceChat(false);conversationNav.append(closeSidebar);
const quickActions=document.createElement('div');quickActions.className='chart-ai-prompts';quickActions.setAttribute('aria-label','בקשות ניתוח מהירות');
for(const label of ['נתח את הגרף עם נקודת כניסה וסטופ־לוס','מתח קווי מגמה','סמן תמיכות והתנגדויות','הוסף ממוצע 20 וממוצע 150']){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{$('chatInput').value=label;$('chatInput').focus()};quickActions.append(button)}
form.before(quickActions);
const visibleMarketStatus=document.createElement('p');visibleMarketStatus.className='chart-load-status';visibleMarketStatus.setAttribute('role','status');$('charts').prepend(visibleMarketStatus);
const syncMarketStatus=()=>visibleMarketStatus.textContent=$('marketFetchStatus').textContent;new MutationObserver(syncMarketStatus).observe($('marketFetchStatus'),{childList:true,subtree:true,characterData:true});syncMarketStatus();
$('loadChart').addEventListener('click',()=>{selectTab('charts');$('marketFetch').click()});

// Clear starting points; suggestions fill a draft and never send it automatically.
const intro=document.createElement('p');intro.className='conversation-intro';
intro.textContent='מה תרצה לבדוק היום? בחר מניה, בקש ניתוח או הוסף כלי לגרף.';
chat.querySelector('h2').after(intro);
quickActions.classList.add('conversation-prompts');
for(const button of quickActions.querySelectorAll('button')){
 button.onclick=()=>{
  const input=$('chatInput'),suggestion=button.textContent;
  if(input.value.trim()&&input.value.trim()!==suggestion&&!window.confirm('להחליף את הטיוטה בבקשה שנבחרה?'))return;
  input.value=suggestion;input.dispatchEvent(new Event('input'));input.focus();
 };
}
const stop=$('cancelChat');form.after(stop);stop.classList.add('conversation-stop');
$('chatInput').placeholder='כתוב כאן מה תרצה לבדוק או לעשות בגרף…';
const composerHint=document.createElement('p');composerHint.className='composer-hint';
composerHint.textContent='ההצעות ממלאות טיוטה. רק לחיצה על ״שלח״ שולחת אותה.';
quickActions.after(composerHint);
const navLabels={charts:'גרפים',scanner:'סורק מניות',news:'חדשות',chat:'ASAF AI',risk:'מחשבון סיכון',watch:'מעקב'};
for(const tab of document.querySelectorAll('.tabs [data-tab]'))tab.textContent=navLabels[tab.dataset.tab]||tab.textContent;
$('journalLink').textContent='יומן מסחר';
