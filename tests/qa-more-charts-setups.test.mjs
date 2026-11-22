import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChartData} from '../chart-data.mjs';
import {chartLayout} from '../chart-layout.mjs';
import {chartTimeLabel,priceTicks} from '../chart-presentation.mjs';
import {setupInput, publicSetup} from '../server/community-core.mjs';
import {setupCandidates,visibleSetups,decideSetup,canReviewSetups} from '../server/setup-review.mjs';

const date=i=>new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10);
const bars=(n=22, fn=(i)=>[date(i),100,104,98,101,1000,'AAPL'])=>Array.from({length:n},(_,i)=>fn(i));
const csv=(rows=bars(),header='Date,Open,High,Low,Close,Volume,Symbol',nl='\n')=>[header,...rows.map(r=>r.join(','))].join(nl);
const prepare=(rows,symbol='AAPL')=>prepareChartData(csv(rows),symbol);
const withBar=(i,patch)=>bars().map((row,j)=>i===j?Object.assign(row,patch):row);
const checks=[];
const add=(name,check)=>checks.push([name,check]);
const same=(name,run,expected)=>add(name,()=>assert.deepEqual(run(),expected));
const rejects=(name,run,message)=>add(name,()=>assert.throws(run,message));

// Chart import integration: validate the data actually shown by the production preprocessing.
same('reverse sorted CSV displays last chronologically',()=>prepare(bars().reverse()).bars.at(-1).date,'2024-01-22');
same('quoted comma volume is not treated as a second cell',()=>prepare(withBar(21,{5:'"1,234"'})).bars.at(-1).volume,1234);
same('UTF8 BOM and Windows line breaks work together',()=>prepareChartData('\uFEFF'+csv(bars(),undefined,'\r\n'),'AAPL').bars.length,22);
same('valid exactly-minimum history has a context',()=>prepare(bars(21)).context.bars,21);
same('unsupported MA150 appears as unavailable not zero',()=>prepare(bars(21)).context.sma150,null);
same('MA150 becomes available with enough bars',()=>prepare(bars(150)).context.sma150,101);
same('comparison price uses previous close after sorting',()=>prepare(withBar(21,{4:102}).reverse()).context.dailyChangePercent,.99);
same('latest close outside its own range is excluded',()=>prepare(withBar(21,{4:105})).bars.at(-1).date,'2024-01-21');
same('opening outside its own range is excluded',()=>prepare(withBar(21,{1:97})).bars.at(-1).date,'2024-01-21');
same('invalid negative volume does not discard valid prices',()=>prepare(withBar(21,{5:-1})).bars.at(-1).volume,null);
same('incomplete prior volume suppresses ratio',()=>prepare(withBar(19,{5:'N/A'})).context.volumeRatio,null);
same('real zero latest volume is not erased',()=>prepare(withBar(21,{5:0})).context.volumeRatio,0);
same('latest zero daily range does not invent a body fraction',()=>prepare(withBar(21,{1:101,2:101,3:101})).context.bodyFraction,null);
same('timezone offset maps candle to UTC on the next calendar day',()=>prepare(withBar(21,{0:'2024-01-22T23:45:00-02:00'})).bars.at(-1).date,'2024-01-23 01:45:00');
same('invalid February date never becomes March candle',()=>prepare(withBar(21,{0:'2024-02-30'})).bars.at(-1).date,'2024-01-21');
same('multiple points on one day remain distinct intraday candles',()=>prepare(bars(21,i=>['2024-02-03 10:'+String(i).padStart(2,'0'),100,104,98,101,1000,'AAPL'])).interval,'intraday');
same('same-symbol duplicate uses latest supplied revision',()=>prepare([...bars(),[date(21),101,105,98,103,1500,'AAPL']]).bars.at(-1).close,103);
rejects('duplicate timestamp cannot hide a second ticker in chart import',()=>prepare([...bars(),[date(0),100,104,98,101,1000,'MSFT'],bars()[0]]),/כמה מניות/);
same('selected ticker trims and uppercases before rendering',()=>prepare(undefined,'  nasdaq:aapl ').symbol,'NASDAQ:AAPL');
rejects('ticker with whitespace inside is not accepted',()=>prepare(undefined,'N ASDAQ:AAPL'),/סימול/);

