import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createTranslator,languageNames} from '../interface-language.mjs';
import {launchTranslations} from '../launch-translations.mjs';
const source=readFileSync(new URL('../terminal-ui.mjs',import.meta.url),'utf8');
const handler=source.match(/^chartChatOnly\.onclick=(.*?);\n\/\/ Reveal executed chart changes/ms)?.[1];
assert.ok(handler,'Find the actual chart shortcut click binding');
const fallback='נתח את הגרף והצג נקודת כניסה וסטופ־לוס עם התנאים לתרחיש';
function run(inputValue,window){
 const calls=[],input={value:inputValue,focus:()=>calls.push('focus'),dispatchEvent:event=>calls.push(event.type)};
 const click=vm.runInNewContext(handler,{window,Event,$:id=>{assert.equal(id,'chatInput');return input},chartFocus:on=>calls.push(['chartFocus',on]),toggleWorkspaceChat:on=>calls.push(['toggleWorkspaceChat',on])});
 click();
 assert.deepEqual(calls,[['chartFocus',false],['toggleWorkspaceChat',true],'input','focus']);
 return input.value;
}
for(const code of Object.keys(languageNames)){
 const base=code==='he'?{}:JSON.parse(readFileSync(new URL('../locales/'+code+'.json',import.meta.url),'utf8'));
 const catalog={...base,...launchTranslations[code]},window={asafTranslate:createTranslator(catalog)};
 test('chart shortcut opens a draft in '+code,()=>{
  const expected=code==='he'?fallback:catalog[fallback];
  if(code!=='he')assert.notEqual(expected,fallback);
  assert.ok(expected);
  assert.equal(run('',window),expected);
 });
 test('chart shortcut preserves existing draft in '+code,()=>assert.equal(run('AAPL · my draft 42',window),'AAPL · my draft 42'));
}
test('chart shortcut uses the native draft before the translator initializes',()=>assert.equal(run('   ',{}),fallback));
