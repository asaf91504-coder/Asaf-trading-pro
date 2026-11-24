import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChartCommand,validateChartActions,requestsChartControl} from '../chat-chart-actions.mjs';
import {requestsChartAnalysis} from '../chart-analysis-request.mjs';
import {isLearningQuestion,mergeResearchActions} from '../chat-request-intent.mjs';
import {entryStopScenario,compactEntryStopText,scenarioSide} from '../entry-stop-scenario.mjs';
import {executeChartActions} from '../chart-command-controller.mjs';
import {ventureChart} from '../server/venture-presentation.mjs';
import {renderChatReply} from '../chat-reply-ui.mjs';
import {withMichaKnowledge} from '../server/micha-knowledge.mjs';
import {cleanChatMessage} from '../chat-history-core.mjs';
import {chatPresentationCopy} from '../chat-presentation-copy.mjs';
import {createTranslator} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const bars=Array.from({length:150},(_,i)=>({date:new Date(Date.UTC(2026,4,i+1)).toISOString().slice(0,10),open:100,high:102,low:99,close:101,volume:1000}));
const meta={symbol:'CRWV',source:'Twelve Data',interval:'1day',barPolicy:'previous-daily-sessions',latestBarMayBePartial:false,receivedAt:'2026-11-24T12:00:00Z',latestBarTime:bars.at(-1).date,provenance:'server-provider-cache'};
test('the exact reported CRWV wording selects its ticker and requests chart research before inference',()=>{
 const q='תנתח לי את CRWV ותגיד מתי להיכנס ולצאת',command=parseChartCommand(q,{currentSymbol:'NASDAQ:AAPL'});
 assert.equal(command.actions[0].symbol,'CRWV');assert.equal(requestsChartAnalysis(q,{command}),true);
 assert.deepEqual(command.actions.slice(1),[{type:'levels',kind:'both'},{type:'trendlines'},{type:'tradelevels',side:'long'}]);
});
test('learning questions with MA mentions or a no-action instruction do not become chart requests',()=>{
 for(const q of ['בחן מועמד לסורק לפי נתונים היפותטיים: MA20=28 ו־MA150=35. אל תניח נתונים נוספים.','אתגר לימודי: חשב ריבית דריבית ואל תשנה את כללי הסורק.']){
  assert.equal(isLearningQuestion(q),true);const command=parseChartCommand(q);assert.equal(command.recognized,false);assert.deepEqual(command.actions,[]);
  assert.equal(requestsChartAnalysis(q,{command}),false);assert.equal(requestsChartControl(q),false);
 }
 assert.equal(isLearningQuestion('הסבר דוגמה היפותטית ואז נתח את הגרף הפתוח'),false);
});
test('server chart markings use the same conditional levels as the chat, including exact ATR stop and measured target',async()=>{
 const plan=entryStopScenario(bars,meta),rendered=[];
 const result=await executeChartActions([{type:'tradelevels',side:'long'}],{getSymbol:()=>meta.symbol,getData:()=>({...meta,bars}),getTradeScenario:side=>entryStopScenario(bars,meta,side),applyRender:items=>rendered.push(...items)});
 const lines=rendered[0].items;assert.equal(lines.length,3);assert.equal(lines[0].points[0].price,plan.entry);assert.equal(lines[1].points[0].price,plan.stop);assert.equal(lines[2].points[0].price,plan.target);
 assert.equal(plan.entry-plan.stop,2*plan.atr14);assert.equal(plan.target,105);assert.equal(plan.riskReward,.375);assert.equal(result.changed,true);
 for(const line of lines)assert.equal(line.points.at(-1).date,plan.asOf);
 assert.equal(scenarioSide('Analyze CRWV, give a short answer'),'long');
 assert.throws(()=>validateChartActions([{type:'tradelevels',side:'long',entry:123}]));
});
test('raster overlays change the actual image without exposing raw bars or price coordinates',async()=>{
 const snapshot={...meta,bars},base=await ventureChart(snapshot),marked=await ventureChart(snapshot,[{type:'levels',kind:'both'},{type:'trendlines'},{type:'tradelevels',side:'long'}]);
 assert.notEqual(marked.image,base.image);assert.ok(marked.messages.some(m=>m.includes('טריגר')));
 assert.equal(marked.bars,undefined);assert.equal(marked.annotations,undefined);assert.equal(marked.tradeScenario,undefined);
});
test('repeated analysis replaces an old trade side, and clearing removes old research layers',()=>{
 const previous=[{type:'indicator',indicator:'MA20',enabled:true},{type:'tradelevels',side:'long'},{type:'levels',kind:'both'}];
 const next=mergeResearchActions(previous,[{type:'tradelevels',side:'short'}]);assert.equal(next.filter(a=>a.type==='tradelevels').length,1);assert.equal(next.at(-1).side,'short');
 const cleared=mergeResearchActions(next,[{type:'clear_annotations'}]);assert.deepEqual(cleared.map(a=>a.type),['indicator','clear_annotations']);
});
test('compact scenarios are short and localized while preserving the actual prices and date',()=>{
 const plan=entryStopScenario(bars,meta);
 for(const language of ['he','en','es','ar','fr','de','pt','ru','zh','ja']){
  const text=compactEntryStopText(plan,language);assert.ok(text.includes('102.75'));assert.ok(text.includes('96.75'));assert.ok(text.includes('105'));assert.ok(text.includes(plan.asOf));assert.equal(text.split('\n').length,7);
  if(language!=='he')assert.doesNotMatch(text,/[\u0590-\u05ff]/);
 }
 const prompt=withMichaKnowledge([{role:'system',content:'rules'},{role:'user',content:'נתח את הגרף'}],'נתח את הגרף');assert.match(prompt[0].content,/RESPONSE STYLE.*at most90 words/s);
});
test('tool logs are collapsed separately and model prose remains visible and unmodified',()=>{
 const doc={documentElement:{lang:'he'},createElement:tag=>new Node(tag),createTextNode:text=>new Node('#text',text)};
 class Node{constructor(tag,text=''){this.tag=tag;this.value=text;this.children=[];this.ownerDocument=doc}get textContent(){return this.value+this.children.map(c=>c.textContent).join('')}set textContent(v){this.value=v;this.children=[]}append(...items){this.children.push(...items)}replaceChildren(...items){this.value='';this.children=items}}
 const parent=doc.createElement('div');renderChatReply(parent,{before:'נתוני הגרף נטענו.\nפירוט חישוב ארוך',answer:'ממתין לפריצה מאומתת.'});
 const body=parent.children[0];assert.equal(body.children[0].textContent,'ממתין לפריצה מאומתת.');assert.equal(body.children[1].tag,'details');assert.ok(!body.children[1].open);assert.match(body.children[1].textContent,/פירוט חישוב ארוך/);
});
test('saved conversations retain measured targets and tool details without granting them trusted provenance',()=>{
 const plan=entryStopScenario(bars,meta),saved=cleanChatMessage({role:'assistant',content:'Short analysis',toolReceipt:'Chart marked',tradeScenario:{...plan,rawBars:bars}},'assistant');
 assert.equal(saved.tradeScenario.target,105);assert.equal(saved.tradeScenario.riskReward,.375);assert.equal(saved.tradeScenario.atrStopMultiple,2);assert.equal(saved.tradeScenario.rawBars,undefined);assert.equal(saved.toolReceipt,'Chart marked');
 const malformed=cleanChatMessage({role:'assistant',content:'x',tradeScenario:{...plan,target:-3,atr14:99}},'assistant');assert.equal(malformed.tradeScenario.target,undefined);assert.equal(malformed.tradeScenario.atrStopMultiple,undefined);
});
test('new tool outcomes translate in every supported interface language',()=>{
 for(const language of Object.keys(chatPresentationCopy).filter(c=>c!=='he')){
  const tr=createTranslator(launchTranslations[language]);
  for(const key of ['drawn','noScenario']){assert.equal(tr(chatPresentationCopy.he[key]),chatPresentationCopy[language][key]);assert.doesNotMatch(tr(chatPresentationCopy.he[key]),/[\u0590-\u05ff]/);}
 }
});

test('Hebrew index requests select SPY before analysis rather than retaining AAPL',()=>{
 for(const name of ['הסנפ','הסנף','הסנ״פ','הסנ״ף','S&P 500','SPX']){
  const q='נתח לי את '+name,command=parseChartCommand(q,{currentSymbol:'NASDAQ:AAPL'});
  assert.equal(command.actions[0]?.symbol,'NYSEARCA:SPY',q);
  assert.equal(requestsChartAnalysis(q,{command}),true,q);
  assert.ok(command.actions.some(a=>a.type==='tradelevels'));
 }
});
