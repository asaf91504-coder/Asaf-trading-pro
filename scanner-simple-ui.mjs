// Preserve every scanner field and its handlers; change only the presentation.
import {asafScannerPreset} from './scanner-presets.mjs';
const $=id=>document.getElementById(id),scanner=$('scanner');
const heading=scanner.querySelector('.section-heading');
heading.querySelector('h2').textContent='מצא מניות למחקר';
heading.querySelector('.eyebrow').textContent='סורק מניות';
const intro=heading.nextElementSibling;intro.textContent='לחץ על ״מצא לי מניות״ כדי לבדוק את מאגר המניות הזמין בחיבור Twelve Data. הסריקה מציגה מועמדות לפי המסננים שלך, ואפשר לפתוח כל תוצאה בגרף.';
const provider=$('scanProvider').closest('details');provider.open=false;provider.classList.add('scanner-start');provider.querySelector('summary').textContent='סריקה ידנית של סימולים';
$('scanProviderSymbols').placeholder='AAPL, NVDA, MSFT';$('scanProvider').textContent='סרוק את המניות';$('scanProvider').classList.add('primary');
provider.querySelector('p').textContent='עד 10 סימולים, מופרדים בפסיקים. נדרש חיבור נתונים פעיל; שווי שוק נבדק כשהנתון זמין; נתון חסר לא יעבור את סף שווי השוק.';
const discover=document.createElement('section');discover.className='scanner-discovery';discover.innerHTML='<h3>1 · מצא לי מניות</h3><p>סריקה של המניות המורשות בחיבור הנוכחי, בקבוצות ובכפוף למכסה. התוצאות מתעדכנות תוך כדי; אין כאן סריקה של כלל הבורסה.</p><div class="row"><button id="scanDiscover" class="primary" type="button">מצא לי מניות</button><button id="scanAsafRules" type="button">הכללים שלי</button><button id="scanDiscoverStop" type="button" hidden>עצור סריקה</button></div><p id="scanDiscoverStatus" role="status">הסריקה משתמשת בנרות יומיים שהושלמו. שווי שוק חסר אינו נחשב התאמה מלאה.</p>';provider.before(discover);
const basic=document.createElement('section');basic.className='scanner-basic';basic.setAttribute('aria-labelledby','scannerBasicTitle');basic.innerHTML='<h3 id="scannerBasicTitle">2 · תנאים עיקריים</h3><p>אפשר להתחיל עם ההגדרות הקיימות. לאחר שינוי תנאי לחץ על ״עדכן תוצאות לפי המסננים״. החישוב מתבצע בשרת.</p><div class="scanner-fields"></div>';
const advanced=document.createElement('details');advanced.className='scanner-advanced';advanced.innerHTML='<summary>מסננים מתקדמים</summary><p>תנופה, תנודתיות ותבניות טכניות. תנאים שסומנו ממשיכים לפעול גם כשהאזור סגור.</p><div class="scanner-fields"></div>';
const filterRow=$('scanMinPrice').closest('.row');filterRow.before(basic,advanced);
const simple=new Set(['scanMinMarketCap','scanMinPrice','scanMinVolume','scanAbove20','scanRisingVolume','scanScenarioSide']);
for(const label of [...filterRow.querySelectorAll('label')]){const field=label.querySelector('input,select');(simple.has(field?.id)?basic:advanced).querySelector('.scanner-fields').append(label);if(field?.type==='checkbox')label.classList.add('scanner-check')}
filterRow.remove();
function rename(id,text,help){const input=$(id),label=input.closest('label');for(const node of [...label.childNodes])if(node.nodeType===3)node.remove();const title=document.createElement('span');title.textContent=text;label.prepend(title);if(help){const note=document.createElement('small');note.textContent=help;label.append(note)}}
rename('scanMinPrice','מחיר מניה מינימלי ($)');rename('scanMinVolume','מחזור ביחס לממוצע','1 = המחזור הממוצע; 1.5 = פי אחד וחצי.');rename('scanAbove20','מעל MA20 ללונג, מתחת MA20 לשורט');rename('scanRisingVolume','תנועה בכיוון התרחיש עם מחזור גבוה');
const count=document.createElement('p');count.className='scanner-active-filters';count.setAttribute('role','status');basic.append(count);
function updateCount(){const checked=advanced.querySelectorAll('input[type=checkbox]:checked').length;count.textContent=checked?'בנוסף: '+checked+' מסנני סימון מתקדמים פעילים. פתח את המסננים המתקדמים לבדיקת כל הערכים.':'אפשרויות נוספות נמצאות במסננים המתקדמים.'}
scanner.addEventListener('input',updateCount);scanner.addEventListener('change',updateCount);updateCount();
const methodology=$('scanStatus').nextElementSibling;if(methodology?.tagName==='P'){const details=document.createElement('details');details.className='scanner-methodology';const summary=document.createElement('summary');summary.textContent='איך מחושבים הנתונים?';methodology.before(details);details.append(summary,methodology)}
const resultTitle=document.createElement('h3');resultTitle.textContent='3 · תוצאות הסריקה';$('scanStatus').before(resultTitle);
const table=$('scanRows').closest('table');table.classList.add('scanner-results-table');
function labelCells(){const headers=[...table.querySelectorAll('thead th')].map(h=>h.textContent);for(const row of $('scanRows').rows)for(let i=0;i<row.cells.length;i++){const cell=row.cells[i],label=headers[i]||'';if(cell.colSpan===1&&cell.dataset.label!==label)cell.dataset.label=label}}
new MutationObserver(labelCells).observe($('scanRows'),{childList:true,subtree:true});window.addEventListener('asaf:language',labelCells);labelCells();
const presets=scanner.querySelector('.scanner-preset-tools');if(presets)advanced.append(presets);
const utilities=$('scanClear').closest('.row');utilities.classList.add('scanner-result-actions');scanner.querySelector('.table-scroll').after(utilities);

const shortlist=document.createElement('div');shortlist.id='scanShortlist';shortlist.className='scanner-shortlist';$('scanSummary').after(shortlist);
function applyCoreRules(){
 const preset=asafScannerPreset();
 for(const id of ['scanMinMarketCap','scanMinPrice','scanMinVolume','scanMinMeasuredMove','scanScenarioSide'])$(id).value=String(preset[id]);
 for(const id of ['scanAbove20','scanRisingVolume','scanOnlyMatches'])$(id).checked=preset[id];
 $('scanMinPrice').dispatchEvent(new Event('input',{bubbles:true}));
}
// Start in the reviewed technical framework; optional advanced controls remain available.
applyCoreRules();
$('scanAsafRules').onclick=()=>{
 applyCoreRules();
 $('scanDiscoverStatus').textContent='הוחלו כללי הסריקה ללונג ולשורט. מועמדות למעקב אינן התאמות מלאות.';
};