// Price and time axes: known realistic and edge ranges; preserve date vs time modes.
same('US stock price ticks use five-dollar steps',()=>priceTicks(9,34),[10,15,20,25,30]);
same('fractional FX ticks use half-cent steps in a narrow window',()=>priceTicks(1.09,1.11),[1.09,1.095,1.1,1.105,1.11]);
same('negative-only oscillator scale yields ascending clean ticks',()=>priceTicks(-10,-2),[-10,-8,-6,-4,-2]);
same('zero crossing includes a single zero',()=>priceTicks(-3,3,3),[-2,0,2]);
same('inverted bounds produce no ticks',()=>priceTicks(500,400),[]);
same('unbounded maximum cannot render',()=>priceTicks(1,Infinity),[]);
same('mobile target of one still produces readable minimum tick count',()=>priceTicks(6,14,1),[10]);
same('seconds-precision feed values render clock time on intraday axis',()=>chartTimeLabel('2024-03-01 09:35:12',true),'09:35');
same('minutes-precision feed values render clock time on intraday axis',()=>chartTimeLabel('2024-04-01 12:05',true),'12:05');
same('midnight axis renders midnight rather than date',()=>chartTimeLabel('2024-04-02 00:00:00',true),'00:00');
same('daily mode continues to display dates for space-separated data',()=>chartTimeLabel('2024-04-01 12:05',false),'04-01');
same('missing date produces empty tick',()=>chartTimeLabel(null,true),'');

// Chart layout geometry at concrete device widths and panel states.
same('449px retains compact price gutter',()=>chartLayout(449).right,57);
same('450px moves to regular price gutter',()=>chartLayout(450).right,73);
same('chart provides positive plot geometry at transient 0px resize',()=>chartLayout(0).plotWidth,1);
same('custom tiny price pane retains minimum 180px',()=>{const x=chartLayout(320,[],30);return x.bottom-x.top},180);
same('landscape price pane honors 310px requested height',()=>{const x=chartLayout(700,[],310);return x.bottom-x.top},310);
same('volume top has 20px price-axis spacing',()=>{const x=chartLayout(320);return x.volTop-x.bottom},20);
same('volume pane remains 53px high independently of price expansion',()=>{const x=chartLayout(700,[],440);return x.volBottom-x.volTop},53);
same('first oscillator begins below volume labels',()=>{const x=chartLayout(390,['rsi']);return x.panes.rsi.top-x.volBottom},30);
same('oscillator order matches the chosen pane order',()=>Object.keys(chartLayout(390,['macd','rsi','atr']).panes),['macd','rsi','atr']);
same('second oscillator adds full pane and label spacing',()=>chartLayout(390,['adx','obv']).height-chartLayout(390,['adx']).height,105);

const post={symbol:'AAPL',side:'long',interval:'1day',holdingPeriod:'weeks',title:'Reference setup',thesis:'An offline reference setup',entry:100,stop:95,target:112};
const setup=patch=>setupInput({...post,...patch});
same('community entry accepts normal decimal from form',()=>setup({entry:'100.25'}).entry,100.25);
same('community accepts small numeric crypto price from form',()=>setup({entry:'0.00000001',stop:'0.000000009',target:'0.00000002'}).entry,1e-8);
same('community does not round submitted decimal string',()=>setup({target:'112.123456'}).target,112.123456);
rejects('community rejects boolean price instead of coercing to one dollar',()=>setup({stop:true}),/רמת מחיר/);
rejects('community rejects array price instead of coercing to its only number',()=>setup({stop:[95]}),/רמת מחיר/);
rejects('community rejects hexadecimal price input',()=>setup({stop:'0x5f'}),/רמת מחיר/);
rejects('community rejects price above maximum',()=>setup({target:1e12+1}),/רמת מחיר/);
same('community accepts price at inclusive maximum',()=>setup({target:1e12}).target,1e12);
rejects('community rejects stop exactly equal to entry',()=>setup({stop:100}),/סדר רמות/);
rejects('community rejects short target equal to entry',()=>setup({side:'short',stop:110,target:100}),/סדר רמות/);
same('community watch can carry only one research level',()=>setup({side:'watch',stop:null,target:null}).stop,null);
same('community admin sees count and reporter state without raw report data',()=>{const x=publicSetup({...post,authorId:'author111',reports:{viewer:true,other:true}},'viewer',true);return [x.reportCount,x.reported,x.canDelete,x.reports]},[2,true,true,undefined]);
same('ordinary viewer does not see moderation counts',()=>{const x=publicSetup({...post,authorId:'author111',reports:{viewer:true,other:true}},'viewer',false);return [x.reportCount,x.reported,x.canDelete]},[undefined,true,false]);

