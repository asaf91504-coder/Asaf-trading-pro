import {authState,refreshAuth} from './auth-ui.mjs';
import {personalSections,personalKeys,personalData,emptyPersonal,mergePersonal,personalBackup,parsePersonalBackup} from './personal-data.mjs';
const labels={journal:'יומן העסקאות',research:'מקורות המחקר',chartPreferences:'העדפות הגרף',drawings:'קווי המגמה'};
const defaults={style:'candles',chartMA20:true,chartMA150:true,chartEMA50:false,chartRSI14:true,chartBB20:false,chartMACD:false,chartATR14:false};
const read=section=>{const saved=JSON.parse(localStorage.getItem(personalKeys[section])||JSON.stringify(emptyPersonal(section)));return personalData(section,section==='chartPreferences'?{...defaults,...saved}:saved)};
function applyLocal(section,value){localStorage.setItem(personalKeys[section],JSON.stringify(value));window.dispatchEvent(new CustomEvent('asaf:personal-loaded',{detail:{section}}))}
function backup(section,value){const blob=new Blob([JSON.stringify(personalBackup(section,value),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='asaf-'+section+'-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function remote(body){const r=await fetch('/.netlify/functions/workspace',{method:body?'PUT':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const value=await r.json();if(!r.ok){if(r.status===401)await refreshAuth();const error=Error(value.error||'הסנכרון נכשל');error.status=r.status;throw error}return value}
export function mountPersonalSync(host,{only=null}={}){
 if(!host)return;const sectionNames=only?[only]:personalSections,revisions=new Map();let busy=false,member=undefined;
 const title=document.createElement('h3');title.textContent='עותק אישי בחשבון וגיבוי במכשיר';
 const help=document.createElement('p');help.className='muted';help.textContent='הנתונים נשארים במכשיר עד שתבחר לשמור לחשבון. טעינה ממזגת עסקאות ומקורות לפי מזהה, עם עדיפות לעותק מהחשבון. העדפות וקווים לאותה מניה מהחשבון מחליפים את המקבילים המקומיים. גבה לפני טעינה. נרות וצילומי גרף אינם נכללים.';
 const row=document.createElement('div');row.className='row bar';const select=document.createElement('select');select.setAttribute('aria-label','סוג נתונים אישיים');select.id='personalSection';for(const section of sectionNames){const option=document.createElement('option');option.value=section;option.textContent=labels[section];select.append(option)}
 const load=document.createElement('button'),save=document.createElement('button'),exportButton=document.createElement('button'),importLabel=document.createElement('label'),file=document.createElement('input'),status=document.createElement('p');
 for(const b of [load,save,exportButton])b.type='button';load.textContent='טען ומזג נתונים מהחשבון';save.textContent='שמור נתונים לחשבון';exportButton.textContent='גבה נתונים לקובץ JSON';importLabel.textContent='מזג גיבוי JSON ';file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','ייבוא גיבוי נתונים אישיים');importLabel.append(file);status.setAttribute('role','status');status.id='personalSyncStatus';row.append(select,load,save,exportButton);host.append(title,help,row,importLabel,status);
 function render(){load.disabled=save.disabled=busy||!authState.authenticated;select.disabled=file.disabled=exportButton.disabled=busy}
 function auth(){if(member!==authState.memberId){member=authState.memberId;revisions.clear();status.textContent=member?'מחובר. בחר סוג נתונים לטעינה או לשמירה.':'לשמירה בחשבון היכנס בדף הראשי, בלשונית ASAF AI. גיבוי וייבוא מקומיים זמינים גם ללא כניסה.'}render()}
 window.addEventListener('asaf:auth',auth);auth();
 async function sync(action){if(busy)return;const section=select.value,id=authState.memberId;let before;try{before=read(section)}catch(e){status.textContent=e.message;return}if(!id)return;
  if(!window.confirm((action==='save'?'לשמור לחשבון שלך עותק של ':'לטעון מהחשבון ולמזג במכשיר את ')+labels[section]+'? '+(action==='save'?'פעולה זו מחליפה את העותק הקודם של סוג הנתונים הזה בחשבון.':'פרטים מהחשבון יקבלו עדיפות בכפילויות. מומלץ לגבות קודם.')))return;
  busy=true;render();status.textContent='מעבד '+labels[section]+'…';try{
   if(action==='save'&&!revisions.has(section)){const current=await remote();if(authState.memberId!==id)throw Error('החשבון השתנה.');if(Object.hasOwn(current,section))throw Error('כבר קיים עותק בחשבון. טען ומזג לפני שמירה.');revisions.set(section,current.revision)}
   if(authState.memberId!==id)throw Error('החשבון השתנה.');const data=await remote(action==='save'?{section,data:before,revision:revisions.get(section),memberId:id}:null);
   if(authState.memberId!==id)throw Error('החשבון השתנה. הנתונים לא הוחלו במכשיר.');
   if(action==='load'){
    if(JSON.stringify(read(section))!==JSON.stringify(before))throw Error('הנתונים במכשיר השתנו בזמן הטעינה. נסה שוב.');
    if(Object.hasOwn(data,section)){let merged=mergePersonal(section,before,data[section]);if(section==='chartPreferences')merged={...defaults,...merged};applyLocal(section,merged)}
   }
   revisions.set(section,data.revision);status.textContent=action==='load'?(Object.hasOwn(data,section)?labels[section]+' מוזגו במכשיר. השמירה בחשבון עדיין דורשת לחיצה נפרדת.':'אין עדיין עותק מסוג זה בחשבון. אפשר לשמור את הנתונים המקומיים.'):labels[section]+' נשמרו בחשבון.'+(JSON.stringify(read(section))!==JSON.stringify(before)?' הנתונים המקומיים השתנו בזמן השמירה; שמור שוב כדי לעדכן אותם.':'');
  }catch(e){if(e.status===409)revisions.clear();status.textContent=e.message}finally{busy=false;render()}
 }
 load.onclick=()=>sync('load');save.onclick=()=>sync('save');exportButton.onclick=()=>{try{backup(select.value,read(select.value));status.textContent='הגיבוי נוצר במכשיר. לא נשלח לחשבון.'}catch(e){status.textContent=e.message}};
 file.onchange=async()=>{const selected=select.value,f=file.files?.[0];if(!f)return;busy=true;render();try{if(f.size>750000)throw Error('גיבוי גדול מדי');const incoming=parsePersonalBackup(await f.text(),selected);if(!window.confirm('למזג את הגיבוי של '+labels[selected]+'? פרטי הגיבוי יקבלו עדיפות בכפילויות.'))return;let merged=mergePersonal(selected,read(selected),incoming);if(selected==='chartPreferences')merged={...defaults,...merged};applyLocal(selected,merged);status.textContent='הגיבוי מוזג במכשיר בלבד. לשמירה בחשבון לחץ על כפתור השמירה.'}catch(e){status.textContent=e.message}finally{file.value='';busy=false;render()}};
}
mountPersonalSync(document.getElementById('personalSync'));
