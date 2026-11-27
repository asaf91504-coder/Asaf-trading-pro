// Conservative output checks, not a semantic proof or general language detector.
const scripts={he:/\p{Script=Hebrew}/gu,ar:/\p{Script=Arabic}/gu,ru:/\p{Script=Cyrillic}/gu,zh:/\p{Script=Han}/gu,ja:/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu};
const normalized=text=>String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
const signature=text=>normalized(text).replace(/[^\p{L}\p{N}]/gu,'');
const brands=new Set(['Nvidia','NVIDIA','OpenAI','Apple','Microsoft','Amazon','Google','Alphabet','Meta','Anthropic','Tesla','Bloomberg','Reuters','Blackstone','JPMorgan','Goldman','Sachs','Morgan','Stanley','Intel','AMD','Broadcom','Qualcomm','Palantir','CoreWeave','Oracle','Netflix','Spotify','Coinbase','Bitcoin','Ethereum']);
const identifiers=new Set(['AI','AAPL','MSFT','NVDA','TSLA','GOOGL','GOOG','AMZN','META','AMD','INTC','PLTR','CRWV','WSJ','CNBC','BBC','SRT','LBO','IPO','ETF','GDP','CPI','ECB','BOE','FED','SEC','NYSE','NASDAQ','BTC','ETH','USD','EUR','JPY','BOJ','EU','UK','US','USA','BBVA','HSBC','UBS','IBM','TSMC','ARM','ASML']);
function withoutSharedNames(title,original){
 const words=String(original).match(/\b[A-Za-z][A-Za-z0-9.-]*\b/g)||[];
 // Title Case alone is not evidence of a name: "Shares Rise" must stay in the
 // prose count. Allow only known brands and a bounded set of explicit tickers/financial acronyms.
 const names=new Set(words.filter(word=>brands.has(word)||identifiers.has(word)));
 return String(title).replace(/\b[A-Za-z][A-Za-z0-9.-]*\b/g,word=>names.has(word)?'':word);
}
const digits=text=>String(text).normalize('NFKC').replace(/[٠-٩۰-۹०-९]/gu,c=>String(c.codePointAt(0)-(c>='०'&&c<='९'?0x966:c>='۰'&&c<='۹'?0x6f0:0x660))).replace(/٫/gu,'.').replace(/٬/gu,',').replace(/٪/gu,'%').replace(/−/gu,'-');
const scales=[
 ['trillion|טריליון|trillions|trillionen|billionen|billon(?:es)?|trilhao|trilhoes|триллион(?:а|ов)?|تريليون|兆',1e12],
 ['billion|מיליארד|billions|milliard(?:s|en|e)?|mil millones|mil milhoes|bilhao|bilhoes|миллиард(?:а|ов)?|مليار',1e9],
 ['million|מיליון|millions|millionen|millones|milhao|milhoes|миллион(?:а|ов)?|مليون',1e6],
 ['亿|億',1e8],['万|萬',1e4],['thousand|אלף|אלפים|tausend|mille|mil|тысяч(?:а|и)?|ألف',1e3]
];
const scalePattern=scales.map(([s])=>'(?:'+s+')').join('|');
function scaleFor(term,language){
 if(language==='de'&&/^billion(?:en)?$/iu.test(term))return 1e12;
 if(language==='de'&&/^trillion(?:en)?$/iu.test(term))return 1e18;
 if(language==='fr'&&/^billion(?:s)?$/iu.test(term))return 1e12;
 return scales.find(([pattern])=>new RegExp('^(?:'+pattern+')$','iu').test(term))?.[1];
}
const suffixPattern='(?:'+scalePattern+'|basis[ -]?points?|bps|bp|נקודות?\\s+בסיס|אחוז(?:ים)?|percent(?:age)?|por ciento|prozent|pour cent|процент(?:а|ов)?|%)';
function parsedNumber(raw,language){
 const s=raw.replace(/[\s\u00a0\u202f'’]/gu,''),commaDecimal=['de','es','pt','fr','ru'].includes(language);
 const decimal=commaDecimal?',':'.',group=commaDecimal?'.':',';
 const split=s.split(decimal);if(split.length>2||split[1]!==undefined&&!/^\d+$/.test(split[1]))return [NaN];
 let integer=split[0];
 if(integer.includes(group)){
  const groups=integer.replace(/^[+-]/,'').split(group);
  if(!/^\d{1,3}$/.test(groups[0])||groups.slice(1).some(part=>!/^\d{3}$/.test(part)))return [NaN];
  integer=integer.split(group).join('');
 }
 if(!/^[+-]?\d+$/.test(integer))return [NaN];
 return [Number(integer+(split[1]!==undefined?'.'+split[1]:''))];
}
const currencyTerms=[
 ['usd|米ドル|美元|us\\$|u\\.s\\. dollars?|דולר(?:ים)? אמריקאי(?:ים)?',['USD']],['cad|c\\$|ca\\$|canadian dollars?|דולר(?:ים)? קנדי(?:ים)?',['CAD']],['aud|a\\$|au\\$|australian dollars?|דולר(?:ים)? אוסטרלי(?:ים)?',['AUD']],['hkd|hk\\$|hong kong dollars?',['HKD']],
 ['eur|€|euros?|אירו|יורו|ユーロ|欧元|歐元|евро|يورو',['EUR']],['gbp|£|pounds?(?: sterling)?|ליש["״]?ט',['GBP']],['jpy|yen|ין יפני|日元|日圓',['JPY']],['cny|rmb|yuan|יואן|人民币|人民幣',['CNY']],['ils|₪|shekels?|שקל(?:ים)?',['ILS']],
 ['\\$|dollars?|dolares|דולר(?:ים)?|ドル|доллар(?:а|ов)?|دولار(?:ات)?',['USD','CAD','AUD','HKD','SGD','NZD']],['¥|￥',['JPY','CNY']]
];
const currencyPattern=currencyTerms.map(([p])=>'(?:'+normalized(p)+')').join('|');
function currencyForNumber(text,start,end){
 const before=text.slice(Math.max(0,start-48),start),after=text.slice(end,end+48);
 const prefix=new RegExp('(?<![\\p{L}\\p{N}])('+currencyPattern+')\\s*$','iu').exec(before);
 const suffix=new RegExp('^\\s*(?:(?:de|of)\\s+)?('+currencyPattern+')(?![\\p{L}\\p{N}])','iu').exec(after);
 const token=prefix?.[1]||suffix?.[1];
 return token?currencyTerms.find(([pattern])=>new RegExp('^(?:'+normalized(pattern)+')$','iu').test(token))?.[1]:null;
}
const monthGroups=[['jan','january','januar','enero','janvier','janeiro','января','ינואר'],['feb','february','februar','febrero','février','fevrier','fevereiro','февраля','פברואר'],['mar','march','märz','marz','marzo','mars','março','marco','марта','מרץ'],['apr','april','abril','avril','апреля','אפריל'],['may','mai','mayo','maio','мая','מאי'],['jun','june','juni','junio','juin','junho','июня','יוני'],['jul','july','juli','julio','juillet','julho','июля','יולי'],['aug','august','agosto','août','aout','августа','אוגוסט'],['sep','sept','september','septiembre','septembre','setembro','сентября','ספטמבר'],['oct','october','oktober','octubre','octobre','outubro','октября','אוקטובר'],['nov','november','noviembre','novembre','novembro','ноября','נובמבר'],['dec','december','dezember','diciembre','décembre','decembre','dezembro','декабря','דצמבר']];
const monthNames=monthGroups.flat().sort((a,b)=>b.length-a.length).join('|');
function extractDates(text,language){
 const found=[];let value=text;
 value=value.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日?/gu,'$1-$2-$3');
 const add=(year,month,day)=>{const y=Number(year),m=Number(month),d=Number(day);if(m>=1&&m<=12&&d>=1&&d<=31){found.push(['date',y,m,d].join(':'));return true}return false};
 value=value.replace(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/gu,(all,y,m,d)=>add(y,m,d)?' ':all);
 value=value.replace(/(?<!\d)(\d{1,2})([-/.])(\d{1,2})\2(\d{4})(?!\d)/gu,(all,a,sep,b,y)=>{const us=language==='en'&&sep==='/'&&Number(a)<=12;return add(y,us?a:b,us?b:a)?' ':all});
 const monthIndex=name=>monthGroups.findIndex(group=>group.includes(name.toLowerCase()))+1;
 const textual=new RegExp('(?<![\\p{L}\\p{N}])(?:(\\d{1,2})[.]?\\s*(?:ב|de\\s+)?('+monthNames+')|('+monthNames+')\\.?\\s*(\\d{1,2}))(?:,?\\s+(?:de\\s+)?(\\d{4}))?(?![\\p{L}\\p{N}])','giu');
 value=value.replace(textual,(all,d1,m1,m2,d2,y)=>add(y||0,monthIndex(m1||m2),d1||d2)?' ':all);
 return {text:value,dates:found};
}
const hebrewCounts=new Map([['אחד',1],['אחת',1],['שני',2],['שתי',2],['שניים',2],['שתיים',2],['שלוש',3],['שלושה',3],['ארבע',4],['ארבעה',4],['חמש',5],['חמישה',5],['שש',6],['שישה',6],['שבע',7],['שבעה',7],['שמונה',8],['תשע',9],['תשעה',9],['עשר',10],['עשרה',10],['אחת עשרה',11],['אחד עשר',11],['שתים עשרה',12],['שנים עשר',12],['עשרים',20]]);
function normalizeCountWords(text,language){
 if(language!=='he')return text;
 const words=[...hebrewCounts.keys()].sort((a,b)=>b.length-a.length).join('|');
 const units='מניות|חברות|בנקים|קרנות|עסקאות|נכסים|ימים|שנים|מיליון|מיליארד|טריליון|אחוז(?:ים)?|נקודות?';
 const re=new RegExp('(?<![\\p{L}\\p{N}])(?:ו?[בלמכ]?)('+words+')(?=\\s+(?:'+units+')(?![\\p{L}\\p{N}]))','gu');
 return String(text).replace(re,(_,word)=>String(hebrewCounts.get(word)));
}
function numericFacts(text,language){
 const dated=extractDates(digits(normalizeCountWords(text,language)),language),facts=dated.dates.map(value=>[value]);
 let value=normalized(dated.text).replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(?=\d)/gu,'$1 ').replace(/(?<=\d)([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,' $1').replace(/([亿億万萬兆])/gu,' $1 ');
 value=value.replace(/(?:nasdaq|נאסד["״]?ק|s\s*&\s*p|סנ["״]?פ)[ -]*(?=\d)/giu,' index ');
 const compact={k:'thousand',m:'million',b:'billion',t:'trillion'};
 value=value.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)*)\s*([kmbt])(?![\p{L}\p{N}])/giu,(_,n,unit)=>n+' '+compact[unit.toLowerCase()]);
 value=value.replace(/([$€£¥])\s*(\d+(?:[.,]\d+)*)\s*([kmbt])(?![a-z])/giu,(_,currency,n,unit)=>currency+n+' '+compact[unit.toLowerCase()]);
 // Model/chip/ticker identifiers such as H100, GPT-4 and BRK.B are names, not
 // standalone quantities. Their identity is handled by prompting, not arithmetic.
 value=value.replace(/(?<![\p{L}\p{N}])[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?![\p{L}\p{N}])/gu,word=>/\d/u.test(word)?' ':word);
 if(language==='he')value=value.replace(/(?<![\p{L}\p{N}])(?:ו?[בכלמ])[-־]?(?=\d)/gu,' ');
 const re=new RegExp('(?<![\\p{L}\\p{N}])([+-]?\\d+(?:[.,]\\d+|[\\u00a0\\u202f\\x20]\\d{3}(?!\\d))*)\\s*('+suffixPattern+')?(?![\\p{L}\\p{N}])','giu');
 const occupied=[];
 for(const m of value.matchAll(re)){
  const suffix=m[2]||'',scale=scaleFor(suffix,language)||1;
  const basis=/^(?:basis[ -]?points?|bps|bp|נקודות?\s+בסיס)$/iu.test(suffix),percent=/^(?:%|אחוז(?:ים)?|percent(?:age)?|por ciento|prozent|pour cent|процент(?:а|ов)?)$/iu.test(suffix);
  const dimension=basis||percent?'rate:':'number:',factor=basis?1/10000:percent?1/100:scale;
  const currencies=!basis&&!percent?currencyForNumber(value,m.index,m.index+m[0].length):null;
  facts.push(parsedNumber(m[1],language).filter(Number.isFinite).flatMap(n=>(currencies||[null]).map(currency=>(currency?'money:'+currency+':':dimension)+Number((n*factor).toPrecision(12)))));occupied.push([m.index,m.index+m[0].length]);
 }
 // "a million dollars" and "מיליון דולר" are equivalent to "$1 million".
 const implicit=new RegExp('(?<![\\p{L}\\p{N}])(?:a\\s+|one\\s+|ב|כ|ל)?('+scalePattern+')(?![\\p{L}\\p{N}])','giu');
 for(const m of value.matchAll(implicit)){
  if(occupied.some(([start,end])=>m.index<end&&m.index+m[0].length>start))continue;
  // Plural scale words without a numeral describe an unspecified magnitude.
  if(/(?:s|en|es|а|ов)$/iu.test(m[1]))continue;
  const scale=scaleFor(m[1],language),currencies=currencyForNumber(value,m.index,m.index+m[0].length);if(scale)facts.push((currencies||[null]).map(currency=>(currency?'money:'+currency+':':'number:')+scale));
 }
 return facts;
}
function sameFacts(left,right){
 if(left.length!==right.length||left.length>80)return false;
 const matched=Array(right.length).fill(-1);
 function assign(i,seen){
  for(let j=0;j<right.length;j++)if(!seen.has(j)&&left[i].some(v=>right[j].includes(v))){seen.add(j);if(matched[j]<0||assign(matched[j],seen)){matched[j]=i;return true}}
  return false;
 }
 return left.every((_,i)=>assign(i,new Set()));
}
export function newsNumbersPreserved(title,original,language){return sameFacts(numericFacts(original,'en'),numericFacts(title,language))}
export function validNewsTitle(title,original,language){
 if(typeof title!=='string'||!title.trim()||title.length>1200)return false;
 if(!newsNumbersPreserved(title,original,language))return false;
 if(scripts[language]){
  const prose=withoutSharedNames(title,original),letters=prose.match(/\p{L}/gu)||[],target=prose.match(scripts[language])||[];
  return target.length>=(['zh','ja'].includes(language)?2:3)&&target.length/Math.max(1,letters.length)>=0.35;
 }
 if(language!=='en'&&/[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Han}]/u.test(title))return false;
 if(language==='en')return true;
 return signature(title)!==signature(original)||String(original).trim().split(/\s+/u).length<3;
}
