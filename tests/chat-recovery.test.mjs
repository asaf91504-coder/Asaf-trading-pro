import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseChartCommand} from '../chat-chart-actions.mjs';
const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const askSource=source.slice(source.indexOf('async function ask('),source.indexOf("$('clearConversation')"));
function setup({draft='',unavailable=false,cancelDuringAuth=false}={}){
 const nodes=new Map(),bubbles=[];let calls=0;const payloads=[];
 const element=()=>({value:'',textContent:'',disabled:false,style:{},children:[],append(v){this.children.push(v)},addEventListener(type,fn){this[type]=fn},dispatchEvent(){},focus(){this.focused=true}});
 const message=element();message.value=draft;const button=element();
 const ctx={chartRevision:0,parseChartCommand:()=>({recognized:false,actions:[]}),message,chatBusy:false,conversationEpoch:0,conversation:[],pendingImage:null,requestController:null,authState:{enabled:true,authenticated:true,checkAvailable:!unavailable},form:{querySelector:()=>button},$:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},say:(role,content)=>{const el=element();el.textContent=content;bubbles.push(el);return el},document:{createElement:element},window:{confirm:()=>true},setTimeout,clearTimeout,AbortController,DOMException,Event,sessionStorage:{removeItem(){},getItem(){return ''}},freeAiAccessKey:'test',refreshAuth:async()=>{if(cancelDuringAuth)ctx.requestController.abort()},currentContext:()=>null,loaded:null,normSymbol:()=> 'AAPL',chartAttachment:()=>null,recentAIBars:()=>[],localChart:{},fetch:async(url,options)=>{calls++;payloads.push(JSON.parse(options.body));throw Error('network failed')},imageInput:null,imageStatus:null,setAiStatus(){}};
 vm.createContext(ctx);vm.runInContext(askSource,ctx);return {ctx,message,bubbles,button,payloads,calls:()=>calls};
}
test('failed request restores draft without an automatic retry',async()=>{
 const s=setup();await s.ctx.ask('my question');assert.equal(s.message.value,'my question');assert.equal(s.calls(),1);assert.equal(s.button.disabled,false);assert.match(s.bubbles[1].children[0].textContent,/בבחירה הנוכחית/);
});
test('failure preserves a newer draft and offers explicit edit recovery',async()=>{
 const s=setup({draft:'new draft'});await s.ctx.ask('old question');assert.equal(s.message.value,'new draft');const edit=s.bubbles[1].children[1];edit.click();assert.equal(s.message.value,'old question');assert.equal(s.calls(),1);
});
test('cancellation during auth restores draft and completes pending bubble',async()=>{
 const s=setup({cancelDuringAuth:true});await s.ctx.ask('cancel me');assert.equal(s.message.value,'cancel me');assert.match(s.bubbles[1].textContent,/בוטלה/);assert.equal(s.calls(),0);assert.equal(s.ctx.chatBusy,false);
});
test('unavailable auth fails closed but retains prompt',async()=>{
 const s=setup({unavailable:true});await s.ctx.ask('keep me');assert.equal(s.calls(),0);assert.equal(s.message.value,'keep me');assert.match(s.bubbles[1].textContent,/לא ניתן לבדוק/);
});

test('explicit retry preserves original request including symbol and headline',async()=>{
 const s=setup();await s.ctx.ask('headline question',{newsArticleId:'chosen'});assert.equal(s.calls(),1);s.ctx.normSymbol=()=> 'MSFT';const retry=s.bubbles[1].children[2];retry.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.calls(),2);assert.deepEqual(s.payloads[1],s.payloads[0]);assert.equal(s.payloads[1].symbol,'AAPL');assert.equal(s.payloads[1].newsArticleId,'chosen');
});
test('explicit local chart control reports execution and does not spend an AI request',async()=>{
 const s=setup();s.ctx.parseChartCommand=parseChartCommand;let received;
 s.ctx.runChatActions=async actions=>{received=actions;return {changed:true,messages:['הופעל MA20.']}};
 await s.ctx.ask('הוסף ממוצע 20');assert.equal(s.calls(),0);assert.equal(received[0].indicator,'MA20');assert.match(s.bubbles[1].textContent,/הופעל MA20/);assert.equal(s.ctx.chatBusy,false);
});
test('stock selection with an analysis request continues to the model using resulting chart',async()=>{
 const s=setup();s.ctx.parseChartCommand=parseChartCommand;s.ctx.runChatActions=async()=>({changed:true,messages:['נבחרה AAPL.']});s.ctx.currentContext=()=>({date:'2026-10-28'});s.ctx.loaded={symbol:'AAPL',source:'Twelve Data',bars:[],interval:'1day'};s.ctx.localChart.settings=()=>({style:'candles',indicators:['MA20']});let payload;
 s.ctx.fetch=async(_,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'ניתוח אמיתי מהמודל'})}};
 await s.ctx.ask('תנתח AAPL');assert.equal(payload.symbol,'AAPL');assert.equal(payload.chartControl,false);assert.match(s.bubbles[1].textContent,/נבחרה AAPL/);assert.match(s.bubbles[1].textContent,/ניתוח אמיתי/);
});
test('same-symbol dataset replacement prevents stale model actions from executing',async()=>{
 const s=setup();let executions=0;s.ctx.runChatActions=async()=>{executions++;return {messages:['changed']}};
 s.ctx.fetch=async()=>{s.ctx.chartRevision++;return {ok:true,json:async()=>({answer:'תכנון',actions:[{type:'indicator',indicator:'MA20',enabled:true}]})}};
 await s.ctx.ask('question');assert.equal(executions,0);assert.match(s.bubbles[1].textContent,/נתוני הגרף השתנו/);
});
