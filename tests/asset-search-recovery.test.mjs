import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {searchAssets} from '../asset-search.mjs';
const source=readFileSync(new URL('../asset-search-ui.mjs',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('trigger.onclick=async()=>'),source.indexOf(";dialog.addEventListener('close'"));
function fixture(){
 const rendered=[],context={trigger:{},dialog:{open:false,showModal(){this.open=true}},input:{focus(){}},status:{textContent:''},availableSymbols:['APLE'],availabilityAttempt:0,AbortSignal,
 render(){rendered.push(searchAssets('Apple','stock',context.availableSymbols).map(a=>a.symbol));context.status.textContent='Catalogue results'},reset(){context.render()},fetch:async()=>{throw Error('Offline')}};
 vm.createContext(context);vm.runInContext(handler,context);return {context,rendered};
}
test('availability failure rerenders stale filtered results then retains warning',async()=>{
 const f=fixture();await f.context.trigger.onclick();
 assert.deepEqual(f.rendered,[['APLE'],['NASDAQ:AAPL','APLE','MLP']]);assert.equal(f.context.availableSymbols,null);
 assert.equal(f.context.status.textContent,'לא ניתן לבדוק זמינות כרגע. אפשר להזין סימול ולנסות לטעון.');
});
test('a dismissed dialog is not rerendered or given a stale warning',async()=>{
 const f=fixture();f.context.fetch=async()=>{f.context.dialog.open=false;throw Error('Offline')};await f.context.trigger.onclick();
 assert.equal(f.rendered.length,1);assert.equal(f.context.status.textContent,'Catalogue results');
});
test('next successful check restores server availability filtering',async()=>{
 const f=fixture();await f.context.trigger.onclick();f.context.fetch=async()=>({ok:true,json:async()=>({enabled:true,symbols:['APLE']})});await f.context.trigger.onclick();
 assert.deepEqual(f.rendered.at(-1),['APLE']);assert.equal(f.context.status.textContent,'Catalogue results');
});
