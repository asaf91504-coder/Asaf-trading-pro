import {authState} from './auth-ui.mjs';
// Health reports server configuration, not the current viewer's entitlement or
// the source of an open chart. In particular, publicMarketDataEnabled is false
// for private Twelve Data trials. Keep this badge source-neutral; the chart's
// verified attribution is authoritative.
function configuredMarketLabel(data){
 if(data.publicMarketDataEnabled||data.marketDataEnabled||data.intrinioResearchEnabled)return 'ספק נתונים מוגדר · טען גרף לאימות';
 return data.cryptoResearchEnabled?'מניות: ממתינים לספק · בדיקת קריפטו למנהל בלבד':'נתוני שוק: ממתינים למנוי ולחיבור';
}
const status=document.getElementById("healthStatus");
const button=document.getElementById("healthCheck");
button?.addEventListener("click",async()=>{
 button.disabled=true;
 status.textContent="בודק את שרת הפריסה ללא API בתשלום...";
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch("/.netlify/functions/health",{method:"GET",signal:controller.signal,cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status+" — שרת Netlify לא פרוס או שיש תקלה");
  const body=await response.json();
  if(body.application!=="ASAF TRADING PRO"||body.status!=="ok")throw Error("השרת החזיר גרסה לא צפויה");
  status.textContent="✓ שרת מחובר | גרסה "+body.version+" | נתוני שוק: "+configuredMarketLabel(body)+" | AI: "+(body.aiEnabled?(body.aiProvider==='openai'?'OpenAI מוגדר':'OpenRouter מוגדר'):"טרם הוגדר")+" | חדשות: "+(body.newsEnabled?"מוגדרות":"טרם חוברו")+" | חשבונות משתמשים: "+(body.publicAuthEnabled?"מוגדרים":"טרם הופעלו")+" | הבדיקה עצמה אינה פונה לספקים";
 }catch(error){
  status.textContent="⚠️ לא אומת חיבור השרת: "+error.message+". חבר את המאגר ל-Netlify ובצע Deploy.";
 }finally{clearTimeout(timeout);button.disabled=false}
});


const searchInput=document.getElementById('chatWebSearch'),searchStatus=searchInput?document.createElement('small'):null;if(searchInput){searchInput.disabled=true;searchInput.checked=false;searchStatus.setAttribute('role','status');searchInput.closest('label').after(searchStatus);}
let legacySearchEnabled=false;
function updateSearchStatus(){
 if(!searchInput)return;
 const hosted=authState.ownerHostedSearch===true;
 searchInput.disabled=!hosted&&!legacySearchEnabled;
 if(searchInput.disabled)searchInput.checked=false;
 searchInput.title=hosted?'פיילוט חיפוש לבעלים בלבד. החיפוש שולח את השאלה הנוכחית ל-OpenAI וצורך מהמכסה שאושרה.':legacySearchEnabled?'חיפוש באינטרנט פעיל':'חיפוש באינטרנט עדיין אינו פעיל';
 searchStatus.textContent=searchInput.title;
}
window.addEventListener('asaf:auth',updateSearchStatus);updateSearchStatus();
// Configuration labels do not claim that a provider price has been fetched.
fetch('/.netlify/functions/health',{cache:'no-store',signal:AbortSignal.timeout(6000)}).then(async r=>{if(!r.ok)return;const data=await r.json();if(data.application!=='ASAF TRADING PRO'||data.status!=='ok')return;legacySearchEnabled=data.webSearchEnabled===true;updateSearchStatus();
const market=document.getElementById('marketConnectionState'),news=document.getElementById('newsConnectionState'),ai=document.getElementById('freeAiStatus');if(market)market.textContent=configuredMarketLabel(data);if(news)news.textContent=data.newsEnabled?(data.newsMode==='public-rss'?'חדשות RSS ציבוריות · כל 15 דקות':'ספק חדשות מוגדר · זמני העדכון בפיד'):'חדשות: טרם חוברו';if(ai)ai.textContent=data.aiEnabled?(data.aiProvider==='openai'?'OpenAI מוגדר · זמינות נבדקת בעת שליחה':'AI חינמי מוגדר · נדרשת כניסה; זמינות נבדקת בעת שליחה'):'AI ממתין להגדרה'}).catch(()=>{});
