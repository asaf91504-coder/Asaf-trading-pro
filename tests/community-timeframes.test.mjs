import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setupInterval,setupHoldingPeriod,setupIntervalNames,holdingPeriodNames,openSetupChart} from '../community-setup.mjs';
import {setupInput,publicSetup} from '../server/community-core.mjs';
import {createCommunityHandler} from '../netlify/functions/community.mjs';

const valid={symbol:'SPY',side:'watch',interval:'1day',holdingPeriod:'long_term',title:'רעיון מעקב ארוך טווח',thesis:'מעקב אחרי קרן העוקבת אחר מדד רחב',entry:'',stop:'',target:''};
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../community-ui.mjs',import.meta.url),'utf8');

test('candle intervals and holding periods are separate, typed fields',()=>{
  for(const interval of ['15min','1h','1hour','1day','1week']) {
    for(const holdingPeriod of ['days','weeks','months','long_term']) {
      const saved=setupInput({...valid,interval,holdingPeriod});
      assert.equal(saved.interval,interval==='1hour'?'1h':interval);
      assert.equal(saved.holdingPeriod,holdingPeriod);
    }
  }
  for(const bad of ['1month','months','__proto__',{},['1day'],true,0,null]) {
    assert.equal(setupInterval(bad),null);
    assert.throws(()=>setupInput({...valid,interval:bad}),/נרות/);
  }
  for(const bad of ['1day','forever','__proto__',{},['days'],true,0]) {
    assert.equal(setupHoldingPeriod(bad),null);
    assert.throws(()=>setupInput({...valid,holdingPeriod:bad}),/החזקה/);
  }
});

test('old posts and old clients do not invent a holding period',()=>{
  const old={...valid,interval:'1hour'};delete old.holdingPeriod;
  assert.equal(setupInput(old).holdingPeriod,'unspecified');
  const shown=publicSetup({...old,authorId:'abcdef123',reports:{privateUser:true}},'other',false);
  assert.equal(shown.interval,'1h');assert.equal(shown.holdingPeriod,'unspecified');
  assert.equal(shown.authorId,undefined);assert.equal(shown.reports,undefined);
  assert.equal(shown.canDelete,false);
});

test('community create and read preserve independent weekly/monthly choices',async()=>{
  const env={ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_PUBLIC_AUTH_ENABLED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'fixture'};
  let posts=[];
  const handler=createCommunityHandler({env,authenticate:async()=>({id:'owner',sessionRaw:'s',memberRaw:'m'}),run:async args=>{
    if(args[0]==='EVAL'){posts=[JSON.parse(args[9])];return 1;}
    if(args[0]==='GET')return JSON.stringify(posts);
    throw Error('Unexpected storage call');
  }});
  const response=await handler(new Request('https://site.test/community',{method:'POST',headers:{origin:'https://site.test','content-type':'application/json',cookie:'asaf_session='+'a'.repeat(64)},body:JSON.stringify({action:'create',...valid,interval:'1week',holdingPeriod:'months'})}));
  assert.equal(response.status,201);
  const result=await (await handler(new Request('https://site.test/community'))).json();
  assert.equal(result.posts[0].interval,'1week');assert.equal(result.posts[0].holdingPeriod,'months');
  assert.equal(result.posts[0].symbol,'SPY');assert.equal(result.posts[0].entry,null);
});

function fixture({previous='1day',busy=false,options=['15min','1h','1day','1week']}={}) {
  const actions=[];
  const nodes={
    symbol:{value:'AAPL',dispatchEvent:e=>actions.push('symbol:'+e.type)},
    marketInterval:{value:previous,options:options.map(value=>({value})),dispatchEvent:e=>actions.push('interval:'+e.type)},
    marketFetch:{disabled:busy},
    loadChart:{click:()=>actions.push('load:'+nodes.symbol.value+':'+nodes.marketInterval.value)}
  };
  const document={getElementById:id=>nodes[id],querySelector:()=>({click:()=>actions.push('charts')})};
  return {document,nodes,actions};
}

test('opening every saved interval replaces the previous interval before loading once',()=>{
  for(const previous of ['15min','1h','1day','1week'])for(const interval of ['15min','1h','1hour','1day','1week']) {
    const f=fixture({previous});openSetupChart({...valid,interval},{document:f.document});
    assert.equal(f.nodes.marketInterval.value,setupInterval(interval));
    assert.deepEqual(f.actions,[...(previous!==setupInterval(interval)?['interval:change']:[]),'symbol:input','charts','load:SPY:'+setupInterval(interval)]);
  }
});

test('reopening the same setup during cooldown preserves its already loaded candles',()=>{
  const f=fixture();let loaded=true;
  f.nodes.marketInterval.dispatchEvent=()=>{loaded=false;};
  f.nodes.symbol.value='SPY';
  f.nodes.loadChart.click=()=>f.actions.push('refresh-throttled');
  openSetupChart(valid,{document:f.document});openSetupChart(valid,{document:f.document});
  assert.equal(loaded,true);assert.deepEqual(f.actions,['charts','refresh-throttled','charts','refresh-throttled']);
});

