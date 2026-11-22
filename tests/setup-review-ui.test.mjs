import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {languageCode,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {parseSetupPrice} from '../setup-price-input.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('setups-ui.mjs').replace(/^import .*\n/gm,'');
const candidate={id:'a'.repeat(64),symbol:'AAPL',status:'pending',pattern:'Generated',scenario:{side:'long',entry:110,stop:100,target:130}};
const rev='12345678-1234-1234-1234-123456789abc';
const next={...candidate,draft:{revision:rev,title:'Review <script>',analysis:'Author',entry:111,stop:100,target:130}};
function harness(locale='he'){
 const elements=new Map(),events={},post=[],queue=[];
 function node(tag){
  const attrs={},listeners={},children=[];
  return {tag,attrs,listeners,children,value:'',classList:{add(){},remove(){},contains(){return false}},
   setAttribute(k,v){attrs[k]=v},append(...n){children.push(...n)},replaceChildren(...n){children.splice(0,children.length,...n)},
   addEventListener(k,v){listeners[k]=v},focus(){this.focused=true}};
 }
 const document={documentElement:{lang:locale},createElement:node,getElementById:id=>{
  if(!elements.has(id)){const n=node('element');if(id==='filter')n.value='pending';elements.set(id,n);}
  return elements.get(id);
 },querySelector:()=>null};
 const fetch=async(_path,opts)=>{
  if(opts?.body)post.push(JSON.parse(opts.body));const body=queue.shift();assert.ok(body,'Unexpected network request');
  return {ok:true,json:async()=>body};
 };
 vm.runInNewContext(source,{document,window:{addEventListener:(e,fn)=>events[e]=fn},fetch,AbortSignal,languageCode,parseSetupPrice,Date,Number,Promise});
 return {get:document.getElementById,events,post,queue,all:function all(node){return [node,...node.children.flatMap(all)]}};
}
const state=(queue,published=[])=>({reviewer:true,published,queue,completedAt:'2026-11-20T12:00:00Z'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('owner UI keeps Save draft separate from Approve, preserves typed text as text and uses the revision',async()=>{
 const h=harness();
 h.queue.push(state([candidate]));await h.events.pageshow();
 const find=(text)=>h.all(h.get('queue')).find(node=>node.textContent===text);
 find('ערוך טיוטה').onclick();
 assert.equal(find('אשר לפרסום').disabled,true);
 const form=h.all(h.get('queue')).find(node=>node.tag==='form'),fields=h.all(form).filter(node=>node.name);
 assert.equal(fields.length,5);
 for(const input of fields)assert.equal(input.attrs.translate,'no');
 for(const input of fields.filter(node=>['entry','stop','target'].includes(node.name)))assert.equal(input.inputMode,'decimal');
 const heading=fields.find(node=>node.name==='title'),entry=fields.find(node=>node.name==='entry');
 heading.value=next.draft.title;heading.listeners.input();
 entry.value='١١١٫٠';entry.listeners.input();
 h.queue.push({status:'pending',revision:rev},state([next]));
 form.onsubmit({preventDefault(){}});await tick();
 assert.equal(h.post.length,1);assert.equal(h.post[0].action,'save-draft');assert.equal(h.post[0].decision,undefined);
 assert.equal(h.post[0].edits.entry,111);
 assert.equal(find(next.draft.title).attrs.translate,'no');
 assert.equal(find('הרמות המקוריות מהסורק').tag,'summary');
 h.queue.push({status:'approved'},state([],[{...candidate,...next.draft,scenario:{...candidate.scenario,entry:111},edited:true}]));
 await find('אשר לפרסום').onclick();
 assert.deepEqual(h.post[1],{id:candidate.id,decision:'approved',revision:rev});
});
test('regular viewers cannot see the owner editor; labels and narrow mobile styling exist',async()=>{
 const h=harness();h.queue.push({reviewer:false,published:[candidate]});await h.events.pageshow();
 assert.equal(h.get('review').hidden,true);
 assert.equal(h.all(h.get('published')).some(node=>node.tag==='button'||node.tag==='form'),false);
 for(const locale of Object.keys(languageNames).filter(code=>code!=='he')){
  const strings=launchTranslations[locale];
  for(const key of ['ערוך טיוטה','שמור טיוטה','יעד יציאה','ניתוח (לא חובה)','הרמות המקוריות מהסורק','הטיוטה נשמרה. היא לא תפורסם עד שתאשר.'])assert.ok(strings[key],locale+' '+key);
 }
 const css=read('setups.css');
 assert.match(css,/@media\(max-width:540px\)\{\.setup-editor-levels\{grid-template-columns:1fr\}/);
 assert.match(css,/\.setup-editor input,\.setup-editor textarea\{[^}]*min-height:44px[^}]*font-size:max\(16px,1em\)/);
});

test('rejects grouped, ambiguous and incomplete clipboard numbers without reinterpretation',()=>{
 for(const value of ['1,234','1.234','12,345','12.345','123,456','123.456','1,175','1,340','12.345,67',
  '12,345.67','1 234','1\u202f234','1\u00a0234','١٬٢٣٤','1’234','1.2.3','001.234','01,234','1,','0','-1','1e-9','$1.12','Infinity','1000000000001']){
  assert.equal(parseSetupPrice(value),null,value);
 }
 for(const [input,price] of [['1234.50',1234.5],['1234,50',1234.5],['١٢٣٤٫٥٠',1234.5],['۱۲۳۴٫۵۰',1234.5],['1234.567',1234.567],
  ['1.2340',1.234],['0.001',.001],['.001',.001],['0,001',.001],['1٫234',1.234],['1234',1234],[' 1234.50 ',1234.5]]){
  assert.equal(parseSetupPrice(input),price,input);
 }
});

test('three pasted thousand-style levels never produce a draft request in Hebrew, English, German, French and Arabic',async()=>{
 const item={...candidate,scenario:{entry:1234,stop:1175,target:1340,side:'long'}};
 for(const locale of ['he','en','de','fr','ar']){
  const h=harness(locale);h.queue.push(state([item]));await h.events.pageshow();
  const all=()=>h.all(h.get('queue')),format=new Intl.NumberFormat(locale==='ar'?'ar-EG':locale);
  all().find(n=>n.textContent==='ערוך טיוטה').onclick();
  const form=all().find(n=>n.tag==='form');
  for(const node of all().filter(n=>['entry','stop','target'].includes(n.name))){
   node.value=format.format(item.scenario[node.name]);node.listeners.input();
  }
  form.onsubmit({preventDefault(){}});await tick();
  assert.equal(h.post.length,0,locale);
  assert.match(h.get('reviewFeedback').textContent,/1234\.50/);
  assert.match(h.get('reviewFeedback').textContent,/1\.2340/);
 }
});

test('editing only wording preserves precise levels without parsing the untouched prefilled strings',async()=>{
 // The middle value would be ambiguous as new text; the low one uses exponent notation.
 const item={...candidate,scenario:{entry:1.234,stop:3.0000000000000004e-9,target:1.2345678901234567,side:'long'}};
 const h=harness('de');h.queue.push(state([item]));await h.events.pageshow();
 const all=()=>h.all(h.get('queue'));all().find(n=>n.textContent==='ערוך טיוטה').onclick();
 const title=all().find(n=>n.name==='title');title.value='Updated wording';title.listeners.input();
 const form=all().find(n=>n.tag==='form');
 const fields=all().filter(n=>['entry','stop','target'].includes(n.name));
 for(const field of fields){assert.equal(field.attrs['aria-describedby'],'setup-price-format');assert.equal(field.maxLength,undefined);}
 h.queue.push({status:'pending',revision:rev},state([item]));form.onsubmit({preventDefault(){}});await tick();
 assert.deepEqual(h.post[0].edits,{title:'Updated wording',analysis:'',entry:item.scenario.entry,stop:item.scenario.stop,target:item.scenario.target});
});

test('a re-pasted ambiguous string is not treated as untouched just because it matches the prefill',async()=>{
 const item={...candidate,scenario:{entry:1.234,stop:.5,target:10,side:'long'}};
 const h=harness('en');h.queue.push(state([item]));await h.events.pageshow();
 const all=()=>h.all(h.get('queue'));all().find(n=>n.textContent==='ערוך טיוטה').onclick();
 const entry=all().find(n=>n.name==='entry');
 assert.equal(entry.value,'1.234');entry.listeners.input();
 const form=all().find(n=>n.tag==='form');form.onsubmit({preventDefault(){}});await tick();
 assert.equal(h.post.length,0);
 entry.value='1.2340';entry.listeners.input();
 h.queue.push({status:'pending',revision:rev},state([item]));form.onsubmit({preventDefault(){}});await tick();
 assert.equal(h.post[0].edits.entry,1.234);
});

test('all nine translated locales include both unambiguous price examples',()=>{
 const formatKey='הזן מחיר חיובי בלי מפריד אלפים, למשל 1234.50. אם התכוונת ל־1.234 כמספר עשרוני, הזן 1.2340.';
 for(const code of Object.keys(languageNames).filter(code=>code!=='he')){
  const message=launchTranslations[code][formatKey];
  assert.ok(message,code);assert.match(message,/1234\.50/);assert.match(message,/1\.2340/);
 }
});
