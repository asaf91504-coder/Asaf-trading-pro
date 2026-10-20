import {parseCSV,stockContext,answerStockQuestion} from "./market-chat.mjs";
import {initLocalChart} from "./local-chart.mjs";

const $=id=>document.getElementById(id);
const log=$("chatLog"),file=$("chatCsv"),message=$("chatInput"),badge=$("chatDataStatus");
const status=$("chatStatus"),form=$("chatForm"),chartSymbol=$("symbol");
const key="asaf_market_candles_v1";
const privateAccessKey="asaf_market_access_v1";
const marketStatus=$("marketFetchStatus");
const marketButton=$("marketFetch");
const localChart=initLocalChart();
let loaded=null;
const normSymbol=()=>String(chartSymbol.value||"").trim().toUpperCase().replace(/[^A-Z0-9:._-]/g,"").slice(0,30);
function say(role,content){
 const item=document.createElement("div");
 item.className="bubble "+role;
 item.textContent=content;
 log.append(item);
 log.scrollTop=log.scrollHeight;
 return item;
}
function currentContext(){
 if(!loaded) return null;
 const now=normSymbol();
 if(now!==loaded.symbol) {
   badge.textContent="⚠️ קובץ "+loaded.symbol+" אינו תואם לגרף "+now+". חזור לסימול הנכון או טען CSV חדש.";
   return null;
 }
 return loaded.context;
}
function renderStatus(){
 const attribution=$("marketAttribution");
 if(attribution)attribution.hidden=!(loaded&&loaded.source==="Twelve Data"&&normSymbol()===loaded.symbol);
 if(!loaded){badge.textContent="לא נטען עדיין קובץ נתוני גרף. בלי CSV אני יכול להסביר מושגים בלבד.";return;}
 const now=normSymbol();
 badge.textContent=now===loaded.symbol?
 "✓ "+(loaded.source==="Twelve Data"?"ספק Twelve Data (ייתכן עיכוב)":"CSV מקומי")+" | "+loaded.symbol+" | "+loaded.interval+" | נר אחרון: "+loaded.context.date+" | "+loaded.context.bars+" נרות":
 "⚠️ הקובץ שייך לסימול "+loaded.symbol+" שהוזן, אבל הגרף הנבחר הוא "+now+". הנתונים לא ישמשו לניתוח הסימול האחר.";
}
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||"null");
  if(saved&&Array.isArray(saved.bars)&&typeof saved.symbol==="string"){
    loaded={symbol:saved.symbol,bars:saved.bars,source:saved.source||"CSV",interval:saved.interval||"1day",receivedAt:saved.receivedAt||null,context:stockContext(saved.symbol,saved.bars,{source:saved.source,interval:saved.interval,receivedAt:saved.receivedAt,exchangeTimezone:saved.exchangeTimezone})};
    if(normSymbol()===saved.symbol)localChart.setData(saved.symbol,saved.bars);
  }
 }catch{}
 renderStatus();
}
function ask(q){
 say("user",q);
 const context=currentContext();
 const answer=answerStockQuestion(q,context);
 say("bot",answer);
}
async function loadCsv(uploaded){
 if(!uploaded)return;
 const chartFileStatus=$("chartCsvStatus");
 const report=(text)=>{status.textContent=text;if(chartFileStatus)chartFileStatus.textContent=text};
 report("מחשב נתונים מקומית...");
 try{
   if(uploaded.size>2000000)throw Error("קובץ CSV גדול מ-2MB");
   const data=await uploaded.text(),bars=parseCSV(data).slice(-200);
   const symbol=normSymbol();
   if(!symbol)throw Error("יש לבחור סימול מניה בשדה הגרף קודם");
   const symbols=[...new Set(bars.map(b=>b.ticker).filter(Boolean))];
   if(symbols.length>1)throw Error("בקובץ מופיעות כמה מניות; יש לבחור קובץ של מניה אחת");
   if(symbols.length===1&&symbols[0].split(":").at(-1)!==symbol.split(":").at(-1))throw Error("הסימול בקובץ ("+symbols[0]+") שונה מהגרף ("+symbol+")");
   const interval=bars.some(b=>b.date.includes(" "))?"intraday":"1day";
   const context=stockContext(symbol,bars,{source:"CSV",interval});
   loaded={symbol,bars,source:"CSV",interval,receivedAt:null,context};
   localChart.setData(symbol,bars);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars:bars.slice(-200),source:"CSV",interval}))}catch{report("חושב, אך אין מספיק מקום לשמירה זמנית.")}
   renderStatus();
   report("✓ "+bars.length+" נרות חושבו במכשיר בלבד עבור "+symbol+". מקור CSV. ודא שהנתונים שייכים לסימול שבחרת.");
   say("bot","קיבלתי "+context.bars+" נרות עבור הסימול "+symbol+" שבחרת, עד "+context.date+". אפשר לשאול אותי: 'תנתח את הגרף', 'מה התמיכות?', 'האם יש פריצה?', 'איך המחזורים?'");
 }catch(err){report("לא ניתן לנתח את הקובץ: "+err.message)}
}
file.addEventListener("change",async()=>{await loadCsv(file.files?.[0]);file.value=""});
const chartCsv=$("chartCsv");
chartCsv?.addEventListener("change",async()=>{await loadCsv(chartCsv.files?.[0]);chartCsv.value=""});

