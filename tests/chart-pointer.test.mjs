import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../local-chart.mjs',import.meta.url),'utf8');
const handlersSource=source.slice(source.indexOf(" canvas.addEventListener('pointerdown'"),source.indexOf(" canvas.addEventListener('wheel'"));
function setup({drawing=false}={}){
 const handlers={},captured=[],nodes=new Map();let draws=0;
 const context={bars:Array.from({length:100},()=>({})),geometry:{count:60,step:10},offset:10,drag:null,hover:null,drawing,firstPoint:null,lines:[],
 canvas:{focus(){},setPointerCapture(id){captured.push(id)},addEventListener(name,handler){handlers[name]=handler}},
 $:id=>{if(!nodes.has(id))nodes.set(id,{value:id==='chartDrawingTool'?'trend':'',setAttribute(){}});return nodes.get(id)},
 position:e=>({inPrice:true,index:e.clientX/10,price:100,tool:'trend'}),draw(){draws++},recordDrawingChange(){},saveDrawings(){}};
 vm.createContext(context);vm.runInContext(handlersSource,context);
 const send=(type,values={})=>handlers[type]({pointerId:1,isPrimary:true,button:0,clientX:50,...values});
 return {context,send,captured,draws:()=>draws};
}
test('dragging right moves the window into history; left follows the pointer and clamps',()=>{
 const s=setup();s.send('pointerdown');s.send('pointermove',{clientX:60});assert.equal(s.context.offset,11);
 s.send('pointermove',{clientX:40});assert.equal(s.context.offset,9);
 s.send('pointermove',{clientX:1000});assert.equal(s.context.offset,40);
 s.send('pointermove',{clientX:-1000});assert.equal(s.context.offset,0);
});
test('second finger cannot replace the drag anchor, move it or release it',()=>{
 const s=setup();s.send('pointerdown');s.send('pointerdown',{pointerId:2,isPrimary:false,clientX:200});
 s.send('pointermove',{pointerId:2,isPrimary:false,clientX:300});assert.equal(s.context.offset,10);
 s.send('pointerup',{pointerId:2,isPrimary:false});s.send('pointermove',{clientX:70});assert.equal(s.context.offset,12);
 assert.deepEqual(s.captured,[1]);s.send('pointerup');assert.equal(s.context.drag,null);
});
test('non-owning primary pointer cannot move or cancel an active drag',()=>{
 const s=setup();s.send('pointerdown');s.send('pointermove',{pointerId:2,clientX:300});s.send('pointercancel',{pointerId:2});
 assert.equal(s.context.offset,10);assert.equal(s.context.drag.pointerId,1);
 s.send('pointercancel');assert.equal(s.context.drag,null);
});
test('lost capture releases only owning pointer and a new gesture can start',()=>{
 const s=setup();s.send('pointerdown');s.send('lostpointercapture',{pointerId:2});assert.ok(s.context.drag);
 s.send('lostpointercapture');assert.equal(s.context.drag,null);
 s.send('pointerdown',{pointerId:3,clientX:100});s.send('pointermove',{pointerId:3,clientX:110});assert.equal(s.context.offset,11);
});
test('drawing ignores secondary touch and still completes with primary clicks',()=>{
 const s=setup({drawing:true});s.send('pointerdown',{isPrimary:false,pointerId:2});assert.equal(s.context.firstPoint,null);
 s.send('pointerdown');assert.ok(s.context.firstPoint);assert.equal(s.context.drag,null);
 s.send('pointerdown',{clientX:70});assert.equal(s.context.lines.length,1);assert.equal(s.context.drawing,false);
});
test('non-left mouse button does not begin a drag or draw',()=>{
 const s=setup({drawing:true});s.send('pointerdown',{button:2});assert.equal(s.context.firstPoint,null);assert.equal(s.context.drag,null);
});
