import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scanner-simple-ui.mjs',import.meta.url),'utf8');
function fixture(){
 const headers=[{textContent:'מניה'},{textContent:'מחיר'}];let writes=0;const makeCell=colSpan=>({colSpan,dataset:new Proxy({},{set:(obj,key,v)=>{writes++;obj[key]=v;return true}})});
 const cells=[makeCell(1),makeCell(1)],empty=makeCell(2),rows=[{cells},{cells:[empty]}];
 const definition=source.match(/function labelCells\(\)\{[^]*?\}\}\n/)[0];
 const label=vm.runInNewContext(definition+';labelCells',{table:{querySelectorAll:()=>headers},$:()=>({rows})});
 return {headers,cells,empty,label,writes:()=>writes};
}
test('mobile scanner labels follow translated headers instead of original Hebrew',()=>{
 const f=fixture();f.label();assert.deepEqual(f.cells.map(c=>c.dataset.label),['מניה','מחיר']);
 for(const headings of [['Stock','Price'],['Action','Prix'],['Aktie','Preis'],['السهم','السعر'],['股票','价格'],['銘柄','価格']]){
  f.headers.forEach((h,i)=>h.textContent=headings[i]);f.label();assert.deepEqual(f.cells.map(c=>c.dataset.label),headings);
 }
 assert.equal(f.empty.dataset.label,undefined);
});
test('repeated labeling does not create redundant DOM mutations',()=>{
 const f=fixture();f.label();assert.equal(f.writes(),2);f.label();assert.equal(f.writes(),2);
 f.headers[1].textContent='Price';f.label();assert.equal(f.writes(),3);
});
test('language switches and newly rendered rows refresh mobile labels',()=>{
 assert.match(source,/window.addEventListener\('asaf:language',labelCells\)/);
 assert.match(source,/new MutationObserver\(labelCells\).observe\(\$\('scanRows'\),\{childList:true,subtree:true\}\)/);
});