const lastFetchBySymbol=new Map();
marketButton.addEventListener("click",async()=>{
 const symbol=normSymbol();
 if(!symbol){marketStatus.textContent="נא להזין סימול מניה תחילה.";return;}
 const interval=$("marketInterval").value;
 const fetchKey=symbol+"|"+interval;
 if(Date.now()-(lastFetchBySymbol.get(fetchKey)||0)<300000){
   marketStatus.textContent="כדי לחסוך במכסת החינם, אפשר לרענן את אותו סימול רק אחרי 5 דקות.";
   return;
 }
 let passcode=sessionStorage.getItem(privateAccessKey);
 if(!passcode){
   passcode=window.prompt("קוד הגישה הפרטי לנתוני השוק (לא מפתח API):")||"";
   if(!passcode)return;
 }
 if(passcode.length<20){marketStatus.textContent="קוד הגישה חייב להכיל לפחות 20 תווים.";return;}
 marketButton.disabled=true;
 marketStatus.textContent="מתחבר לספק הנתונים (לחיצה ידנית בלבד)...";
 try{
   const response=await fetch("/.netlify/functions/market",{
     method:"POST",
     credentials:"same-origin",
     headers:{"Content-Type":"application/json","x-asaf-market-access":passcode},
     body:JSON.stringify({symbol,interval})
   });
   let result;try{result=await response.json()}catch{throw Error("פונקציית Netlify לא נפרסה או החזירה תשובה לא תקינה (ייתכן 404)")};
   if(!response.ok){
     if(response.status===401)sessionStorage.removeItem(privateAccessKey);
     throw Error(result.error||"קריאת נתונים נכשלה");
   }
   if(!Array.isArray(result.bars)||result.bars.length<21)throw Error("התקבלו פחות מ-21 נרות");
   if(normSymbol()!==symbol)throw Error("הסימול בגרף השתנה בזמן הטעינה, נסה שוב");
   if(result.symbol!==symbol.split(":").at(-1))throw Error("הספק החזיר סימול שונה מהנבחר");
   const bars=result.bars.slice(-200);
   const meta={source:"Twelve Data",interval,receivedAt:result.receivedAt,exchangeTimezone:result.exchangeTimezone};
   const context=stockContext(symbol,bars,meta);
   loaded={symbol,bars,context,source:"Twelve Data",interval,receivedAt:result.receivedAt};
   localChart.setData(symbol,bars);
   sessionStorage.setItem(privateAccessKey,passcode);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars,...meta}))}catch{}
   lastFetchBySymbol.set(fetchKey,Date.now());
   renderStatus();
   marketStatus.textContent="✓ נר אחרון: "+result.latestBarTime+" | "+(result.exchange||"בורסה לא ידועה")+" | אזור זמן: "+(result.exchangeTimezone||"לא ידוע")+" | מקור Twelve Data"+(result.cached?" (מטמון)":"")+"; נתונים עשויים להיות מעוכבים.";
   status.textContent="הגרף המקורי והצ'אט מציגים כעת את אותם "+bars.length+" נרות. אפשר לצלם ולבקש ניתוח.";
   say("bot","📡 קיבלתי "+bars.length+" נרות מאושרים של "+symbol+" בטווח "+interval+". נר אחרון: "+result.latestBarTime+". כל התשובות מכאן מבוססות על נתוני הספק שנקלטו, לא על צילום חלון TradingView.");
   document.querySelector('[data-tab="charts"]').click();
 }catch(error){
   marketStatus.textContent="לא התחבר: "+error.message+". לא הופעלו שירותי OpenAI.";
 }finally{
   marketButton.disabled=false;
 }
});
$("marketForgetCode").addEventListener("click",()=>{
 sessionStorage.removeItem(privateAccessKey);
 marketStatus.textContent="קוד הגישה הזמני נשכח מהמכשיר.";
});
const captureButton=$("captureChart"),preview=$("chartCapturePreview"),capturePanel=$("chartCapturePanel");
captureButton.addEventListener("click",()=>{
 try{
   const context=currentContext();
   if(!context)throw Error("צריך לטעון נתוני CSV או ספק שמתאימים לסימול הנוכחי");
   const image=localChart.snapshot();
   preview.src=image;
   capturePanel.hidden=false;
   document.querySelector('[data-tab="chat"]').click();
   ask("תנתח לי את הגרף המצולם, המגמה, פריצות, המחזורים והסיכון. הסתמך רק על הנרות המחוברים.");
 }catch(error){marketStatus.textContent="אי אפשר לצלם ולנתח: "+error.message}
});
$("downloadChart").addEventListener("click",()=>{
 try{
   if(!currentContext())throw Error("אין נתוני גרף לסימול הנוכחי");
   const dataUrl=localChart.snapshot();
   const link=document.createElement("a");
   link.href=dataUrl;link.download="asaf-chart-"+normSymbol().replace(/[^A-Z0-9_-]/g,"_")+".png";
   link.click();
 }catch(error){marketStatus.textContent="הצילום נכשל: "+error.message}
});

