import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseChartCommand} from '../chat-chart-actions.mjs';
import {isChatNearBottom} from '../chat-interaction.mjs';
import {recentAIBars} from '../chart-data.mjs';
const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
const askSource=source.slice(source.indexOf('async function ask('),source.indexOf("$('clearConversation')"));
function setup({draft='',unavailable=false,cancelDuringAuth=false}={}){
 const nodes=new Map(),bubbles=[];let calls=0;const payloads=[];
 const element=()=>({value:'',textContent:'',disabled:false,style:{},children:[],append(v){this.children.push(v)},addEventListener(type,fn){this[type]=fn},dispatchEvent(){},focus(){this.focused=true}});
 const message=element();message.value=draft;const button=element();
 const ctx={log:{scrollTop:0,scrollHeight:0},chartRevision:0,requestsChartControl:()=>false,parseChartCommand:()=>({recognized:false,actions:[]}),message,chatBusy:false,conversationEpoch:0,conversation:[],pendingImage:null,requestController:null,authState:{enabled:true,authenticated:true,checkAvailable:!unavailable},form:{querySelector:()=>button},$:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},say:(role,content)=>{const el=element();el.textContent=content;bubbles.push(el);return el},document:{createElement:element},window:{confirm:()=>true},setTimeout,clearTimeout,AbortController,DOMException,Event,sessionStorage:{removeItem(){},getItem(){return ''}},freeAiAccessKey:'test',refreshAuth:async()=>{if(cancelDuringAuth)ctx.requestController.abort()},currentContext:()=>null,loaded:null,normSymbol:()=> 'AAPL',chartAttachment:()=>null,recentAIBars:()=>[],localChart:{},fetch:async(url,options)=>{calls++;payloads.push(JSON.parse(options.body));throw Error('network failed')},imageInput:null,imageStatus:null,setAiStatus(){}};
 ctx.isChatNearBottom=isChatNearBottom;ctx.recentAIBars=recentAIBars;
 vm.createContext(ctx);vm.runInContext(askSource,ctx);return {ctx,message,bubbles,button,payloads,calls:()=>calls};
}

function mountLifecycle(s){
 const c=s.ctx,events=new Map();
 Object.assign(c,{requestInvalidated:null,lastVisibleChart:null,key:'candles',chartSymbol:c.$('symbol'),rememberSymbol(){},renderStatus(){},datasetReady(){}});
 c.chartSymbol.value='AAPL';c.$('marketInterval').value='1day';c.normSymbol=()=>c.chartSymbol.value;
 c.$('chart').replaceChildren=()=>{};c.localChart.clear=()=>{};c.localChart.setData=()=>{};
 c.log.replaceChildren=()=>{s.bubbles.length=0};
 c.window.addEventListener=(name,fn)=>events.set(name,fn);c.window.dispatchEvent=()=>{};
 vm.runInContext(source.slice(source.indexOf('function resetRequest('),source.indexOf("$('cancelChat')?.addEventListener")),c);
 vm.runInContext(source.slice(source.indexOf("window.addEventListener('asaf:logout'"),source.indexOf('function setAiStatus(')),c);
 vm.runInContext(source.slice(source.indexOf("$('clearConversation')"),source.indexOf("$('exportConversation')")),c);
 vm.runInContext(source.slice(source.indexOf('// A newly selected interval'),source.indexOf("document.querySelector('[data-tab=\"charts\"]').addEventListener")),c);
 return events;
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
test('local display commands work without sign-in but model requests remain protected',async()=>{
 const local=setup();local.ctx.authState.authenticated=false;local.ctx.parseChartCommand=parseChartCommand;local.ctx.runChatActions=async()=>({changed:true,messages:['הופעל MA20.']});await local.ctx.ask('הוסף MA20');assert.match(local.bubbles[1].textContent,/הופעל MA20/);assert.equal(local.calls(),0);
 const remote=setup();remote.ctx.authState.authenticated=false;await remote.ctx.ask('explain market');assert.equal(remote.calls(),0);assert.match(remote.bubbles[1].textContent,/להיכנס לחשבון/);
});

test('a late text analysis warns when the selected chart changes, even without tool actions',async()=>{
 const s=setup();s.ctx.fetch=async()=>{s.ctx.chartRevision++;return {ok:true,json:async()=>({answer:'analysis of original snapshot'})}};
 await s.ctx.ask('explain this chart');assert.match(s.bubbles[1].textContent,/הגרף השתנה/);assert.match(s.bubbles[1].textContent,/analysis of original snapshot/);
});

test('numeric chart analysis avoids an unnecessary vision request while an explicit screenshot is retained',async()=>{
 const s=setup();let options;
 s.ctx.chartAttachment=o=>{options=o;return null};s.ctx.$('chatAutoChart').checked=true;
 await s.ctx.ask('מה המגמה לפי הגרף?');assert.equal(options.auto,false);
 const visual=setup();visual.ctx.chartAttachment=o=>{options=o;return null};visual.ctx.$('chatAutoChart').checked=true;
 await visual.ctx.ask('מה רואים בתמונה?',{image:'data:image/png;base64,dGVzdA=='});assert.equal(options.auto,true);assert.equal(options.manual,'data:image/png;base64,dGVzdA==');
});

test('retry after unavailable auth rechecks login and keeps headline and a newer draft',async()=>{
 const s=setup({unavailable:true,draft:'new draft'});
 await s.ctx.ask('original question',{newsArticleId:'chosen'});
 assert.equal(s.calls(),0);
 const retry=s.bubbles[1].children[2];
 assert.match(retry.textContent,/בבחירה הנוכחית/);
 s.ctx.refreshAuth=async()=>{s.ctx.authState.checkAvailable=true};
 retry.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.calls(),1);
 assert.equal(s.payloads[0].message,'original question');
 assert.equal(s.payloads[0].newsArticleId,'chosen');
 assert.equal(s.message.value,'new draft');
});

