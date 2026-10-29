import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChartCommand,validateChartActions,chartActionIndicators,chartActionPatterns,maxChartActions} from '../chat-chart-actions.mjs';

test('Bitcoin and Ethereum aliases select explicit CoinLore USD pairs without pretending to be stock symbols',()=>{
 for(const text of ['ביטקוין','bitcoin','BTC','BTCUSD','פתח $BTC','פתח BTC','פתח COINLORE:BTCUSD','פתח סימול COINLORE:BTCUSD'])assert.deepEqual(parseChartCommand(text).actions,[{type:'symbol',symbol:'COINLORE:BTCUSD'}],text);
 for(const text of ['אתריום','ethereum','ETH','ETHUSD','פתח $ETH','פתח COINLORE:ETHUSD'])assert.deepEqual(parseChartCommand(text).actions,[{type:'symbol',symbol:'COINLORE:ETHUSD'}],text);
 assert.deepEqual(parseChartCommand('פתח ביטקוין והוסף MA20').actions,[{type:'symbol',symbol:'COINLORE:BTCUSD'},{type:'indicator',indicator:'MA20',enabled:true}]);
 assert.deepEqual(parseChartCommand('פתח NASDAQ:BTC').actions,[{type:'symbol',symbol:'NASDAQ:BTC'}]);
 assert.deepEqual(parseChartCommand('פתח Coinbase').actions,[{type:'symbol',symbol:'NASDAQ:COIN'}]);
 assert.equal(parseChartCommand('פתח BTC ו ETH').unresolvedSymbol,true);
 assert.doesNotThrow(()=>validateChartActions([{type:'symbol',symbol:'COINLORE:ETHUSD'}]));
 assert.deepEqual(parseChartCommand('MA20').actions,[]);
});

