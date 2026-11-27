import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../workspace-tools.mjs',import.meta.url),'utf8');
const selectSource=source.slice(source.indexOf('function select('),source.indexOf('function render('));
function fixture(){
 const events=[],nodes={symbol:{value:'AAPL',dispatchEvent(event){events.push(event.type+':'+this.value)}},activeSymbol:{textContent:'AAPL'},loadChart:{click(){events.push('load:'+nodes.symbol.value)}}};
 const context={$:id=>nodes[id],Event,document:{querySelector:selector=>({click(){events.push(selector)}})},localStorage:{setItem(){throw Error('Navigation must not change research records')}}};
 vm.createContext(context);vm.runInContext(selectSource,context);return {context,nodes,events};
}
test('watchlist open graph selects the requested symbol then loads its data once',()=>{
 const f=fixture();f.context.select('NASDAQ:MSFT');
 assert.equal(f.nodes.symbol.value,'NASDAQ:MSFT');assert.equal(f.nodes.activeSymbol.textContent,'NASDAQ:MSFT');
 assert.deepEqual(f.events,['input:NASDAQ:MSFT','[data-tab="charts"]','load:NASDAQ:MSFT']);
});
test('watchlist ask-AI navigation selects the symbol without an unsolicited chart-data request',()=>{
 const f=fixture();f.context.select('NASDAQ:MSFT','chat');
 assert.deepEqual(f.events,['input:NASDAQ:MSFT','[data-tab="chat"]']);assert.equal(f.nodes.activeSymbol.textContent,'NASDAQ:MSFT');
});
