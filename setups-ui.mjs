import {languageCode} from './interface-language.mjs';
import {parseSetupPrice} from './setup-price-input.mjs';
const $=id=>document.getElementById(id);
const locale=()=>languageCode(document.documentElement.lang);
const PRICE_FORMAT='הזן מחיר חיובי בלי מפריד אלפים, למשל 1234.50. אם התכוונת ל־1.234 כמספר עשרוני, הזן 1.2340.';
const names={entry:'כניסה',stop:'סטופ',target:'יעד יציאה'};
let data=null,busy=false,editing=null;
const el=(tag,text='',className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node};
function date(value){if(value==null||value==='')return '—';const stamp=new Date(value);return Number.isFinite(stamp.getTime())?stamp.toLocaleString(locale()):'—'}
function candleDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '—';const stamp=new Date(value+'T00:00:00Z');return Number.isFinite(stamp.getTime())?stamp.toLocaleDateString(locale(),{timeZone:'UTC'}):'—'}
function authored(node){node.setAttribute('translate','no');node.dir='auto';return node}
function levelsFor(scenario){
 const list=el('dl','','levels');
 for(const [key,label] of Object.entries(names)){
  const cell=document.createElement('div');
  cell.append(el('dt',label),el('dd',Number(scenario[key]).toLocaleString(locale(),{maximumFractionDigits:8})));list.append(cell);
 }
 return list;
}
function action(label,onClick,options={}){
 const button=el('button',label,options.className);
 button.type='button';button.disabled=busy||!!options.disabled;button.onclick=onClick;return button;
}
function openEditor(item){
 const prefilled=Object.fromEntries(Object.keys(names).map(key=>[key,item.draft?.[key]??item.scenario[key]]));
 editing={id:item.id,revision:item.draft?.revision??null,title:item.draft?.title||'',analysis:item.draft?.analysis||'',prefilled,changed:new Set(),
  ...Object.fromEntries(Object.entries(prefilled).map(([key,price])=>[key,String(price)]))};
 render();
 document.querySelector('.setup-editor input')?.focus();
}
function closeEditor(id){
 editing=null;render();
 document.getElementById('edit-'+id)?.focus();
}
function formField(form,key,label,options={}){
 const wrapper=el('label',label);
 const input=el(options.multiline?'textarea':'input');input.name=key;input.value=editing[key];input.disabled=busy;
 authored(input);
 if(options.limit)input.maxLength=options.limit;
 if(options.price){input.dir='ltr';input.inputMode='decimal';input.required=true;input.setAttribute('aria-describedby','setup-price-format');}
 input.addEventListener('input',()=>{if(editing){editing[key]=input.value;if(options.price)editing.changed.add(key)}});
 wrapper.append(input);form.append(wrapper);
}
function editor(item){
 const form=el('form','','setup-editor');form.setAttribute('aria-label','עריכת טיוטת סטאפ');
 const fields=el('div','','setup-editor-levels');
 formField(form,'title','כותרת (לא חובה)',{limit:80});
 formField(form,'analysis','ניתוח (לא חובה)',{multiline:true,limit:400});
 for(const [key,label] of Object.entries(names))formField(fields,key,label,{price:true});
 const priceFormat=el('p',PRICE_FORMAT,'meta');priceFormat.id='setup-price-format';form.append(fields,priceFormat);
 const actions=el('div','','actions');
 const save=el('button','שמור טיוטה');save.type='submit';save.disabled=busy;
 actions.append(save,action('בטל עריכה',()=>closeEditor(item.id)));form.append(actions);
 form.onsubmit=event=>{
  event.preventDefault();if(busy||editing?.id!==item.id)return;
  const {id,revision,title,analysis}=editing;
  const edits={title,analysis};
  for(const key of Object.keys(names)){
   // Unchanged numbers came from the trusted candidate response. Preserve them
   // exactly even when their display is ambiguous or uses scientific notation.
   const price=editing.changed.has(key)?parseSetupPrice(editing[key]):editing.prefilled[key];
   if(price==null){reportError(PRICE_FORMAT);return}
   edits[key]=price;
  }
  void perform(async()=>{await post({action:'save-draft',id,revision,edits});editing=null;await load();$('reviewFeedback').textContent='הטיוטה נשמרה. היא לא תפורסם עד שתאשר.';document.getElementById('edit-'+id)?.focus()});
 };
 return form;
}
function card(item,review){
 const node=el('article','','card');
 const draft=review?item.draft:null;
 const title=draft?.title||item.title,analysis=draft?.analysis||item.analysis;
 node.append(authored(el('h3',item.symbol,'symbol')),el('p',item.pattern+' · '+(item.scenario.side==='long'?'לונג':'שורט')));
 if(title)node.append(authored(el('h4',title,'setup-annotation')));
 if(analysis)node.append(authored(el('p',analysis,'setup-annotation')));
 if(item.edited)node.append(el('p','רמות או ניסוח נערכו לפני הפרסום.','meta'));
 node.append(levelsFor(draft?{...item.scenario,...draft}:item.scenario),el('p','נר אחרון: '+candleDate(item.candleDate)+' · סריקה: '+date(item.scanAt),'meta'));
 if(item.approvedAt)node.append(el('p','אושר לפרסום: '+date(item.approvedAt),'meta'));
 if(!review)return node;
 const isEditing=editing?.id===item.id;
 node.append(el('p',({pending:'ממתין לאישור',approved:'אושר לפרסום',rejected:'לא לפרסום'})[item.status]));
 if(draft||isEditing||item.originalScenario){
  const original=el('details','','setup-original');
  original.append(el('summary','הרמות המקוריות מהסורק'),levelsFor(item.originalScenario||item.scenario));node.append(original);
 }
 if(draft&&item.status==='pending')node.append(el('p','טיוטה שמורה, עדיין לא פורסמה.','meta'));
 if(isEditing)node.append(editor(item));
 const actions=el('div','','actions');
 if(item.status==='pending'&&!isEditing){
  const edit=action('ערוך טיוטה',()=>openEditor(item),{disabled:data.stale||!!editing});edit.id='edit-'+item.id;actions.append(edit);
 }
 for(const [decision,label] of [['approved','אשר לפרסום'],['rejected','לא לפרסם']]){
  const button=action(label,()=>decide(item,decision),{className:decision==='approved'?'approve':'',disabled:isEditing||item.status===decision||(decision==='approved'&&data.stale)});actions.append(button);
 }
 node.append(actions);return node;
}
function render(){
 const queue=(data.queue||[]).filter(x=>$('filter').value==='all'||x.status===$('filter').value);
 for(const [id,items,review] of [['published',data.published.map(x=>({...x,status:'approved'})),data.reviewer],['queue',queue,true]]){
  const host=$(id);host.replaceChildren();
  for(const item of items)host.append(card(item,review));
  if(!items.length)host.append(el('p',id==='queue'?'אין מועמדים במצב שנבחר.':'עדיין אין סטאפים מאושרים להצגה.','empty'));
 }
 $('review').hidden=!data.reviewer;$('count').textContent=data.published.length.toLocaleString(locale())+' סטאפים';
}
function renderStatus(){$('status').textContent='סריקה אחרונה: '+date(data.completedAt)+' · הבאה: '+date(data.nextUpdateAt)+(data.stale?' · העדכון מתעכב':'')+(data.partial?' · חלק מהנתונים אינם זמינים':'')}
async function jsonRequest(body){
 const response=await fetch('/.netlify/functions/setups',{cache:'no-store',signal:AbortSignal.timeout(15000),
  ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok){const error=Error(result.error||'הטעינה נכשלה');error.status=response.status;throw error;}
 return result;
}
const post=body=>jsonRequest(body);
async function load(){
 const result=await jsonRequest();data=result;
 if(editing){
  const item=data.reviewer&&!data.stale&&data.queue?.find(item=>item.id===editing.id&&item.status==='pending');
  if(!item||(item.draft?.revision??null)!==editing.revision)editing=null;
 }
 render();renderStatus();
}
function reportError(message){
 $('reviewFeedback').textContent=message;$('reviewFeedback').classList.add('error');
}
async function perform(work,{reload=false}={}){
 if(busy)return;busy=true;$('refresh').disabled=true;$('filter').disabled=true;
 $('reviewFeedback').textContent='';$('reviewFeedback').classList.remove('error');
 if(data)render();
 try{await work();$('status').classList.remove('error')}
 catch(e){
  if(reload||!data||[401,403].includes(e.status)){
   data=null;editing=null;$('status').textContent=e.message;$('status').classList.add('error');
   $('published').replaceChildren();$('queue').replaceChildren();$('review').hidden=true;$('count').textContent='';
  }else reportError(e.message);
 }finally{busy=false;$('refresh').disabled=false;$('filter').disabled=false;if(data)render()}
}
async function decide(item,decision){
 await perform(async()=>{await post({id:item.id,decision,revision:item.draft?.revision??null});await load()});
}
$('filter').onchange=()=>{if(data){editing=null;render()}};
$('refresh').onclick=()=>perform(load,{reload:true});
window.addEventListener('pageshow',()=>perform(load,{reload:true}));
window.addEventListener('asaf:language',()=>{if(data&&!busy&&!$('status').classList.contains('error')){render();renderStatus()}});
