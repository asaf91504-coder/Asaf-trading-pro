import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function selectionHandler(file,read,value){
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const code=source.match(/select.onchange=\(\)=>\{[^]*?\};(?=\n)/)[0];
 const state={select:{value},name:{value:'Unsaved draft'},load:{disabled:false},remove:{disabled:false},status:{textContent:''},read};
 vm.runInNewContext(code,state);return state;
}
for(const file of ['layouts-ui.mjs','scanner-presets-ui.mjs']){
 test(file+' catches corrupted/blocked storage without destroying data or the draft',()=>{
  for(const error of [new SyntaxError('Invalid JSON'),new Error('Storage access denied'),new Error('Saved data is invalid')]){
   let calls=0;
   const state=selectionHandler(file,()=>{calls++;throw error},'saved:one');
   assert.doesNotThrow(()=>state.select.onchange());assert.equal(calls,1);
   assert.equal(state.status.textContent,error.message);assert.equal(state.name.value,'Unsaved draft');
   if(file==='layouts-ui.mjs'){assert.equal(state.load.disabled,true);assert.equal(state.remove.disabled,true)}
  }
 });
 test(file+' can recover on a later selection without reloading',()=>{
  let broken=true;
  const state=selectionHandler(file,()=>{if(broken)throw Error('Invalid data');return [{id:'one',name:'Working setup'}]},file==='layouts-ui.mjs'?'one':'saved:one');
  state.select.onchange();broken=false;state.select.onchange();
  assert.equal(state.name.value,'Working setup');assert.equal(state.status.textContent,'');
  if(file==='layouts-ui.mjs'){assert.equal(state.load.disabled,false);assert.equal(state.remove.disabled,false)}
 });
}