test('retry while auth is still unavailable never sends an AI request',async()=>{
 const s=setup({unavailable:true});await s.ctx.ask('keep me');
 s.bubbles[1].children[2].click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.calls(),0);assert.equal(s.message.value,'keep me');
 assert.equal(s.ctx.chatBusy,false);
});

test('answer completion keeps the reading position unless already following the bottom',async()=>{
 for(const [top,expected] of [[100,100],[1050,1500]]){
  const s=setup();Object.assign(s.ctx.log,{scrollTop:top,scrollHeight:1500,clientHeight:400});
  s.ctx.fetch=async()=>({ok:true,json:async()=>({answer:'A completed analysis'})});
  await s.ctx.ask('explain');assert.equal(s.ctx.log.scrollTop,expected);
 }
});

test('slow preparation does not consume model budget and completed requests clear all timers',async()=>{
 const s=setup(),timers=new Map();let id=0,preparationTimer;
 s.ctx.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id};
 s.ctx.clearTimeout=id=>timers.delete(id);
 s.ctx.refreshAuth=async()=>{preparationTimer=[...timers.keys()][0];assert.equal(timers.get(preparationTimer).ms,30000)};
 s.ctx.fetch=async()=>{
  assert.equal(timers.has(preparationTimer),false);
  assert.ok([...timers.values()].some(t=>t.ms===65000));
  [...timers.values()].find(t=>t.ms===20000).fn();
  assert.match(s.ctx.$('chatRequestState').textContent,/עדיין מעבד/);
  return {ok:true,json:async()=>({answer:'completed after a slow preparation'})};
 };
 await s.ctx.ask('analysis');assert.match(s.bubbles[1].textContent,/completed after/);assert.equal(timers.size,0);
});

test('explanatory chart command sends the execution receipt to the model and retains chart scope',async()=>{
 const s=setup();s.ctx.parseChartCommand=()=>({recognized:true,actions:[{type:'indicator',indicator:'MA20',enabled:true}],message:''});
 s.ctx.runChatActions=async()=>({changed:true,messages:['הופעל MA20.']});
 s.ctx.currentContext=()=>({});s.ctx.loaded={symbol:'AAPL',source:'CSV',interval:'1day',receivedAt:'2026-11-06T00:00:00Z',bars:[]};s.ctx.localChart.settings=()=>({});
 let payload;s.ctx.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'הממוצע מסייע להשוות את המחיר למגמה האחרונה.'})}};
 await s.ctx.ask('הוסף MA20 ולמה הוא חשוב?');assert.match(payload.chartToolReceipt,/הופעל MA20/);assert.equal(s.ctx.conversation.at(-1).chartContext.symbol,'AAPL');assert.equal(s.ctx.conversation.at(-1).chartContext.interval,'1day');assert.match(s.bubbles[1].textContent,/מסייע/);
});

