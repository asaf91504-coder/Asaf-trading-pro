import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseChartCommand} from '../chat-chart-actions.mjs';
import {executeChartActions} from '../chart-command-controller.mjs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
import {localizedChatReply} from '../chat-reply-ui.mjs';
import {entryStopScenario,entryStopText,scenarioSide} from '../entry-stop-scenario.mjs';
const bars=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:100,high:105+Math.sin(i)*3,low:95+Math.sin(i)*3,close:100,volume:1000}));
const cases=[
 ['פתח TSLA והוסף MA50 ו-EMA50',c=>assert.deepEqual(c.actions,[{type:'symbol',symbol:'NASDAQ:TSLA'},{type:'indicator',indicator:'MA50',enabled:true},{type:'indicator',indicator:'EMA50',enabled:true}])],
 ['Hide RSI and keep MA20',c=>assert.deepEqual(c.actions,[{type:'indicator',indicator:'RSI14',enabled:false}])],
 ['Draw trendlines',c=>assert.deepEqual(c.actions,[{type:'trendlines'}])],
 ['סמן דאבל בוטום',c=>assert.deepEqual(c.actions,[{type:'pattern',pattern:'double_bottom'}])],
 ['Switch to Heikin Ashi',c=>assert.deepEqual(c.actions,[{type:'style',style:'heikin'}])],
 ['Clear all annotations',c=>assert.deepEqual(c.actions,[{type:'clear_annotations'}])],
 ['Add MA37',c=>{assert.deepEqual(c.actions,[]);assert.match(c.message,/MA37/) }],
 ['Open AAPL and NVDA',c=>{assert.deepEqual(c.actions,[]);assert.equal(c.unresolvedSymbol,true)}],
 ['נתח את NVDA לשורט עם נקודת כניסה וסטופ לוס',c=>assert.deepEqual(c.actions,[{type:'symbol',symbol:'NASDAQ:NVDA'},{type:'levels',kind:'both'},{type:'trendlines'},{type:'tradelevels',side:'short'}])],
 ['Explain RSI 14 without changing the chart',c=>{assert.equal(c.recognized,false);assert.deepEqual(c.actions,[])}]
];
for(const [prompt,check] of cases)test('additional chat prompt: '+prompt,async()=>{
 const command=parseChartCommand(prompt,{currentSymbol:'NASDAQ:AAPL'});check(command);
 let symbol='NASDAQ:AAPL';const rendered=[];
 const result=await executeChartActions(command.actions,{getSymbol:()=>symbol,selectSymbol:s=>symbol=s,getData:()=>({symbol,bars}),fetchData:()=>assert.fail('No network fetch allowed'),applyRender:a=>rendered.push(...a)});
 const raw=[command.message,...result.messages].filter(Boolean).join('\n');
 for(const code of Object.keys(languageNames)){
  const catalog=code==='he'?{}:{...JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url))),...launchTranslations[code]};
  const tr=createTranslator(catalog),output=localizedChatReply({before:raw,answer:''},tr);
  if(code!=='he')assert.doesNotMatch(output,/[\u0590-\u05ff]/,code+': '+output);
  if(code==='he'&&raw)assert.equal(output,raw+'\n\n');
  for(const token of raw.match(/(?:MA\d+|EMA\d+|RSI\d+|NASDAQ:[A-Z]+)/g)||[])assert.ok(output.includes(token),token);
  if(prompt.includes('לשורט')){
   const plan=entryStopScenario(bars,{provenance:'server-provider-cache',interval:'1day',source:'Synthetic test fixture'},scenarioSide(prompt));
   assert.equal(plan.available,true);assert.equal(plan.side,'short');assert.ok(plan.stop>plan.entry);
   const scenario=entryStopText(plan,code);if(code!=='he')assert.doesNotMatch(scenario,/[\u0590-\u05ff]/);
  }
 }
 if(!command.actions.length)assert.deepEqual(rendered,[]);
});
test('preserve clauses do not inherit previous hide instruction in Hebrew or mixed operations',()=>{
 assert.deepEqual(parseChartCommand('הסתר RSI ותשאיר MA20').actions,[{type:'indicator',indicator:'RSI14',enabled:false}]);
 assert.deepEqual(parseChartCommand('Hide RSI and keep MA20 then add EMA50').actions,[{type:'indicator',indicator:'EMA50',enabled:true},{type:'indicator',indicator:'RSI14',enabled:false}]);
});
