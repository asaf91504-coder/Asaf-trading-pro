import {parseCSV,stockContext,answerStockQuestion} from "./market-chat.mjs";
import {initLocalChart} from "./local-chart.mjs";

const $=id=>document.getElementById(id);
const log=$("chatLog"),file=$("chatCsv"),message=$("chatInput"),badge=$("chatDataStatus");
const status=$("chatStatus"),form=$("chatForm"),chartSymbol=$("symbol");
const key="asaf_market_candles_v1";
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
 if(!loaded){badge.textContent="לא נטען עדיין קובץ נתוני גרף. בלי CSV אני יכול להסביר מושגים בלבד.";return;}
 const now=normSymbol();
 badge.textContent=now===loaded.symbol?
 "✓ נתוני "+loaded.symbol+" עד "+loaded.context.date+" · "+loaded.context.bars+" נרות · לא בזמן אמת":
 "⚠️ הקובץ שייך לסימול "+loaded.symbol+" שהוזן, אבל הגרף הנבחר הוא "+now+". הנתונים לא ישמשו לניתוח הסימול האחר.";
}
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||"null");
  if(saved&&Array.isArray(saved.bars)&&typeof saved.symbol==="string"){
    loaded={symbol:saved.symbol,bars:saved.bars,context:stockContext(saved.symbol,saved.bars)};
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
file.addEventListener("change",async()=>{
 const uploaded=file.files?.[0];if(!uploaded)return;
 status.textContent="מחשב נתונים מקומית...";
 try{
   if(uploaded.size>2000000)throw Error("קובץ CSV גדול מ-2MB");
   const data=await uploaded.text(),bars=parseCSV(data).slice(-200);
   const symbol=normSymbol();
   if(!symbol)throw Error("יש לבחור סימול מניה בשדה הגרף קודם");
   const context=stockContext(symbol,bars);
   loaded={symbol,bars,context};
   localChart.setData(symbol,bars);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars:bars.slice(-200)}))}catch{status.textContent="חושב, אך אין מספיק מקום לשמירה זמנית."}
   renderStatus();
   status.textContent="✓ הנתונים נותחו במכשיר בלבד. שיוך הסימול מבוסס על מה שהקלדת — ודא שה-CSV שייך לאותה מניה.";
   say("bot","קיבלתי "+context.bars+" נרות עבור הסימול "+symbol+" שבחרת, עד "+context.date+". אפשר לשאול אותי: 'תנתח את הגרף', 'מה התמיכות?', 'האם יש פריצה?', 'איך המחזורים?'");
 }catch(err){status.textContent="לא ניתן לנתח את הקובץ: "+err.message}
 file.value="";
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
