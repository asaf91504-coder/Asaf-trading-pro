// Preserve every scanner field and its handlers; change only the presentation.
const $=id=>document.getElementById(id),scanner=$('scanner');
const heading=scanner.querySelector('.section-heading');
heading.querySelector('h2').textContent='מצא מניות למחקר';
heading.querySelector('.eyebrow').textContent='סורק מניות';
const intro=heading.nextElementSibling;intro.textContent='בחר מניות, הגדר את התנאים ולחץ על סריקה. את התוצאות אפשר לפתוח בגרף ולנתח עם ASAF AI.';
const provider=$('scanProvider').closest('details');provider.open=true;provider.classList.add('scanner-start');provider.querySelector('summary').textContent='1 · אילו מניות לבדוק?';
$('scanProviderSymbols').placeholder='AAPL, NVDA, MSFT';$('scanProvider').textContent='סרוק את המניות';$('scanProvider').classList.add('primary');
provider.querySelector('p').textContent='עד 5 סימולים, מופרדים בפסיקים. נדרש חיבור נתונים פעיל; שווי שוק עדיין אינו נבדק.';
const basic=document.createElement('section');basic.className='scanner-basic';basic.setAttribute('aria-labelledby','scannerBasicTitle');basic.innerHTML='<h3 id="scannerBasicTitle">2 · תנאים עיקריים</h3><p>אפשר להתחיל עם ההגדרות הקיימות. שינוי תנאי מסנן את הנתונים שכבר נטענו.</p><div class="scanner-fields"></div>';
const advanced=document.createElement('details');advanced.className='scanner-advanced';advanced.innerHTML='<summary>מסננים מתקדמים</summary><p>תנופה, תנודתיות ותבניות טכניות. תנאים שסומנו ממשיכים לפעול גם כשהאזור סגור.</p><div class="scanner-fields"></div>';
const filterRow=$('scanMinPrice').closest('.row');filterRow.before(basic,advanced);
const simple=new Set(['scanMinPrice','scanMinVolume','scanAbove20','scanRisingVolume']);
for(const label of [...filterRow.querySelectorAll('label')]){const field=label.querySelector('input,select');(simple.has(field?.id)?basic:advanced).querySelector('.scanner-fields').append(label);if(field?.type==='checkbox')label.classList.add('scanner-check')}
filterRow.remove();
function rename(id,text,help){const input=$(id),label=input.closest('label');for(const node of [...label.childNodes])if(node.nodeType===3)node.remove();const title=document.createElement('span');title.textContent=text;label.prepend(title);if(help){const note=document.createElement('small');note.textContent=help;label.append(note)}}
rename('scanMinPrice','מחיר מניה מינימלי ($)');rename('scanMinVolume','מחזור ביחס לממוצע','1 = המחזור הממוצע; 1.5 = פי אחד וחצי.');rename('scanAbove20','מחיר מעל ממוצע 20 ימים');rename('scanRisingVolume','יום של עלייה עם מחזור גבוה');
const count=document.createElement('p');count.className='scanner-active-filters';count.setAttribute('role','status');basic.append(count);
function updateCount(){const checked=advanced.querySelectorAll('input[type=checkbox]:checked').length;count.textContent=checked?'בנוסף: '+checked+' מסנני סימון מתקדמים פעילים. פתח את המסננים המתקדמים לבדיקת כל הערכים.':'אפשרויות נוספות נמצאות במסננים המתקדמים.'}
scanner.addEventListener('input',updateCount);scanner.addEventListener('change',updateCount);updateCount();
const methodology=$('scanStatus').nextElementSibling;if(methodology?.tagName==='P'){const details=document.createElement('details');details.className='scanner-methodology';const summary=document.createElement('summary');summary.textContent='איך מחושבים הנתונים?';methodology.before(details);details.append(summary,methodology)}
const resultTitle=document.createElement('h3');resultTitle.textContent='3 · תוצאות הסריקה';$('scanStatus').before(resultTitle);
const table=$('scanRows').closest('table');table.classList.add('scanner-results-table');const headers=[...table.querySelectorAll('thead th')].map(h=>h.textContent);
function labelCells(){for(const row of $('scanRows').rows)for(let i=0;i<row.cells.length;i++){const cell=row.cells[i];if(cell.colSpan===1)cell.dataset.label=headers[i]||''}}
new MutationObserver(labelCells).observe($('scanRows'),{childList:true,subtree:true});labelCells();
const presets=scanner.querySelector('.scanner-preset-tools');if(presets)advanced.append(presets);
const utilities=$('scanClear').closest('.row');utilities.classList.add('scanner-result-actions');scanner.querySelector('.table-scroll').after(utilities);
