import {personalData,tradeProfit} from './personal-data.mjs';
import {mountPersonalSync} from './personal-sync-ui.mjs';
const $=id=>document.getElementById(id),key='asaf_trades_v1';let trades=[],editing=null,storageInvalid=false;
const today=()=>new Date().toLocaleDateString('en-CA');
const usd=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const fields=['symbol','date','side','entry','exit','qty','fees','setup','quality','note'];
function clearForm(){editing=null;$('form').reset();$('date').value=today();$('fees').value='0';$('submitTrade').textContent='שמור עסקה';$('cancelEdit').hidden=true}
function save(next){try{if(storageInvalid)throw Error('היומן הקיים אינו תקין. ייבא גיבוי תקין לפני שמירת שינויים.');const clean=personalData('journal',next);localStorage.setItem(key,JSON.stringify(clean));trades=clean;render();$('journalStatus').textContent='היומן נשמר במכשיר. שמירה לחשבון דורשת לחיצה נפרדת.';return true}catch(e){$('journalStatus').textContent='השמירה נכשלה: '+e.message;return false}}
function render(){
 const rows=$('rows');rows.replaceChildren();let sum=0,wins=0,gains=0,losses=0,best=null;
 for(const t of trades){const value=tradeProfit(t);sum+=value;if(value>0){wins++;gains+=value}else if(value<0)losses-=value;if(best===null||value>best)best=value;
  const row=document.createElement('tr');for(const [i,v] of [t.date,t.symbol,t.side,t.entry,t.exit,t.qty,t.fees,usd(value),t.setup,t.quality,t.note].entries()){const cell=document.createElement('td');cell.textContent=String(v);if(i===7)cell.className=value>=0?'green':'red';row.append(cell)}
  const actions=document.createElement('td'),edit=document.createElement('button'),remove=document.createElement('button');edit.type=remove.type='button';edit.textContent='ערוך';remove.textContent='מחק';
  edit.onclick=()=>{for(const field of fields)$(field).value=t[field];editing=t.id;$('submitTrade').textContent='שמור שינוי לעסקה';$('cancelEdit').hidden=false;$('symbol').focus();$('journalStatus').textContent='עריכת '+t.symbol+' · '+t.date};
  remove.onclick=()=>{if(window.confirm('למחוק עסקה זו מהמכשיר? העותק בחשבון יתעדכן רק בשמירה מפורשת.')){if(save(trades.filter(x=>x.id!==t.id))&&editing===t.id)clearForm()}};
  actions.append(edit,remove);row.append(actions);rows.append(row);
 }
 if(!trades.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=12;cell.textContent='עדיין אין עסקאות במכשיר. הוסף עסקה או טען גיבוי.';row.append(cell);rows.append(row)}
 $('count').textContent=trades.length;$('win').textContent=(trades.length?wins/trades.length*100:0).toFixed(1)+'%';$('pnl').textContent=usd(sum);$('pnl').className=sum>=0?'green':'red';$('avg').textContent=usd(trades.length?sum/trades.length:0);$('pf').textContent=losses?(gains/losses).toFixed(2):gains?'∞':'—';$('best').textContent=best===null?'—':usd(best);
}
$('form').onsubmit=e=>{e.preventDefault();if(!editing&&trades.length>=300){$('journalStatus').textContent='מקסימום 300 עסקאות. גבה וצמצם לפני הוספה.';return}const t=Object.fromEntries(fields.map(f=>[f,$(f).value]));t.id=editing||crypto.randomUUID();t.symbol=t.symbol.trim().toUpperCase().replace(/[^A-Z0-9._:-]/g,'');for(const f of ['entry','exit','qty','fees'])t[f]=Number(t[f]);const next=editing?trades.map(x=>x.id===editing?t:x):[t,...trades];if(save(next))clearForm()};
$('cancelEdit').onclick=clearForm;
const csvCell=x=>'"'+String(x??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';
$('export').onclick=()=>{const rows=[['date','symbol','side','entry','exit','quantity','fees_usd','pnl_usd','setup','quality','notes'],...trades.map(t=>[t.date,t.symbol,t.side,t.entry,t.exit,t.qty,t.fees,tradeProfit(t).toFixed(2),t.setup,t.quality,t.note])],url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='asaf-trading-journal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('clear').onclick=()=>{if(window.confirm('למחוק לצמיתות את כל העסקאות שבמכשיר? גבה קודם. העותק בחשבון אינו משתנה עד שמירה מפורשת.')){if(save([]))clearForm()}};
function reloadJournal(){try{const loaded=personalData('journal',JSON.parse(localStorage.getItem(key)||'[]'));trades=loaded;storageInvalid=false;clearForm();render();$('journalStatus').textContent='העותק המקומי עודכן.'}catch{storageInvalid=true;$('journalStatus').textContent='לא ניתן לקרוא את היומן המקומי. הנתונים המקוריים נשמרו ללא שינוי.'}}
window.addEventListener('asaf:personal-loaded',e=>{if(e.detail?.section==='journal')reloadJournal()});window.addEventListener('storage',e=>{if(e.key===key)reloadJournal()});
clearForm();reloadJournal();render();mountPersonalSync(document.getElementById('journalSync'),{only:'journal'});
