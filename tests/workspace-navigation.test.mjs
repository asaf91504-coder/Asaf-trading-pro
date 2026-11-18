import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {nextTabIndex} from '../workspace-navigation.mjs';
test('tab arrows follow visual order in all ten interface languages',()=>{
 for(const [lang,dir] of Object.entries({he:'rtl',ar:'rtl',en:'ltr',es:'ltr',fr:'ltr',de:'ltr',pt:'ltr',ru:'ltr',zh:'ltr',ja:'ltr'})){
  assert.equal(nextTabIndex(2,7,'ArrowRight',dir),dir==='rtl'?1:3,lang);
  assert.equal(nextTabIndex(2,7,'ArrowLeft',dir),dir==='rtl'?3:1,lang);
 }
});
test('tab navigation wraps at both ends and supports Home/End',()=>{
 for(const dir of ['ltr','rtl']){
  assert.equal(nextTabIndex(0,7,dir==='rtl'?'ArrowRight':'ArrowLeft',dir),6);
  assert.equal(nextTabIndex(6,7,dir==='rtl'?'ArrowLeft':'ArrowRight',dir),0);
  assert.equal(nextTabIndex(3,7,'Home',dir),0);
  assert.equal(nextTabIndex(3,7,'End',dir),6);
  assert.equal(nextTabIndex(0,1,'ArrowLeft',dir),0);
 }
});
test('invalid tab indexes and unrelated keys do not consume navigation',()=>{
 for(const args of [[0,0,'ArrowRight'],[-1,7,'Home'],[7,7,'Home'],[1.5,7,'End'],[0,NaN,'End'],[0,7,'Tab'],[0,7,'ArrowDown'],[0,7,'Escape']])assert.equal(nextTabIndex(...args),null);
});
test('actual workspace handler reads current direction and preserves browser modifier shortcuts',()=>{
 const source=readFileSync(new URL('../research-workspace.mjs',import.meta.url),'utf8');
 const handler=source.match(/b\.addEventListener\('keydown',e=>\{([^]*?)\}\)\}tabState/)[1];
 const calls=[];const document={documentElement:{dir:'ltr'}};
 const tabs=Array.from({length:7},(_,i)=>({click:()=>calls.push(['click',i]),focus:()=>calls.push(['focus',i])}));
 const run=vm.runInNewContext('(e)=>{'+handler+'}',{index:2,tabs,nextTabIndex,document});
 const event=key=>({key,preventDefault:()=>calls.push(['prevent'])});
 run(event('ArrowRight'));assert.deepEqual(calls,[['prevent'],['click',3],['focus',3]]);
 calls.length=0;document.documentElement.dir='rtl';run(event('ArrowRight'));assert.deepEqual(calls,[['prevent'],['click',1],['focus',1]]);
 for(const modifier of ['altKey','ctrlKey','metaKey']){calls.length=0;run({...event('ArrowLeft'),[modifier]:true});assert.deepEqual(calls,[])}
 calls.length=0;run(event('Tab'));assert.deepEqual(calls,[]);
});

test('help shortcut reveals all closed ancestor disclosures and focuses visible summary',async()=>{
 const {toggleKeyboardHelp}=await import('../workspace-navigation.mjs');
 const outer={open:false,parentElement:{closest:()=>null}},inner={open:false,parentElement:{closest:()=>outer}};
 let focus=0,scroll=0;
 const help={open:false,parentElement:{closest:()=>inner},querySelector:()=>({focus:()=>focus++}),scrollIntoView:()=>scroll++};
 toggleKeyboardHelp(help);assert.equal(help.open,true);assert.equal(inner.open,true);assert.equal(outer.open,true);assert.equal(focus,1);assert.equal(scroll,1);
 toggleKeyboardHelp(help);assert.equal(help.open,false);assert.equal(focus,2);assert.equal(scroll,1);
 toggleKeyboardHelp(null);
});
test('global help shortcut suppresses typed question mark and invokes reveal helper',()=>{
 const source=readFileSync(new URL('../workspace-tools.mjs',import.meta.url),'utf8');
 assert.match(source,/else if\(e.key==='\?'\)\{e.preventDefault\(\);toggleKeyboardHelp\(\$\('keyboardHelp'\)\)\}/);
});
