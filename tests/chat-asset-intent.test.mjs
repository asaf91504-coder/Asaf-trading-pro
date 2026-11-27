import test from 'node:test';
import assert from 'node:assert/strict';
import {questionAsset,sameChatAsset,stockDiscoveryIntent} from '../chat-asset-intent.mjs';
test('current question selects explicit stock or crypto independently of chart/history',()=>{
 for(const [q,s] of [['מה דעתך על TSLA','TSLA'],['מה קורה עם מניית ACMR','ACMR'],['ומה עם IREN?','IREN'],['מה דעתך על טסלה','TSLA'],['תנתח את אנבידיה','NVDA'],['מה דעתך על ביטקוין','BTCUSD'],['ומה עם אתריום?','ETHUSD'],['what about $ZZZZ?','ZZZZ'],['מה דעתך על iren','IREN'],['מה דעתך על ZZZZ','ZZZZ']])assert.equal(questionAsset(q)?.split(':').at(-1),s,q);
 for(const q of ['מה זה ATR?','מה ההבדל בין RSI ל-MACD?','מה דעתך על TSLA ו-AMD','תרגיל היפותטי: נתח TSLA','מה קורה בשוק היום'])assert.equal(questionAsset(q),null,q);
 assert.equal(sameChatAsset('NASDAQ:TSLA','TSLA'),true);assert.equal(sameChatAsset('TSLA','AMD'),false);
});
test('multiple candidates route to the scanner rather than a single chart',()=>{
 for(const q of ['אני רוצה שתתן לי שלוש מניות לשורט או לונג','תמצא לי 3 מניות ללונג או שורט','give me three stocks for long or short'])assert.deepEqual(stockDiscoveryIntent(q),{limit:3,side:'any'});
 assert.deepEqual(stockDiscoveryIntent('תן לי חמש מניות לשורט'),{limit:5,side:'short'});
 assert.deepEqual(stockDiscoveryIntent('find 2 stocks for long'),{limit:2,side:'long'});
 for(const q of ['מה ההבדל בין לונג לשורט','תסביר איך למצוא מניות ללונג','דוגמה היפותטית: תן לי שלוש מניות','מה דעתך על TSLA'])assert.equal(stockDiscoveryIntent(q),null,q);
});

test('natural stock requests, including the reported month-long request, use verified discovery',()=>{
 for(const q of [
  'תרשום לי 2 מניות להשקיע לטווח של חודש מניות לונג',
  'רשום לי שתי מניות ללונג',
  'תכתוב לי שתי מניות ללונג',
  'תציע לי שתי מניות ללונג',
  'תמליץ לי על שתי מניות ללונג',
  'מחפש שתי מניות ללונג',
  'צריך שתי מניות ללונג',
  '2 מניות ללונג לחודש',
  'list two stocks for long',
  'suggest two stocks for long',
  'recommend two stocks for long',
  'looking for two stocks for long'
 ])assert.deepEqual(stockDiscoveryIntent(q),{side:'long',limit:2},q);
 assert.deepEqual(stockDiscoveryIntent('תציע מניה ללונג'),{side:'long',limit:1});
 assert.deepEqual(stockDiscoveryIntent('suggest a stock for short'),{side:'short',limit:1});
 assert.deepEqual(stockDiscoveryIntent('עוד שתי מניות לשורט'),{side:'short',limit:2,more:true});
 for(const q of ['תסביר איך תמליץ על מניות','איך כותבים רשימת מניות','תרגיל היפותטי: תרשום לי 2 מניות ללונג','נתח את מניית TSLA','יש לי שתי מניות בתיק','write a guide about stocks','תן צ׳ק ליסט לפני כניסה למניה','כתוב לי מדריך על מניות','תן לי הסבר על מניות'])assert.equal(stockDiscoveryIntent(q),null,q);
});


test('a stock-selection goal routes discovery without requiring a particular verb',()=>{
 for(const q of ['מניות','מניות ללונג','שתי מניות להשקעה לחודש','מניות לשורט','אילו מניות כדאי לבדוק','איזה מניות אתה מציע','stocks to buy','long stocks'])assert.ok(stockDiscoveryIntent(q),q);
 for(const q of ['אני רוצה מניה TSLA ללונג','האם כדאי לקנות מניית NVDA','מה זה מניה','מה ההבדל בין לונג לשורט','how to buy stocks','תן צ׳ק ליסט לפני כניסה למניה'])assert.equal(stockDiscoveryIntent(q),null,q);
});
