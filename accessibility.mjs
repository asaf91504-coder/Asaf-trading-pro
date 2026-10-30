export const preferenceKey='asaf-accessibility-v1';
export function normalizePreferences(value={}) {
 const input=value&&typeof value==='object'?value:{};
 return Object.fromEntries(['largeText','contrast','underline','reduceMotion','disableShortcuts'].map(key=>[key,input[key]===true]));
}
if(typeof document!=='undefined'){
 let preferences=normalizePreferences();
 try{preferences=normalizePreferences(JSON.parse(localStorage.getItem(preferenceKey)||'{}'))}catch{}
 const root=document.documentElement;
 const apply=()=>{for(const [key,value] of Object.entries(preferences))root.dataset[key]=String(value)};
 apply();
 const header=document.querySelector('.terminal-app header');
 if(header){const button=document.createElement('button');button.type='button';button.dataset.accessibilityOpen='';button.textContent='נגישות';button.className='terminal-accessibility-button';header.append(button)}
 const dialog=document.createElement('dialog');dialog.className='accessibility-dialog';dialog.id='accessibilityDialog';dialog.setAttribute('aria-labelledby','accessibilityTitle');
 dialog.innerHTML='<h2 id="accessibilityTitle">נגישות ונוחות קריאה</h2><p>ההעדפות נשמרות במכשיר זה. אפשר גם להשתמש בזום של הדפדפן.</p><form method="dialog"><button class="accessibility-close" aria-label="סגור הגדרות נגישות">סגור ✕</button></form><div class="accessibility-options"></div><button type="button" id="resetAccessibility">איפוס העדפות</button><p role="status" id="accessibilityStatus"></p><a href="/accessibility.html">הצהרת נגישות ודיווח על קושי</a>';
 document.body.append(dialog);
 const labels={largeText:'טקסט מוגדל בממשק',contrast:'ניגודיות גבוהה בממשק',underline:'הדגשת קישורים בקו תחתון',reduceMotion:'הפחתת תנועה וגלילה מונפשת',disableShortcuts:'ביטול קיצורי המקשים / ו־?'};
 const status=dialog.querySelector('[role="status"]');
 function save(){apply();try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));status.textContent='ההעדפות נשמרו במכשיר.'}catch{status.textContent='ההעדפות הופעלו לביקור הנוכחי; הדפדפן אינו מאפשר שמירה.'}}
 for(const [key,label] of Object.entries(labels)){
  const wrap=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=preferences[key];input.dataset.preference=key;
  input.addEventListener('change',()=>{preferences[key]=input.checked;save()});wrap.append(input,document.createTextNode(label));dialog.querySelector('.accessibility-options').append(wrap);
 }
 dialog.querySelector('#resetAccessibility').addEventListener('click',()=>{preferences=normalizePreferences();for(const input of dialog.querySelectorAll('[data-preference]'))input.checked=false;save()});
 let opener;
 for(const button of document.querySelectorAll('[data-accessibility-open]'))button.addEventListener('click',()=>{opener=button;dialog.showModal();dialog.querySelector('.accessibility-close').focus()});
 dialog.addEventListener('close',()=>{if(document.activeElement===document.body||dialog.contains(document.activeElement))opener?.focus()});
 // Native modal focus containment + Escape; never trap focus in a custom overlay.
 for(const link of document.querySelectorAll('.skip-links a'))link.addEventListener('click',event=>{
  const id=link.getAttribute('href').slice(1);let target=document.getElementById(id);if(!target)return;
  event.preventDefault();if(id==='chatInput')document.querySelector('[data-tab="chat"]')?.click();target.focus();target.scrollIntoView({block:id==='mainContent'?'start':'center',behavior:'instant'});
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||dialog.open)return;
  const menu=event.target.closest?.('.terminal-indicators[open],.chart-drawing-menu[open],.terminal-global-tools[open]');
  if(menu){menu.open=false;menu.querySelector('summary')?.focus();event.stopPropagation()}
 });
}
