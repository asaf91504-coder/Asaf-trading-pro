import {languageCode} from './interface-language.mjs';
import {requestSetups,setupLoadingMessage} from './setup-loading.mjs';
const $=id=>document.getElementById(id);
const locale=()=>languageCode(document.documentElement.lang);
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
  const price=Number(scenario[key]);
  // Price formatting is display-only; the editor and submitted scenario retain precision.
  const display=price>0&&price<0.005
   ?'<'+(0.01).toLocaleString(locale(),{maximumFractionDigits:2})
   :price.toLocaleString(locale(),{maximumFractionDigits:2});
  cell.append(el('dt',label),el('dd',display));list.append(cell);
 }
 return list;
}
function action(label,onClick,options={}){
 const button=el('button',label,options.className);
 button.type='button';button.disabled=busy||!!options.disabled;button.onclick=onClick;return button;
}
function openEditor(item){
 editing={id:item.id,revision:item.draft?.revision??null,title:item.draft?.title||'',analysis:item.draft?.analysis||'',
  ...Object.fromEntries(Object.keys(names).map(key=>[key,String(item.draft?.[key]??item.scenario[key])]))};
 render();
 document.querySelector('.setup-editor input')?.focus();
}
function closeEditor(id){
 editing=null;render();
 document.getElementById('edit-'+id)?.focus();
}
function parseLevel(text){
 const value=text.trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)&15)).replace(/[,٫]/g,'.');
 const n=Number(value);
 return /^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)&&Number.isFinite(n)&&n>0?n:null;
}
function formField(form,key,label,options={}){
 const wrapper=el('label',label);
 const input=el(options.multiline?'textarea':'input');input.name=key;input.value=editing[key];input.disabled=busy;
 authored(input);
 if(options.limit)input.maxLength=options.limit;
 if(options.price){input.dir='ltr';input.inputMode='decimal';input.required=true;}
 input.addEventListener('input',()=>{if(editing)editing[key]=input.value;options.changed?.()});
 wrapper.append(input);form.append(wrapper);return input;
}
function editor(item){
 const form=el('form','','setup-editor');form.setAttribute('aria-label','עריכת טיוטת סטאפ');
 const fields=el('div','','setup-editor-levels');
 formField(form,'title','כותרת (לא חובה)',{limit:80});
 formField(form,'analysis','ניתוח (לא חובה)',{multiline:true,limit:400});
 let stopInput;
 const auto=Number.isFinite(item.atr14)&&item.atr14>0;
 const recalc=()=>{
  const entry=parseLevel(editing.entry);
  const stop=entry===null?null:entry+(item.scenario.side==='long'?-2:2)*item.atr14;
  editing.stop=stop!==null&&Number.isFinite(stop)&&stop>0?String(stop):'';
  stopInput.value=editing.stop;
 };
 for(const [key,label] of Object.entries(names)){
  const field=formField(fields,key,label,{price:true,limit:32,changed:key==='entry'&&auto?recalc:undefined});
  if(key==='stop'&&auto){stopInput=field;field.readOnly=true;}
 }
 form.append(fields);
 const actions=el('div','','actions');
 const save=el('button','שמור טיוטה');save.type='submit';save.disabled=busy;
 actions.append(save,action('בטל עריכה',()=>closeEditor(item.id)));form.append(actions);
 form.onsubmit=event=>{
  event.preventDefault();if(busy||editing?.id!==item.id)return;
  const {id,revision,title,analysis}=editing;
  const edits={title,analysis};
  for(const key of Object.keys(names)){
   const value=parseLevel(editing[key]);
   if(value===null){reportError('הזן רמות חיוביות תקינות.');return}
   if(!item.manual||key!=='stop')edits[key]=value;
  }
  void perform(async()=>{await post({action:item.manual?'edit-manual-draft':'save-draft',id,revision,edits});editing=null;await load();$('reviewFeedback').textContent='הטיוטה נשמרה. היא לא תפורסם עד שתאשר.';document.getElementById('edit-'+id)?.focus()});
 };
 return form;
}
function infoLine(item){
 const line=el('p');
 if(item.manual)line.append(el('span',item.pattern),el('span',' · '),el('span',item.scenario.side==='long'?'לונג':'שורט'));
 else line.textContent=item.pattern+' · '+(item.scenario.side==='long'?'לונג':'שורט');
 return line;
}
function card(item,review){
 const node=el('article','','card');
 const draft=review?item.draft:null;
 const title=draft?.title||item.title,analysis=draft?.analysis||item.analysis;
 node.append(authored(el('h3',item.symbol,'symbol')),infoLine(item));
 if(title)node.append(authored(el('h4',title,'setup-annotation')));
 if(analysis)node.append(authored(el('p',analysis,'setup-annotation')));
 if(item.edited)node.append(el('p','רמות או ניסוח נערכו לפני הפרסום.','meta'));
 node.append(levelsFor(draft?{...item.scenario,...draft}:item.scenario),el('p',item.manual?'נוצר: '+date(item.createdAt):'נר אחרון: '+candleDate(item.candleDate)+' · סריקה: '+date(item.scanAt),'meta'));
 if(item.approvedAt)node.append(el('p','אושר לפרסום: '+date(item.approvedAt),'meta'));
 if(!review)return node;
 const isEditing=editing?.id===item.id;
 node.append(el('p',({pending:'ממתין לאישור',approved:'אושר לפרסום',rejected:'לא לפרסום'})[item.status]));
 if(!item.manual&&(draft||isEditing||item.originalScenario)){
  const original=el('details','','setup-original');
  original.append(el('summary','הרמות המקוריות מהסורק'),levelsFor(item.originalScenario||item.scenario));node.append(original);
 }
 if(draft&&item.status==='pending')node.append(el('p','טיוטה שמורה, עדיין לא פורסמה.','meta'));
 if(isEditing)node.append(editor(item));
 const actions=el('div','','actions');
 if(item.status==='pending'&&!isEditing){
  const edit=action('ערוך טיוטה',()=>openEditor(item),{disabled:(!item.manual&&data.stale)||!!editing});edit.id='edit-'+item.id;actions.append(edit);
 }
 for(const [decision,label] of [['approved','אשר לפרסום'],['rejected','לא לפרסם']]){
  const button=action(label,()=>decide(item,decision),{className:decision==='approved'?'approve':'',disabled:isEditing||item.status===decision||(decision==='approved'&&(!item.manual&&data.stale||item.manual&&item.status!=='pending'))});actions.append(button);
 }
 node.append(actions);return node;
}
const allQueue=()=>[...(data.manualQueue||[]),...(data.queue||[])];
function render(){
 const queue=allQueue().filter(x=>$('filter').value==='all'||x.status===$('filter').value);
 for(const [id,items,review] of [['published',data.published.map(x=>x.manual&&data.canAuthor?(data.manualQueue||[]).find(y=>y.id===x.id)||{...x,status:'approved'}:{...x,status:'approved'}),data.reviewer],['queue',queue,true]]){
  const host=$(id);host.replaceChildren();
  for(const item of items)host.append(card(item,review&&(!item.manual||data.canAuthor===true)));
  if(!items.length)host.append(el('p',id==='queue'?'אין מועמדים במצב שנבחר.':'עדיין אין סטאפים מאושרים להצגה.','empty'));
 }
 $('review').hidden=!data.reviewer;$('manualSetup').hidden=data.canAuthor!==true;$('count').textContent=data.published.length.toLocaleString(locale())+' סטאפים';
}
function renderStatus(){$('status').textContent='סריקה אחרונה: '+date(data.updatedAt||data.completedAt)+' · הבאה: '+date(data.nextUpdateAt)+(data.stale?' · העדכון מתעכב':'')+(data.partial?' · חלק מהנתונים אינם זמינים':'')+(data.queueUnavailable?' · '+setupLoadingMessage('queue',locale()):'')}
const jsonRequest=body=>requestSetups(fetch,{body,language:locale()});
const post=body=>jsonRequest(body);
async function load(){
 if(!data)$('status').textContent=setupLoadingMessage('loading',locale());
 const result=await jsonRequest();data=result;
 if(editing){
  const item=data.reviewer&&allQueue().find(item=>item.id===editing.id&&item.status==='pending'&&(item.manual?data.canAuthor===true:!data.stale));
  if(!item||(item.draft?.revision??null)!==editing.revision)editing=null;
 }
 render();renderStatus();
}
function reportError(message){
 $('reviewFeedback').textContent=message;$('reviewFeedback').classList.add('error');
}
async function perform(work,{reload=false}={}){
 if(busy)return;busy=true;$('refresh').disabled=true;$('filter').disabled=true;for(const c of $('manualForm').elements)c.disabled=true;
 $('reviewFeedback').textContent='';$('reviewFeedback').classList.remove('error');
 if(data)render();
 try{await work();$('status').classList.remove('error')}
 catch(e){
  if(!data||[401,403].includes(e.status)){
   data=null;editing=null;$('status').textContent=e.message;$('status').classList.add('error');
   $('published').replaceChildren();$('queue').replaceChildren();$('review').hidden=true;$('manualSetup').hidden=true;$('count').textContent='';
  }else if(reload){
   const stamp=item=>Date.parse(item.manual?item.approvedAt:item.scanAt),now=Date.now();
   data={...data,stale:true,partial:true,queue:[],manualQueue:[],published:data.published.filter(item=>Number.isFinite(stamp(item))&&now-stamp(item)>=0&&now-stamp(item)<86400000)};editing=null;render();
   $('status').textContent=e.message+' '+setupLoadingMessage('previous',locale());$('status').classList.add('error');
  }else reportError(e.message);
 }finally{busy=false;$('refresh').disabled=false;$('filter').disabled=false;for(const c of $('manualForm').elements)c.disabled=false;if(data)render()}
}
async function decide(item,decision){
 await perform(async()=>{await post({...(item.manual?{action:'decide-manual'}:{}),id:item.id,decision,revision:item.draft?.revision??null});await load()});
}
const manualForm=$('manualForm');
const manualField=name=>manualForm.elements.namedItem(name);
function refreshManualStop(){
 const entry=parseLevel(manualField('entry').value),atr=parseLevel(manualField('atr14').value);
 const stop=entry===null||atr===null?null:entry+(manualField('side').value==='long'?-2:2)*atr;
 manualField('stop').value=stop!==null&&Number.isFinite(stop)&&stop>0&&stop!==entry?String(stop):'';
}
manualForm.addEventListener('input',refreshManualStop);
manualForm.addEventListener('change',refreshManualStop);
manualForm.onsubmit=event=>{
 event.preventDefault();if(busy||data?.canAuthor!==true)return;
 const idea={symbol:manualField('symbol').value,side:manualField('side').value,atr14:parseLevel(manualField('atr14').value),
  entry:parseLevel(manualField('entry').value),target:parseLevel(manualField('target').value),title:manualField('title').value,
  analysis:manualField('analysis').value,ownAnalysis:manualField('ownAnalysis').checked};
 if(!idea.atr14||!idea.entry||!idea.target||!manualField('stop').value){reportError('הזן רמות חיוביות תקינות.');return;}
 void perform(async()=>{
  await post({action:'create-manual-draft',idea});manualForm.reset();refreshManualStop();$('filter').value='pending';
  await load();$('reviewFeedback').textContent='הטיוטה נשמרה. היא לא תפורסם עד שתאשר.';
 });
};
$('filter').onchange=()=>{if(data){editing=null;render()}};
$('refresh').onclick=()=>perform(load,{reload:true});
window.addEventListener('pageshow',()=>perform(load,{reload:true}));
window.addEventListener('asaf:language',()=>{if(data&&!busy&&!$('status').classList.contains('error')){render();renderStatus()}});
