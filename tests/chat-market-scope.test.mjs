import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MARKET_QA_POLICY,unsupportedChatRequest,scopeError} from '../server/chat-scope.mjs';
import {currentUSMarketIntent} from '../chat-market-intent.mjs';
import {ownerWebPilotQuestion} from '../server/owner-web-pilot.mjs';
test('scope includes real market and cryptocurrency analysis, but rejects explicit personal requests',()=>{
 for(const prompt of ['עזור לי עם הזוגיות שלי ולפני כן תן לי חדשות על NVDA','Help me fix my marriage and explain my earnings','What should I cook tonight?','Tell me why my girlfriend is upset','מה לאכול היום?']){
  assert.equal(unsupportedChatRequest(prompt),true,prompt);
  assert.equal(ownerWebPilotQuestion(prompt),false,prompt);
 }
 for(const prompt of ['מה שינה את המגמה בשוק הקריפטו?','מה ההבדל בין ביטקוין לאתריום?','Explain how drug trial news affects healthcare shares','Compare the recent airline earnings','Compare risks for my family’s BTC holdings','איך לנתח דוח רבעוני?'])
  assert.equal(unsupportedChatRequest(prompt),false,prompt);
 assert.match(MARKET_QA_POLICY,/Bitcoin \(BTC\).*Ethereum \(ETH\)/);
 assert.match(MARKET_QA_POLICY,/relationships, health, personal life/);
 assert.equal(scopeError('he').credits.charged,0);
});
test('all translated broad-market draft starters classify without selected-chart context',()=>{
 const key='מה אתה חושב על השוק היום';
 for(const l of ['en','es','fr','de','pt','ru','ar','zh','ja']){
  const dictionary=JSON.parse(readFileSync(new URL('../locales/'+l+'.json',import.meta.url),'utf8'));
  assert.equal(currentUSMarketIntent(dictionary[key]),true,l+': '+dictionary[key]);
  for(const educational of ['איך לקרוא דוח רבעוני?','מה ההבדל בין ביטקוין לאתריום?'])assert.equal(typeof dictionary[educational],'string');
 }
 assert.equal(currentUSMarketIntent(key),true);
});