// Approved setups pipeline with trusted synthetic scan, never a live write.
const now=Date.parse('2026-09-15T12:00:00Z'),time=(delta=0)=>new Date(now+delta).toISOString();
const item=(kind,scenario={side:'long',entry:10,stop:9,target:15})=>({kind,stage:'confirmed',scenario});
const mockDaily=Array.from({length:15},(_,i)=>({date:new Date(Date.UTC(2026,7,i+31)).toISOString().slice(0,10),high:10.5,low:9.5,close:10}));
const scan=(candidates,extra={})=>({startedAt:time(-1000),completedAt:time(),nextUpdateAt:now+60_000,records:[{symbol:'AAPL',summary:{date:'2026-09-14'},bars:mockDaily,interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,receivedAt:time(),source:'synthetic',research:{candidates}}],...extra});
const base=scan([item('reference')]), accepted=setupCandidates(base)[0];
const context=(book={},extra={})=>({scan:base,key:'fixture',snapshot:'{}',raw:'',book,candidates:[accepted],...extra});
same('approval age at exactly 24h expires',()=>visibleSetups(context({id:{status:'approved',at:time(-86390000),item:{...accepted,scanAt:time(-86400000)}}}),false,now).published,[]);
same('approval remains visible just under 24h',()=>visibleSetups(context({id:{status:'approved',at:time(-86390000),item:{...accepted,scanAt:time(-86399999)}}}),false,now).published.length,1);
same('reviewer sees existing rejected candidate separately from public listing',()=>{const r=visibleSetups(context({[accepted.id]:{status:'rejected',at:time(),item:accepted}}),true,now);return [r.queue[0].status,r.published.length]},['rejected',0]);
same('published candidate exposes approval timestamp not reviewer account id',()=>{const r=visibleSetups(context({id:{status:'approved',at:time(),reviewer:'alice',item:accepted}}),false,now);return [r.published[0].approvedAt,r.published[0].reviewer]},[time(),undefined]);
same('approver identity configuration rejects a missing account',()=>canReviewSetups(null,{ASAF_SETUPS_REVIEWER_MEMBER_ID:'12345678-1234-1234-1234-123456789abc'}),false);
same('approved setup derives SHA identifier from scenario change',()=>setupCandidates(scan([item('reference',{side:'long',entry:11,stop:9,target:15})]))[0].id===accepted.id,false);
same('approved setup omits watch and absent or invalid price candidates',()=>setupCandidates(scan([item('watch',{side:'watch',entry:10,stop:9,target:15}),item('missing',null),item('negative',{side:'long',entry:-10,stop:-9,target:15})])),[]);
same('candidate cap bounds review queue',()=>setupCandidates(scan(Array.from({length:212},(_,i)=>item('pattern'+i)))).length,200);
same('approved setup uses machine kind when display label is absent',()=>accepted.pattern,'reference');
add('stale scan allows retracting already published previous item',async()=>{
 const id='unrelated',reviewer='12345678-1234-1234-1234-123456789abc',env={ASAF_SETUPS_REVIEWER_MEMBER_ID:reviewer};
 let received;
 const result=await decideSetup(context({[id]:{status:'approved',at:time(-100),item:accepted}},{scan:{...base,stale:true}}),{id,decision:'rejected',user:{id:reviewer},env,now,run:async args=>{received=JSON.parse(args.at(-1));return 1}});
 assert.equal(result.status,'rejected');assert.equal(received[id].status,'rejected');
});

assert.equal(checks.length,65);
for(const [name,check] of checks)test(name,check);
