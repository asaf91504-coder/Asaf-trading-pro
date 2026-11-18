import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../venture-scanner-ui.mjs',import.meta.url),'utf8');
const scanCode=source.slice(source.indexOf('async function scan('),source.indexOf(" $('scanProvider').onclick"));
function fixture(fetch){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,hidden:true,checked:true,textContent:''});return nodes.get(id)};
 const timeouts=[],timers=[];
 const context={busy:false,revision:0,controller:null,lastFilters:'',dirty:true,records:new Map(),filters:()=>({}),render(){},$,
 update:{disabled:false},AbortController,DOMException,JSON,Date,
 AbortSignal:{any:AbortSignal.any.bind(AbortSignal),timeout:ms=>{timeouts.push(ms);const c=new AbortController();timers.push(c);return c.signal}},fetch};
 vm.createContext(context);vm.runInContext(scanCode,context);
 return {context,$,timeouts,timers};
}
function assertIdle(f){assert.equal(f.context.busy,false);assert.equal(f.context.controller,null);assert.equal(f.context.update.disabled,false);for(const id of ['scanProvider','scanDiscover'])assert.equal(f.$(id).disabled,false);assert.equal(f.$('scanDiscoverStop').hidden,true)}
test('hung discovery request is aborted after configured timeout and retry is enabled',async()=>{
 let attempts=0;
 const f=fixture(async(url,options)=>{
  attempts++;
  if(attempts===1)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
  return {ok:false,json:async()=>({})};
 });
 const pending=f.context.scan({discover:true});
 assert.deepEqual(f.timeouts,[15000]);assert.equal(f.context.busy,true);assert.equal(f.context.update.disabled,true);
 f.timers[0].abort(new DOMException('Discovery request timed out','TimeoutError'));await pending;
 assertIdle(f);assert.equal(f.$('scanDiscoverStatus').textContent,'Discovery request timed out');
 await f.context.scan({discover:true});assert.equal(attempts,2);assertIdle(f);
});
test('discovery network and malformed JSON failures release all controls',async()=>{
 for(const fetch of [async()=>{throw Error('Offline')},async()=>({ok:true,json:async()=>{throw SyntaxError('Invalid JSON')}})]){
  const f=fixture(fetch);await f.context.scan({discover:true});assertIdle(f);assert.ok(f.$('scanDiscoverStatus').textContent);
 }
});
test('manual cancellation still reaches discovery request alongside timeout',async()=>{
 const f=fixture(async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})));
 const pending=f.context.scan({discover:true});f.context.controller.abort();await pending;assertIdle(f);assert.equal(f.$('scanDiscoverStatus').textContent,'הסריקה נעצרה.');
});