test('switching stocks and intervals preserves conversation history with each turn scoped to its chart',async()=>{
 const s=setup();mountLifecycle(s);const sent=[];
 s.ctx.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({answer:'A conceptual reply, no market prices'})}};
 await s.ctx.ask('הסבר איך בוחנים סיכון');
 s.ctx.chartSymbol.value='NVDA';s.ctx.chartSymbol.input();
 s.ctx.$('marketInterval').value='1week';s.ctx.$('marketInterval').change();
 await s.ctx.ask('ואיך זה קשור למניה הזו?');
 const current=sent[1];assert.equal(current.symbol,'NVDA');assert.equal(current.interval,'1week');
 assert.equal(current.history.length,2);assert.equal(current.history[0].chartContext.symbol,'AAPL');assert.equal(current.history[0].chartContext.interval,'1day');
 assert.equal(current.bars,null);assert.equal(current.useServerMarket,false);assert.equal(s.ctx.conversation.at(-1).chartContext.symbol,'NVDA');
});

test('chart changes end pending bubbles, preserve history and recover only an empty draft',async()=>{
 for(const draft of ['', 'a newer draft']){
  const s=setup({draft});mountLifecycle(s);let finish,signal,entered;
  s.ctx.conversation=[{role:'user',content:'earlier context',chartContext:{symbol:'AAPL'}}];
  const ready=new Promise(resolve=>entered=resolve);
  s.ctx.fetch=async(_url,options)=>{signal=options.signal;entered();return new Promise(resolve=>finish=resolve)};
  const pending=s.ctx.ask('explain the old chart');await ready;
  s.ctx.chartSymbol.value='NVDA';s.ctx.chartSymbol.input();
  assert.equal(signal.aborted,true);assert.equal(s.ctx.chatBusy,false);assert.match(s.bubbles[1].textContent,/הבקשה נעצרה/);
  assert.equal(s.message.value,draft||'explain the old chart');assert.equal(s.ctx.conversation.length,1);
  finish({ok:true,json:async()=>({answer:'late answer that must be discarded'})});await pending;
  assert.equal(s.ctx.conversation.length,1);assert.doesNotMatch(s.bubbles[1].textContent,/late answer/);
 }
});

test('new conversation and logout clear retained history without restoring an abandoned question',async()=>{
 for(const action of ['new','logout']){
  const s=setup();const events=mountLifecycle(s);let finish,entered;
  s.ctx.conversation=[{role:'user',content:'private old conversation'}];
  const ready=new Promise(resolve=>entered=resolve);
  s.ctx.fetch=async()=>{entered();return new Promise(resolve=>finish=resolve)};
  const pending=s.ctx.ask('abandoned question');await ready;
  if(action==='new')s.ctx.$('clearConversation').click();else events.get('asaf:logout')();
  assert.equal(s.ctx.conversation.length,0);assert.equal(s.message.value,'');assert.equal(s.ctx.requestInvalidated,null);
  finish({ok:true,json:async()=>({answer:'old private answer'})});await pending;
  assert.equal(s.ctx.conversation.length,0);assert.ok(s.bubbles.every(b=>!b.textContent.includes('old private answer')));
 }
});

test('explanations reach the model without candles and include an honest local tool receipt',async()=>{
 const s=setup();s.ctx.parseChartCommand=parseChartCommand;s.ctx.$('marketInterval').value='1week';
 s.ctx.runChatActions=async()=>({changed:true,messages:['הופעל MA20; אין נרות לניתוח מספרי.']});
 let sent;s.ctx.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'MA20 הוא ממוצע של עשרים נרות; אין כאן נתוני מחיר.'})}};
 await s.ctx.ask('הוסף MA20 ותסביר למה הוא חשוב');
 assert.ok(sent);assert.equal(sent.bars,null);assert.equal(sent.source,'none');assert.equal(sent.interval,'1week');
 assert.equal(sent.useServerMarket,false);assert.equal(sent.chartControl,false);assert.match(sent.chartToolReceipt,/אין נרות/);
 assert.match(s.bubbles[1].textContent,/עשרים נרות/);
});

test('an unavailable chart command can be explained but still cannot bypass model authentication',async()=>{
 const s=setup();s.ctx.parseChartCommand=()=>({recognized:true,actions:[],message:'טווח לא נתמך'});
 let sent;s.ctx.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({answer:'הסבר למגבלה'})}};
 await s.ctx.ask('למה הבקשה הזו לא נתמכת?');assert.match(sent.chartToolReceipt,/לא נתמך/);assert.match(s.bubbles[1].textContent,/הסבר למגבלה/);
 const anonymous=setup();anonymous.ctx.authState.authenticated=false;anonymous.ctx.parseChartCommand=parseChartCommand;
 anonymous.ctx.runChatActions=async()=>({messages:['הופעל MA20.']});await anonymous.ctx.ask('הוסף MA20 ותסביר למה');
 assert.equal(anonymous.calls(),0);assert.match(anonymous.bubbles[1].textContent,/להיכנס לחשבון/);
});
