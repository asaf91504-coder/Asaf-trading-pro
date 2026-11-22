import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {languageCode,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('setups-ui.mjs').replace(/^import .*\n/,'');
const candidate={id:'a'.repeat(64),symbol:'AAPL',status:'pending',pattern:'Generated',scenario:{side:'long',entry:110,stop:100,target:130}};
const rev='12345678-1234-1234-1234-123456789abc';
const next={...candidate,draft:{revision:rev,title:'Review <script>',analysis:'Author',entry:111,stop:100,target:130}};
function harness(lang='he'){
 const elements=new Map(),events={},post=[],queue=[];
 function node(tag){
  const attrs={},listeners={},children=[];
  return {tag,attrs,listeners,children,value:'',classList:{add(){},remove(){},contains(){return false}},
   setAttribute(k,v){attrs[k]=v},append(...n){children.push(...n)},replaceChildren(...n){children.splice(0,children.length,...n)},
   addEventListener(k,v){listeners[k]=v},focus(){this.focused=true}};
 }
 const document={documentElement:{lang},createElement:node,getElementById:id=>{
  if(!elements.has(id)){const n=node('element');if(id==='filter')n.value='pending';elements.set(id,n);}
  return elements.get(id);
 },querySelector:()=>null};
 const fetch=async(_path,opts)=>{
  if(opts?.body)post.push(JSON.parse(opts.body));const body=queue.shift();assert.ok(body,'Unexpected network request');
  return {ok:true,json:async()=>body};
 };
 vm.runInNewContext(source,{document,window:{addEventListener:(e,fn)=>events[e]=fn},fetch,AbortSignal,languageCode,Date,Number,Promise});
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

test('setup stop cards use up to two locale decimals without rounding the editor or other prices',async()=>{
 for(const [lang,decimal] of [['en','.'],['de',',']]){
  const h=harness(lang);
  const levels={side:'long',entry:110.12547,stop:100.23567,target:130.76543};
  const item={...candidate,scenario:levels};
  const whole={...item,scenario:{...levels,stop:100}};
  const tiny={...item,scenario:{...levels,stop:0.001}};
  h.queue.push(state([item],[item,whole,tiny]));
  await h.events.pageshow();
  const values=h.all(h.get('published')).filter(n=>n.tag==='dd').map(n=>n.textContent);
  assert.deepEqual(values.slice(0,3),['110'+decimal+'12547','100'+decimal+'24','130'+decimal+'76543']);
  assert.equal(values[4],'100');
  assert.equal(values[7],'<0'+decimal+'01');
  h.all(h.get('queue')).find(n=>n.textContent==='ערוך טיוטה').onclick();
  assert.equal(h.all(h.get('queue')).find(n=>n.name==='stop').value,'100.23567');
  assert.equal(item.scenario.stop,100.23567);
 }
});