const actions=text=>parseChartCommand(text).actions;
test('Hebrew multi-intent request resolves known company and distinct chart actions',()=>{
 assert.deepEqual(actions('פתח אפל ותוסיף ממוצע 20 ותסמן תמיכות והתנגדויות וקווי מגמה'),[
  {type:'symbol',symbol:'NASDAQ:AAPL'}, {type:'indicator',indicator:'MA20',enabled:true}, {type:'levels',kind:'both'}, {type:'trendlines'}
 ]);
});
test('explicit exchange has precedence over alias exchange; exchange-less token is deduplicated',()=>{
 assert.deepEqual(actions('פתח NYSE:AAPL'),[{type:'symbol',symbol:'NYSE:AAPL'}]);
 assert.deepEqual(actions('פתח $AAPL של אפל'),[{type:'symbol',symbol:'NASDAQ:AAPL'}]);
 assert.deepEqual(actions('open NYSEARCA:SPY'),[{type:'symbol',symbol:'NYSEARCA:SPY'}]);
});
test('unlisted stocks require explicit ticker syntax or clear ticker request, never fabricated company mapping',()=>{
 assert.deepEqual(actions('תפתח מניית SHOP'),[{type:'symbol',symbol:'SHOP'}]);
 assert.deepEqual(actions('פתח SHOP'),[{type:'symbol',symbol:'SHOP'}]);
 assert.deepEqual(actions('$BRK.B'),[{type:'symbol',symbol:'BRK.B'}]);
 const unknown=parseChartCommand('תפתח מניית זברה ותסמן תמיכות');
 assert.deepEqual(unknown.actions,[]);assert.equal(unknown.unresolvedSymbol,true);assert.match(unknown.message,/סימול מפורש/);
});
test('multiple stocks produce clarification rather than manipulating a possibly wrong chart',()=>{
 const result=parseChartCommand('פתח טסלה ואפל ותוסיף MA20');
 assert.deepEqual(result.actions,[]);assert.equal(result.unresolvedSymbol,true);assert.match(result.message,/מניה אחת/);
});
test('ordinary educational questions do not mutate chart',()=>{
 for(const text of ['מה זה RSI','מה ההבדל בין MA20 ל MA50','תסביר לי על תמיכות והתנגדויות','what is cup and handle?','שלום'])assert.equal(parseChartCommand(text).recognized,false,text);
});
test('negated mutation is blocked rather than reversing or partially executing request',()=>{
 for(const text of ['אל תוסיף MA20','תפתח אפל אבל אל תסיר RSI','do not remove RSI']){
  const result=parseChartCommand(text);assert.deepEqual(result.actions,[]);assert.equal(result.recognized,true);assert.match(result.message,/לא לבצע/);
 }
});
test('indicator enable/disable is scoped to its own requested operation',()=>{
 assert.deepEqual(actions('הסר RSI ותוסיף MA50 וסמן תמיכות'),[
  {type:'indicator',indicator:'MA50',enabled:true},{type:'indicator',indicator:'RSI14',enabled:false},{type:'levels',kind:'support'}
 ]);
 assert.deepEqual(actions('תוריד RSI'),[{type:'indicator',indicator:'RSI14',enabled:false}]);
 assert.deepEqual(actions('תוסיף MA20 ואז תסיר MA20'),[{type:'indicator',indicator:'MA20',enabled:false}]);
});
test('supported indicator list maps only existing controls, with unsupported averages explained',()=>{
 const result=parseChartCommand('הוסף EMA50 MA150 RSI14 MACD VWAP ואיצימוקו וגם MA21');
 assert.deepEqual(result.actions.filter(a=>a.type==='indicator').map(a=>a.indicator),['MA150','EMA50','RSI14','MACD','VWAP','Ichimoku']);
 assert.match(result.message,/MA21/);assert.ok(!result.actions.some(a=>a.indicator==='MA21'));
 assert.deepEqual(actions('add EMA50'),[{type:'indicator',indicator:'EMA50',enabled:true}]);
});
test('inverse head and shoulders is distinct from regular and cup and handle in Hebrew',()=>{
 assert.deepEqual(actions('תסמן אינוורס הנד אנד שולדר וקאפ אנדהנדל'),[
  {type:'pattern',pattern:'inverse_head_shoulders'},{type:'pattern',pattern:'cup_handle'}
 ]);
 assert.deepEqual(actions('סמן ראש וכתפיים הפוך ודאבל בוטום'),[
  {type:'pattern',pattern:'inverse_head_shoulders'},{type:'pattern',pattern:'double_bottom'}
 ]);
});
test('all patterns is declarative and no certainty/detection claim is generated by parser',()=>{
 assert.deepEqual(actions('find all chart patterns'),[{type:'pattern',pattern:'all'}]);
 assert.deepEqual(actions('סמן תבניות גרפיות'),[{type:'pattern',pattern:'all'}]);
 assert.deepEqual(actions('draw head and shoulders and double top'),[{type:'pattern',pattern:'head_shoulders'},{type:'pattern',pattern:'double_top'}]);
});
test('chart styles use existing renderer identifiers and avoid hollow being interpreted as candles',()=>{
 assert.deepEqual(actions('החלף לגרף קו'),[{type:'style',style:'line'}]);
 assert.deepEqual(actions('הצג נרות חלולים'),[{type:'style',style:'hollow'}]);
 assert.deepEqual(actions('switch to Heikin Ashi'),[{type:'style',style:'heikin'}]);
});
test('clearing markings is a specific AI-only action and never a generic drawing wipe',()=>{
 assert.deepEqual(actions('נקה סימוני AI'),[{type:'clear_annotations'}]);
 assert.deepEqual(actions('remove AI annotations'),[{type:'clear_annotations'}]);
 assert.deepEqual(actions('תמחק את כל הסימונים'),[{type:'clear_annotations'}]);
});
test('empty, non-text and oversized values never create actions',()=>{
 for(const text of ['',null,{},'x'.repeat(6001)])assert.deepEqual(parseChartCommand(text).actions,[]);
});
test('action validator accepts every allowlisted operation and returns sanitized copies',()=>{
 const input=[{type:'symbol',symbol:'NASDAQ:AAPL'},{type:'levels',kind:'both'},{type:'style',style:'candles'},{type:'trendlines'},{type:'clear_annotations'}];
 const result=validateChartActions(input);assert.deepEqual(result,input);assert.notEqual(result,input);assert.notEqual(result[0],input[0]);assert.deepEqual(validateChartActions([]),[]);
 for(const indicator of chartActionIndicators)assert.doesNotThrow(()=>validateChartActions([{type:'indicator',indicator,enabled:true}]));
 for(const pattern of chartActionPatterns)assert.doesNotThrow(()=>validateChartActions([{type:'pattern',pattern}]));
});
test('validator rejects unknown operation, fields, selectors, values and malformed symbols atomically',()=>{
 const invalid=[null,{},[null],[[]],[{type:'eval',code:'alert(1)'}],[{type:'__proto__'}],[{type:'trendlines',selector:'body'}],[{type:'indicator',indicator:'MA21',enabled:true}],[{type:'indicator',indicator:'MA20',enabled:'yes'}],[{type:'style',style:'script'}],[{type:'levels',kind:'all'}],[{type:'pattern',pattern:'certain_future'}],[{type:'symbol',symbol:'javascript:alert'}],[{type:'symbol',symbol:'AAPL;fetch()'}],[{type:'symbol',symbol:'aapl'}],[{type:'clear_annotations',allUserDrawings:true}]];
 for(const value of invalid)assert.throws(()=>validateChartActions(value),JSON.stringify(value));
 assert.throws(()=>validateChartActions([{type:'trendlines'},{type:'levels',kind:'bad'}]));
 assert.throws(()=>validateChartActions(Array.from({length:maxChartActions+1},()=>({type:'trendlines'}))));
});
test('general analysis passes through to real model rather than being swallowed by empty control plan',()=>{
 for(const text of ['תנתח את הגרף ואת המגמה','נתח את הגרף הנוכחי','תנתח מגמה','analyze the chart']){
  const result=parseChartCommand(text);assert.deepEqual(result.actions,[]);assert.equal(result.recognized,false,text);
 }
});
test('standalone indicator and ordinary English word never become a stock symbol',()=>{
 for(const text of ['MA20','MA50','RSI','RSI14','MACD','VWAP','hello','Hello','HELLO','OK','thanks']){
  const result=parseChartCommand(text);assert.deepEqual(result.actions,[]);assert.equal(result.recognized,false,text);
 }
 assert.deepEqual(actions('apple'),[{type:'symbol',symbol:'NASDAQ:AAPL'}]);
 assert.deepEqual(actions('aapl'),[{type:'symbol',symbol:'NASDAQ:AAPL'}]);
});
test('user transliterations cup and inverse head/shoulders are recognized without certainty claims',()=>{
 assert.deepEqual(actions('סמן קאפ אנדהנדל ואינוורס הנד אל שולדר'),[{type:'pattern',pattern:'inverse_head_shoulders'},{type:'pattern',pattern:'cup_handle'}]);
 assert.deepEqual(actions('פתח פלנטיר'),[{type:'symbol',symbol:'PLTR'}]);
});
