import test from 'node:test';
import assert from 'node:assert/strict';
import {validNewsTitle,newsNumbersPreserved} from '../server/news-title-validation.mjs';
import {translatedTitleValid,translateNews} from '../server/news-language.mjs';
test('a token target-language character cannot certify an English headline as translated',()=>{
 assert.equal(translatedTitleValid,validNewsTitle);
 assert.equal(validNewsTitle('אאא Nvidia Shares Rise 10%','Nvidia Shares Rise 10%','he'),false);
 assert.equal(validNewsTitle('אאא NVIDIA STOCK RISE 10%','NVIDIA STOCK RISE 10%','he'),false);
 for(const title of ['אאא Nvidia Shares Rise 10%','א Nvidia shares rise 10%','A Nvidia shares rise 10% א','רווח Nvidia shares rise 10% after strong quarterly results'])assert.equal(validNewsTitle(title,'Nvidia shares rise 10% after strong quarterly results','he'),false,title);
 assert.equal(validNewsTitle('OpenAI ו-MSFT משתפות פעולה','OpenAI and MSFT collaborate','he'),true);
 assert.equal(validNewsTitle('Apple, Microsoft ו-Nvidia עולות','Apple, Microsoft and Nvidia rise','he'),true);
 for(const language of ['es','fr','de','pt'])for(const title of ['Nvidia shares rise 10%.','NVIDIA SHARES RISE 10%','Nvidia shares rise: 10%!'])assert.equal(validNewsTitle(title,'Nvidia shares rise 10%',language),false,language+': '+title);
});
test('material financial numbers cannot change, disappear or be newly invented',()=>{
 for(const [title,source] of [['מניית אנבידיה עולה 90%','Nvidia shares rise 10%'],['החברה מגייסת 2 מיליון דולר','Company raises $1 million'],['ריבית עולה ב־25%','Rates rise 25 basis points'],['החברה צומחת','Company grows 10%'],['החברה צומחת ב־10%','Company grows'],['החברה מוערכת ב־2 מיליארד דולר','Company valued at $1B'],['מניית החברה עולה 10%','Company shares fall −10%'],['מניית החברה עולה 1%','Company shares rise 1,000%'],['מניית החברה עולה 1000%','Company shares rise 1.000%']])assert.equal(validNewsTitle(title,source,'he'),false,title);
});
test('equivalent financial quantities remain valid across scales, separators and rate units',()=>{
 for(const [title,source,language] of [
 ['החברה מוערכת ב־2,500 מיליון דולר','Company valued at $2.5 billion','he'],
 ['החברה גייסה 1,250,000 דולר','Company raised $1.25 million','he'],
 ['המהנדס ישוחרר בערבות של מיליון דולר','Engineer released on $1 million bond','he'],
 ['שווי החברה הוא מיליארד דולר','Company valued at $1B','he'],
 ['ריבית עולה ב־0.25%','Rates rise 25 basis points','he'],
 ['ריבית עולה ב־250 נקודות בסיס','Rates rise 2.5%','he'],
 ['עלייה של 10.5% במניות החברה','Company shares rise 10.5%','he'],
 ['ارتفاع السهم بنسبة ١٠٫٥٪','Shares rise 10.5%','ar'],
 ['החברה גייסה 1 250 000 דולר','Company raised $1,250,000','he'],
 ['時価総額は10億ドル','Company valued at $1 billion','ja'],
 ['苹果上涨10%','Apple rises 10%','zh'],
 ['Die Firma hat 1.000,5 Millionen Dollar eingenommen','Company raised $1,000.5 million','de']
 ])assert.equal(validNewsTitle(title,source,language),true,title);
});
test('long-scale European units cannot silently multiply a value by a thousand',()=>{
 assert.equal(newsNumbersPreserved('Der Konzern ist 1 Billion Dollar wert','Company valued at $1 billion','de'),false);
 assert.equal(newsNumbersPreserved('Der Konzern ist 1 Billion Dollar wert','Company valued at $1 trillion','de'),true);
 assert.equal(newsNumbersPreserved('La empresa vale 1 billón de dólares','Company valued at $1 trillion','es'),true);
});
test('recognized dates retain their date values despite ordering and month-name changes',()=>{
 assert.equal(newsNumbersPreserved('רווחי החברה ל־25.11.2026','Company earnings for November 25, 2026','he'),true);
 assert.equal(newsNumbersPreserved('רווחי החברה ל־2026-11-25','Company earnings for 11/25/2026','he'),true);
 assert.equal(newsNumbersPreserved('רווחי החברה ל־26.11.2026','Company earnings for November 25, 2026','he'),false);
 assert.equal(newsNumbersPreserved('業績は2026年11月25日','Earnings for 2026-11-25','ja'),true);
 assert.equal(validNewsTitle('מכירות שבב H100 עלו ב־10%','H100 chip sales rose 10%','he'),true);
 assert.equal(validNewsTitle('מייקל ברי יוצא מפוזיציית שורט על נאסד״ק 100','Michael Burry exits Nasdaq-100 short','he'),true);
 assert.equal(validNewsTitle('שתי מניות נאסד״ק שנפגעו עשויות להתאושש','2 Beaten-Down Nasdaq Stocks Could Rebound','he'),true);
 assert.equal(validNewsTitle('שלוש מניות נאסד״ק שנפגעו עשויות להתאושש','2 Beaten-Down Nasdaq Stocks Could Rebound','he'),false);
});
test('a bad number in one headline cannot poison the cache or discard valid batch peers',async()=>{
 const env={CONTEXT:'production',ASAF_AI_PROVIDER:'openai',ASAF_OPENAI_ENABLED:'true',OPENAI_API_KEY:'fixture',ASAF_EXTERNAL_SERVICES_APPROVED:'true',ASAF_REDIS_REST_URL:'https://test.upstash.io',ASAF_REDIS_REST_TOKEN:'fixture'},db=new Map();
 const run=async a=>a[0]==='MGET'?a.slice(1).map(k=>db.get(k)||null):a[0]==='GET'?db.get(a[1])||null:a[0]==='SET'?(db.set(a[1],a[2]),'OK'):a[0]==='DEL'?(db.delete(a[1]),1):1;
 const items=[{title:'Nvidia shares rise 10%'},{title:'Apple shares rise 5%'}];let calls=0;
 const fetcher=async()=>{calls++;return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({titles:calls===1?['מניית אנבידיה עולה 90%','מניית אפל עולה 5%']:['מניית אנבידיה עולה 10%']})}]}]})};
 const options={env,run,fetcher,reserve:async()=>true};const first=await translateNews(items,'he',options);assert.equal(first.translation,'partial');assert.equal(first.articles[0].titleLanguage,undefined);assert.equal(first.articles[1].titleLanguage,'he');
 const next=await translateNews(items,'he',options);assert.equal(next.translation,'translated');assert.equal(next.articles[0].title,'מניית אנבידיה עולה 10%');assert.equal(calls,2);
});
