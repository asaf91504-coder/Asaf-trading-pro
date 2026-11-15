import {authState} from './auth-ui.mjs';
import {personalData} from './personal-data.mjs';
import {journalDraft,validatedJournalTrade,journalStorageKey,appendCloudTrade} from './journal-chat-core.mjs';
export function mountJournalDraft(host,question,{onSaved=()=>{}}={}){
 const owner=authState.authenticated?authState.memberId:null;
 const initial=journalDraft(question),id=crypto.randomUUID(),form=document.createElement('form'),fields={};
 form.className='journal-chat-draft';form.setAttribute('aria-label','טיוטה ליומן המסחר');
 const intro=document.createElement('p');intro.textContent='בדוק את פרטי העסקה לפני השמירה. מחיר יציאה ריק פירושו עסקה פתוחה. אין ביצוע מסחר.';
 form.append(intro);
 const specs=[['symbol','סימול','text'],['date','תאריך','date'],['side','כיוון','select'],['entry','מחיר כניסה','number'],['exit','מחיר יציאה','number'],['qty','כמות','number'],['fees','עמלות ($)','number'],['note','לקחים / הערות','text']];
 for(const [name,title,type] of specs){
  const label=document.createElement('label');label.textContent=title;
  const input=document.createElement(type==='select'?'select':'input');fields[name]=input;
  if(type==='select'){for(const [value,text] of [['long','לונג'],['short','שורט']]){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option)}}
  else{input.type=type;if(type==='number'){input.min=name==='fees'?'0':'0.00001';input.step='any'}if(type==='text')input.maxLength=name==='symbol'?30:1000;}
  input.required=['symbol','date','entry','qty'].includes(name);input.value=initial[name]??'';input.setAttribute('aria-label',title);label.append(input);form.append(label);
 }
 const submit=document.createElement('button');submit.type='submit';submit.textContent=owner?'שמור ביומן ובחשבון':'שמור ביומן במכשיר';
 const status=document.createElement('p');status.setAttribute('role','status');
 const link=document.createElement('a');link.href='/journal.html';link.textContent='פתח יומן מסחר';
 form.append(submit,status,link);host.append(form);
 let saved=null,busy=false,localSaved=false;
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  if((authState.authenticated?authState.memberId:null)!==owner||!authState.checkAvailable){status.textContent='החשבון השתנה או שלא ניתן לאמת כניסה. שלח את הבקשה מחדש.';return;}
  busy=true;submit.disabled=true;
  try{
   if(!saved){
    const values={...initial,...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]))};
    saved=validatedJournalTrade(values,id);
    const key=journalStorageKey(owner),rows=personalData('journal',JSON.parse(localStorage.getItem(key)||'[]'));
    localStorage.setItem(key,JSON.stringify(personalData('journal',[saved,...rows])));
    localSaved=true;for(const input of Object.values(fields))input.disabled=true;
    window.dispatchEvent(new CustomEvent('asaf:personal-loaded',{detail:{section:'journal'}}));
   }
   if(owner)await appendCloudTrade(saved,{memberId:owner,getMember:()=>authState.authenticated?authState.memberId:null});
   status.textContent=owner?'העסקה נשמרה ביומן ובחשבון.':'העסקה נשמרה ביומן במכשיר בלבד.';
   onSaved(status.textContent);submit.hidden=true;
  }catch(error){
   status.textContent=(localSaved?'העותק נשמר במכשיר. ':'')+error.message;
   submit.textContent=saved&&owner?'נסה לשמור שוב בחשבון':'נסה שוב';
   // Do not retry an uncertain local write as if it had succeeded.
   if(!localSaved)saved=null;
  }finally{busy=false;submit.disabled=false;}
 };
 return form;
}