form.addEventListener("submit",event=>{
 event.preventDefault();
 const q=message.value.trim();
 if(!q)return;
 message.value="";
 ask(q);
});
$("chatClearData").addEventListener("click",()=>{
 loaded=null;
 localChart.clear();
 try{sessionStorage.removeItem(key)}catch{}
 renderStatus();
 status.textContent="נתוני הגרף הזמניים נמחקו מהמכשיר.";
});
document.querySelectorAll("[data-market-question]").forEach(button=>{
 button.addEventListener("click",()=>ask(button.getAttribute("data-market-question")));
});
const shortcut=$("chartChat");
if(shortcut)shortcut.addEventListener("click",()=>{
 document.querySelector('[data-tab="chat"]').click();
 ask("תנתח את הגרף הנוכחי");
});
chartSymbol.addEventListener("input",()=>{renderStatus();if(loaded&&normSymbol()===loaded.symbol)localChart.setData(loaded.symbol,loaded.bars);else localChart.clear()});
document.querySelector('[data-tab="charts"]').addEventListener("click",()=>requestAnimationFrame(()=>localChart.redraw()));
restore();
say("bot","אני ASAF Market Analyst — מתמחה רק בשוק ההון. טען נתוני נרות CSV כדי שאוכל לנתח את הגרף באמת. איני רואה ישירות את חלון TradingView, איני מקבל מחירים בזמן אמת, ואין כאן שימוש ב-API בתשלום.");
if(loaded&&normSymbol()===loaded.symbol)say("bot","נתוני "+loaded.symbol+" נטענו מחדש מהלשונית הנוכחית, עד "+loaded.context.date+".");
if(new URLSearchParams(location.search).get("tab")==="chat"){
 document.querySelector('[data-tab="chat"]').click();
}
