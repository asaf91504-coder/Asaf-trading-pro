import test from 'node:test';
import assert from 'node:assert/strict';
import {questionAsset,sameChatAsset,stockDiscoveryIntent} from '../chat-asset-intent.mjs';
test('current question selects explicit stock or crypto independently of chart/history',()=>{
 for(const [q,s] of [['מה דעתך על TSLA','TSLA'],['מה קורה עם מניית ACMR','ACMR'],['ומה עם IREN?','IREN'],['מה דעתך על טסלה','TSLA'],['תנתח את אנבידיה','NVDA'],['מה דעתך על ביטקוין','BTCUSD'],['ומה עם אתריום?','ETHUSD'],['what about $ZZZZ?','ZZZZ'],['מה דעתך על iren','IREN']])assert.equal(questionAsset(q)?.split(':').at(-1),s,q);
 for(const q of ['מה זה ATR?','מה ההבדל בין RSI ל-MACD?','מה דעתך על TSLA ו-AMD','תרגיל היפותטי: נתח TSLA','מה קורה בשוק היום'])assert.equal(questionAsset(q),null,q);
 assert.equal(sameChatAsset('NASDAQ:TSLA','TSLA'),true);assert.equal(sameChatAsset('TSLA','AMD'),false);
});
test('multiple candidates route to the scanner rather than a single chart',()=>{
 for(const q of ['אני רוצה שתתן לי שלוש מניות לשורט או לונג','תמצא לי 3 מניות ללונג או שורט','give me three stocks for long or short'])assert.deepEqual(stockDiscoveryIntent(q),{limit:3,side:'any'});
 assert.deepEqual(stockDiscoveryIntent('תן לי חמש מניות לשורט'),{limit:5,side:'short'});
 assert.deepEqual(stockDiscoveryIntent('find 2 stocks for long'),{limit:2,side:'long'});
 for(const q of ['מה ההבדל בין לונג לשורט','תסביר איך למצוא מניות ללונג','דוגמה היפותטית: תן לי שלוש מניות','מה דעתך על TSLA'])assert.equal(stockDiscoveryIntent(q),null,q);
});