test('unknown intervals and an in-progress load leave the selection untouched',()=>{
  for(const [interval,options] of [['1month',{}],['1week',{options:['1day']}],['1day',{busy:true}]]) {
    const f=fixture(options);assert.throws(()=>openSetupChart({...valid,interval},{document:f.document}));
    assert.equal(f.nodes.symbol.value,'AAPL');assert.equal(f.nodes.marketInterval.value,'1day');assert.deepEqual(f.actions,[]);
  }
});

test('the form offers distinct holding periods and every setup interval is loadable',()=>{
  const field=name=>html.match(new RegExp('<select[^>]*'+name+'[^>]*>(.*?)</select>'))?.[1]||'';
  const chart=field('id="marketInterval"'),setup=field('name="interval"'),holding=field('name="holdingPeriod"');
  for(const interval of Object.keys(setupIntervalNames)) {
    assert.ok(chart.includes('value="'+interval+'"'));assert.ok(setup.includes('value="'+interval+'"'));
  }
  for(const value of ['days','weeks','months','long_term'])assert.ok(holding.includes('value="'+value+'"'));
  assert.match(html,/S&amp;P 500/);assert.match(html,/סימולים המורשים/);
});

test('the rendered card shows candle interval and holding period independently and opens that chart',()=>{
  const f=fixture();
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
    append(...children){this.children.push(...children);}
    replaceChildren(){this.children=[];}
  }
  const feed=new Node('div');
  Object.assign(f.nodes,{communityFeed:feed,communitySearch:{value:''},communitySide:{value:''},communityStatus:{textContent:''}});
  f.document.createElement=tag=>new Node(tag);
  const context={document:f.document,$:id=>f.nodes[id],posts:[{...valid,interval:'1week',holdingPeriod:'months',author:'חבר בדיקה',createdAt:'2026-11-08T00:00:00Z'}],sideNames:{watch:'למעקב'},setupInterval,setupIntervalNames,setupHoldingPeriod,holdingPeriodNames,openSetupChart,Date};
  vm.createContext(context);
  const element=source.slice(source.indexOf('function element('),source.indexOf('async function api('));
  const render=source.slice(source.indexOf('function render('),source.indexOf('async function load('));
  vm.runInContext(element+render+';render();',context);
  const all=node=>[node,...node.children.flatMap(all)];const rendered=all(feed);
  assert.ok(rendered.some(node=>node.textContent==='למעקב · נרות: שבועי'));
  assert.ok(rendered.some(node=>node.textContent==='טווח החזקה: כמה חודשים'));
  rendered.find(node=>node.textContent==='פתח גרף').onclick();
  assert.equal(f.actions.at(-1),'load:SPY:1week');
});

test('changing candle interval invalidates cached candles and pending analysis',()=>{
  const source=readFileSync(new URL('../stock-chat-ui.mjs',import.meta.url),'utf8');
  const listener=source.slice(source.indexOf('$("marketInterval").addEventListener("change"'),source.indexOf('chartSymbol.addEventListener("input"'));
  let onChange;const events=[],removed=[];
  const context={$:()=>({addEventListener:(_name,callback)=>{onChange=callback}}),chartRevision:2,loaded:{symbol:'SPY',interval:'1day'},localChart:{clear:()=>events.push('clear')},resetRequest:()=>events.push('cancel-analysis'),sessionStorage:{removeItem:key=>removed.push(key)},key:'candles',renderStatus:()=>events.push('status'),window:{dispatchEvent:e=>events.push(e.type)},Event};
  vm.createContext(context);vm.runInContext(listener,context);onChange();
  assert.equal(context.loaded,null);assert.equal(context.chartRevision,3);
  assert.deepEqual(removed,['candles']);assert.deepEqual(events,['cancel-analysis','clear','status','asaf:dataset-cleared']);
});

test('applying a weekly layout invalidates daily candles before opening a matching setup',()=>{
  const layoutSource=readFileSync(new URL('../layouts-ui.mjs',import.meta.url),'utf8');
  const apply=layoutSource.slice(layoutSource.indexOf('load.onclick='),layoutSource.indexOf('remove.onclick='));
  const f=fixture();f.nodes.symbol.value='SPY';let loadedInterval='1day';
  f.nodes.marketInterval.dispatchEvent=e=>{assert.equal(e.type,'change');loadedInterval=null;};
  f.nodes.localChartRange={options:[{value:'60'}],value:'60',dispatchEvent(){}};
  const context={load:{},read:()=>[{id:'saved',symbol:'SPY',interval:'1week',range:60,preferences:{}}],select:{value:'saved'},$:id=>f.nodes[id],normalizeSymbol:value=>value,localStorage:{setItem(){}},personalKeys:{chartPreferences:'chart'},window:{dispatchEvent(){}},Event,CustomEvent,document:f.document,status:{textContent:''}};
  vm.createContext(context);vm.runInContext(apply,context);context.load.onclick();
  assert.equal(f.nodes.marketInterval.value,'1week');assert.equal(loadedInterval,null);
  openSetupChart({...valid,interval:'1week'},{document:f.document});
  assert.equal(loadedInterval,null);assert.equal(f.actions.at(-1),'load:SPY:1week');
});
