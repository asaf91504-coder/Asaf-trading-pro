import {chartStyles} from './chart-styles.mjs';

// Declarative chart controls only. No executable code, selectors, URLs or trading orders.
export const chartActionIndicators=Object.freeze(['MA20','MA150','EMA50','RSI14','BB20','MACD','ATR14','MA50','MA100','MA200','Stochastic','OBV','ADX14','Supertrend','VWAP','Ichimoku','VolumeProfile']);
export const chartActionPatterns=Object.freeze(['cup_handle','inverse_head_shoulders','head_shoulders','double_bottom','double_top','all']);
export const maxChartActions=20;
const indicatorSet=new Set(chartActionIndicators),patternSet=new Set(chartActionPatterns);
const symbolRE=/^(?:(?:NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|OTC):)?[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?$/;
const actionKeys={symbol:['type','symbol'],indicator:['type','indicator','enabled'],style:['type','style'],levels:['type','kind'],trendlines:['type'],pattern:['type','pattern'],clear_annotations:['type']};

export function validateChartActions(value){
 if(!Array.isArray(value)||value.length>maxChartActions)throw Error('רשימת פעולות הגרף אינה תקינה או ארוכה מדי.');
 return value.map(action=>{
  if(!action||typeof action!=='object'||Array.isArray(action)||![Object.prototype,null].includes(Object.getPrototypeOf(action))||!Object.hasOwn(actionKeys,action.type))throw Error('פעולת גרף אינה מוכרת.');
  const keys=actionKeys[action.type];if(Object.keys(action).length!==keys.length||!keys.every(key=>Object.hasOwn(action,key)))throw Error('שדות פעולת הגרף אינם תקינים.');
  if(action.type==='symbol'&&(typeof action.symbol!=='string'||!symbolRE.test(action.symbol)))throw Error('סימול המניה אינו תקין.');
  if(action.type==='indicator'&&(!indicatorSet.has(action.indicator)||typeof action.enabled!=='boolean'))throw Error('המדד או מצב התצוגה אינם תקינים.');
  if(action.type==='style'&&!chartStyles.includes(action.style))throw Error('סגנון הגרף אינו מוכר.');
  if(action.type==='levels'&&!['support','resistance','both'].includes(action.kind))throw Error('סוג רמות המחיר אינו מוכר.');
  if(action.type==='pattern'&&!patternSet.has(action.pattern))throw Error('סוג התבנית אינו מוכר.');
  return Object.fromEntries(keys.map(key=>[key,action[key]]));
 });
}

const companies=[
 ['NASDAQ:AAPL',['אפל','apple','aapl']],['NASDAQ:MSFT',['מיקרוסופט','microsoft','msft']],
 ['NASDAQ:NVDA',['אנבידיה','אנווידיה','נבידיה','nvidia','nvda']],['NASDAQ:TSLA',['טסלה','tesla','tsla']],
 ['NASDAQ:GOOGL',['גוגל','אלפבית','google','alphabet','googl']],['NASDAQ:AMZN',['אמזון','amazon','amzn']],
 ['NASDAQ:META',['מטא','פייסבוק','meta','facebook']],['NASDAQ:NFLX',['נטפליקס','netflix','nflx']],
 ['NASDAQ:AMD',['amd','איי אם די']],['NASDAQ:INTC',['אינטל','intel','intc']],['PLTR',['פלנטיר','palantir','pltr']],
 ['NASDAQ:COIN',['קוין בייס','קוינבייס','coinbase','coin']],['NYSE:DIS',['דיסני','disney','dis']],
 ['NYSE:BA',['בואינג','boeing','ba']],['NYSE:JPM',['גיי פי מורגן','ג׳יי פי מורגן','jpmorgan','jpm']],
 ['NYSE:V',['ויזה','visa']],['NYSE:MA',['מאסטרקארד','mastercard']],['NYSE:WMT',['וולמארט','walmart','wmt']],
 ['NYSE:KO',['קוקה קולה','קוקה-קולה','coca cola','coca-cola']],['NYSE:NKE',['נייקי','nike','nke']],
 ['NYSE:BABA',['עליבאבא','אליבאבא','alibaba','baba']],['NASDAQ:ADBE',['אדובי','adobe','adbe']],
 ['NASDAQ:PYPL',['פייפאל','paypal','pypl']],['NASDAQ:HOOD',['רובינהוד','robinhood','hood']],
 ['NYSE:UBER',['אובר','uber']],['NYSE:SPOT',['ספוטיפיי','spotify','spot']],
 ['NASDAQ:AVGO',['ברודקום','broadcom','avgo']],['NYSE:TSM',['טי אס אם סי','tsmc','tsm']],
 ['NASDAQ:QQQ',['qqq']],['NYSEARCA:SPY',['spy']],['NYSEARCA:IWM',['iwm']]
];
const escapeRE=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const boundary='[\\p{L}\\p{N}_]';
function termRE(term){return new RegExp('(?<!'+boundary+')(?:ו|ב|ל|של)?'+escapeRE(term)+'(?!'+boundary+')','iu')}
const companyMatchers=companies.map(([symbol,aliases])=>({symbol,matchers:aliases.map(termRE)}));
const normalize=text=>text.normalize('NFKC').replace(/[״“”]/g,'"').replace(/[׳’]/g,"'").replace(/\s+/g,' ').trim();
const commandRE=/(?:פתח|תפתח|הצג|תציג|תראה|תביא|תטען|טען|נתח|תנתח|נתחי|סמן|תסמן|שרטט|תשרטט|צייר|תצייר|הוסף|תוסיף|שים|תשים|הפעל|תפעיל|כבה|תכבה|הסר|תסיר|הסתר|תסתיר|הורד|תוריד|מחק|תמחק|נקה|תנקה|מצא|תמצא|זהה|תזהה|חפש|תחפש|בדוק|תבדוק|החלף|תחליף|שנה|תשנה|תעביר|תעשה|עשה|אני רוצה|אפשר (?:לראות|להוסיף|להציג|לסמן)|\b(?:open|show|load|analy[sz]e|draw|mark|add|enable|disable|remove|hide|clear|find|detect|check|switch|set|plot)\b)/iu;
const explanatoryRE=/^(?:מה (?:זה|הם|היא|אומר)|מה ההבדל|איך (?:מחשבים|מזהים|עובד)|הסבר|תסביר|\b(?:what (?:is|are|does)|explain|how (?:does|do|to))\b)/iu;
const offRE=/(?:הסר|תסיר|הסתר|תסתיר|כבה|תכבה|תוריד|הורד|בלי|ללא|\b(?:remove|hide|disable|off|without)\b)/iu;
const negatedRE=/(?:אל\s+(?:ת|ל)|לא\s+(?:תוסיף|להוסיף|תסמן|לסמן|תפתח|לפתוח|תשנה|לשנות|תסיר|להסיר)|\b(?:do not|don't|dont|never)\b)/iu;
const indicatorMatchers=[
 ['MA20',/(?<![\w])(?:sma\s*20|ma\s*20|ממוצע(?:\s+נע)?\s*(?:של\s*)?20)(?!\d)/iu],
 ['MA50',/(?<![\w])(?:sma\s*50|ma\s*50|ממוצע(?:\s+נע)?\s*(?:של\s*)?50)(?!\d)/iu],
 ['MA100',/(?<![\w])(?:sma\s*100|ma\s*100|ממוצע(?:\s+נע)?\s*(?:של\s*)?100)(?!\d)/iu],
 ['MA150',/(?<![\w])(?:sma\s*150|ma\s*150|ממוצע(?:\s+נע)?\s*(?:של\s*)?150)(?!\d)/iu],
 ['MA200',/(?<![\w])(?:sma\s*200|ma\s*200|ממוצע(?:\s+נע)?\s*(?:של\s*)?200)(?!\d)/iu],
 ['EMA50',/\bema\s*50\b|ממוצע\s+מעריכי\s*50/iu],['RSI14',/\brsi(?:\s*14)?\b/iu],
 ['BB20',/\b(?:bb\s*20|bollinger(?:\s*20)?)\b|בולינגר/iu],['MACD',/\bmacd\b|מאקד/iu],
 ['ATR14',/\batr(?:\s*14)?\b/iu],['Stochastic',/\bstoch(?:astic)?\b|סטוכסטי(?:ק)?/iu],
 ['OBV',/\bobv\b/iu],['ADX14',/\badx(?:\s*14)?\b/iu],['Supertrend',/\bsuper\s*trend\b|סופרטרנד|סופר טרנד/iu],
 ['VWAP',/\bvwap\b/iu],['Ichimoku',/\bichimoku\b|איצימוקו|איצ'ימוקו/iu],
 ['VolumeProfile',/\bvolume\s*profile\b|פרופיל\s*(?:מחזור|נפח)/iu]
];
const unsupportedAverageRE=/(?:\b(?:sma|ma|ema)\s*(\d+)\b|ממוצע(?:\s+(?:נע|מעריכי))?\s*(?:של\s*)?(\d+))/giu;
const patternMatchers=[
 ['inverse_head_shoulders',/(?:inverse|inverted)\s+head\s*(?:and|&)\s*shoulders|אינוורס\s+(?:הד|הנד)\s*(?:אנד|אנדה|אנ|אל)\s*שולדר(?:ס)?|ראש\s*וכתפיים\s*(?:הפוך|הפוכים|הפוכה)/iu],
 ['head_shoulders',/head\s*(?:and|&)\s*shoulders|(?:הד|הנד)\s*(?:אנד|אנדה|אנ|אל)\s*שולדר(?:ס)?|ראש\s*וכתפיים/iu],
 ['cup_handle',/cup\s*(?:and|&)\s*handle|קאפ\s*(?:אנד|אנדה|אנ)\s*ה?נדל|ספל\s*וידית/iu],
 ['double_bottom',/double\s*bottom|דאבל\s*בוטום|תחתית\s*כפולה/iu],
 ['double_top',/double\s*top|דאבל\s*טופ|פסגה\s*כפולה|תקרה\s*כפולה/iu]
];
function controlContext(text,index){
 const prefix=text.slice(0,index),matches=[...prefix.matchAll(new RegExp(commandRE.source,'giu'))];
 const boundaryIndex=Math.max(prefix.lastIndexOf(';'),prefix.lastIndexOf('.'),prefix.lastIndexOf('\n'));
 return prefix.slice(Math.max(boundaryIndex+1,matches.at(-1)?.index??0));
}
function uniqueActions(actions){
 const output=[];for(const action of actions){const key=action.type==='indicator'?'indicator:'+action.indicator:action.type==='pattern'?'pattern:'+action.pattern:action.type;const index=output.findIndex(item=>item.key===key);if(index>=0)output.splice(index,1);output.push({key,action})}return output.map(item=>item.action);
}

/** Parse common explicit chart requests. Unknown language can be sent to the model;
 * model-proposed controls must pass validateChartActions before execution.
 * recognized=false means ordinary conversation. Ambiguous symbols return no actions.
 */
export function parseChartCommand(value,{currentSymbol=''}={}){
 if(typeof value!=='string'||value.length>6000)return {actions:[],recognized:false,message:'הבקשה ארוכה מדי או אינה טקסט.'};
 const text=normalize(value);if(!text)return {actions:[],recognized:false,message:''};
 const command=commandRE.test(text);
 const reservedBare=new Set([...chartActionIndicators.map(id=>id.toUpperCase()),'RSI','ATR','ADX','AI','CSV','OHLC','OHLCV','OK','HELLO','HI','YES','NO','THANKS']);
 const bareKnownCompany=companies.some(([,aliases])=>aliases.some(alias=>alias.toLowerCase()===text.toLowerCase()));
 const bareSymbol=bareKnownCompany||/^(?:NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|OTC):[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?$/i.test(text)||(/^\$?[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?$/.test(text)&&(!reservedBare.has(text)||text.startsWith('$')));
 if(explanatoryRE.test(text)&&!/(?:ואז|וגם|ולאחר|ואחר כך|\band then\b)/iu.test(text))return {actions:[],recognized:false,message:''};
 const symbols=new Set();
 for(const match of text.matchAll(/\b(NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|OTC):([A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?)\b/giu))symbols.add(match[1].toUpperCase()+':'+match[2].toUpperCase());
 for(const match of text.matchAll(/\$([A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?)\b/giu))symbols.add(match[1].toUpperCase());
 for(const company of companyMatchers)if(company.matchers.some(re=>re.test(text))){const ticker=company.symbol.split(':').at(-1);if(![...symbols].some(s=>s.includes(':')&&s.endsWith(':'+ticker)))symbols.add(company.symbol)}
 for(const match of text.matchAll(/(?:מני(?:ה|ית|ת)|סימול|טיקר|גרף\s+של|\b(?:ticker|stock|chart\s+(?:of|for))\b)\s*[:]?\s*\$?([A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?)(?![\p{L}\p{N}_])/gu))symbols.add(match[1].toUpperCase());
 for(const match of text.matchAll(/(?:פתח|תפתח|טען|תטען|נתח|תנתח|\b(?:open|load|analy[sz]e)\b)\s+(?:את\s+)?([A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?)(?![\p{L}\p{N}_:])/gu)){if(!indicatorSet.has(match[1])&&!['AI','OHLC','OHLCV','CSV'].includes(match[1]))symbols.add(match[1])}
 if(bareSymbol&&!symbols.size)symbols.add(text.replace(/^\$/,'').toUpperCase());
 // Same ticker with/without an explicit exchange is one request; prefer exchange.
 for(const symbol of [...symbols])if(!symbol.includes(':')&&[...symbols].some(other=>other.endsWith(':'+symbol)))symbols.delete(symbol);
 if(symbols.size>1)return {actions:[],recognized:true,message:'מצאתי כמה מניות בבקשה. בחר מניה אחת לגרף הפעיל כדי שאפעל על הנתונים הנכונים.',unresolvedSymbol:true};
 const symbol=[...symbols][0];
 const stockRequest=/(?:מני(?:ה|ית|ת)|טיקר|סימול|גרף\s+של|\b(?:stock|ticker|chart\s+(?:of|for))\b)/iu.test(text)||bareSymbol;
 if(command&&stockRequest&&!symbol&&!/(?:המניה|הגרף|הנוכחי|הפתוח|הזו|הזאת|this|current)/iu.test(text))return {actions:[],recognized:true,message:'לא זיהיתי בוודאות את המניה. כתוב סימול מפורש, למשל $AAPL או NASDAQ:AAPL.',unresolvedSymbol:true};
 if(!command&&!bareSymbol)return {actions:[],recognized:false,message:''};
 if(negatedRE.test(text))return {actions:[],recognized:true,message:'הבקשה כוללת הוראה לא לבצע פעולה. כתוב בנפרד את הפעולות שברצונך לבצע כדי שלא אשנה את הגרף בטעות.'};
 const actions=[],notes=[];
 if(symbol)actions.push({type:'symbol',symbol});
 const clear=/(?:נקה|תנקה|מחק|תמחק|הסר|תסיר|\b(?:clear|remove|delete)\b).{0,30}(?:סימונים|סימוני|סימון|שרטוטי\s*(?:ai|הבינה)|הערות\s*(?:ai|הבינה)|\b(?:ai\s*)?(?:annotations|markings)\b)/iu.test(text);
 if(clear)actions.push({type:'clear_annotations'});
 for(const [indicator,re] of indicatorMatchers)for(const match of text.matchAll(new RegExp(re.source,'giu')))actions.push({type:'indicator',indicator,enabled:!offRE.test(controlContext(text,match.index))});
 for(const match of text.matchAll(unsupportedAverageRE)){
  const n=Number(match[1]||match[2]),raw=match[0].toLowerCase(),supported=raw.includes('ema')||raw.includes('מעריכי')?n===50:[20,50,100,150,200].includes(n);
  if(!supported)notes.push('הממוצע '+match[0]+' אינו זמין כרגע. זמינים MA20/50/100/150/200 ו־EMA50.');
 }
 const styleMatchers=[['heikin',/heikin(?:\s+ashi)?|הייקין(?:\s+אשי)?/iu],['hollow',/hollow\s*candles?|נרות\s+חלולים/iu],['candles',/candlesticks?|נרות/iu],['line',/(?:גרף|תצוגת?|סגנון)\s*קו(?:וי)?|line\s*chart/iu],['area',/area\s*chart|גרף\s*שטח/iu],['bars',/ohlc\s*bars?|גרף\s*עמודות/iu],['baseline',/\bbaseline\b|קו\s*בסיס/iu]];
 for(const [style,re] of styleMatchers)if(re.test(text)){actions.push({type:'style',style});break}
 const supportMatch=/(?:תמיכ(?:ה|ות)|\bsupport(?:s)?\b)/iu.exec(text),resistanceMatch=/(?:התנגדו(?:ת|יות)|\bresistance(?:s)?\b)/iu.exec(text);
 const support=supportMatch&&!offRE.test(controlContext(text,supportMatch.index)),resistance=resistanceMatch&&!offRE.test(controlContext(text,resistanceMatch.index));
 if(!clear&&(support||resistance))actions.push({type:'levels',kind:support&&resistance?'both':support?'support':'resistance'});
 const trendMatch=/(?:קווי?\s*מגמה|\btrend\s*lines?\b)/iu.exec(text);
 if(!clear&&trendMatch&&!offRE.test(controlContext(text,trendMatch.index)))actions.push({type:'trendlines'});
 let inverse=false;
 if(!clear)for(const [pattern,re] of patternMatchers){const match=re.exec(text);if(match&&!offRE.test(controlContext(text,match.index))){if(pattern==='head_shoulders'&&inverse)continue;actions.push({type:'pattern',pattern});if(pattern==='inverse_head_shoulders')inverse=true}}
 if(!clear&&!offRE.test(text)&&!actions.some(a=>a.type==='pattern')&&/(?:כל\s*התבניות|תבניות\s*(?:גרפיות|טכניות)?|\ball\s*(?:chart\s*)?patterns\b)/iu.test(text))actions.push({type:'pattern',pattern:'all'});
 const result=validateChartActions(uniqueActions(actions));
 return {actions:result,recognized:!!(result.length||notes.length||bareSymbol),message:notes.join(' '),...(!symbol&&currentSymbol&&symbolRE.test(currentSymbol)?{currentSymbol}:{})};
}
