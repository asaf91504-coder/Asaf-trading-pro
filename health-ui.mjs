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
  status.textContent="✓ שרת מחובר | גרסה "+body.version+" | נתוני שוק: "+((body.publicMarketDataEnabled||body.marketDataEnabled)?"מופעלים":"כבויים")+" | AI חינמי: "+(body.freeAIEnabled?"מחובר":"לא הוגדר")+" | AI בתשלום: "+(body.paidAIEnabled?"מופעל (בדוק תקציב ואימות)":"כבוי")+" | חדשות: "+(body.newsEnabled?"מוגדרות":"טרם חוברו")+" | חשבונות משתמשים: "+(body.publicAuthEnabled?"מוגדרים":"טרם הופעלו")+" | הבדיקה עצמה אינה פונה לספקים";
 }catch(error){
  status.textContent="⚠️ לא אומת חיבור השרת: "+error.message+". חבר את המאגר ל-Netlify ובצע Deploy.";
 }finally{clearTimeout(timeout);button.disabled=false}
});


// Configuration labels do not claim that a provider price has been fetched.
fetch('/.netlify/functions/health',{cache:'no-store',signal:AbortSignal.timeout(6000)}).then(async r=>{if(!r.ok)return;const data=await r.json();if(data.application!=='ASAF TRADING PRO'||data.status!=='ok')return;const market=document.getElementById('marketConnectionState'),news=document.getElementById('newsConnectionState'),ai=document.getElementById('freeAiStatus');if(market)market.textContent=data.publicMarketDataEnabled?'ספק נתונים מוגדר · טען גרף לאימות':(data.cryptoResearchEnabled?'מניות: ממתינים לספק · בדיקת קריפטו למנהל בלבד':'נתוני שוק: ממתינים למנוי ולחיבור');if(news)news.textContent=data.newsEnabled?(data.newsMode==='public-rss'?'חדשות RSS ציבוריות · כל 15 דקות':'ספק חדשות מוגדר · זמני העדכון בפיד'):'חדשות: טרם חוברו';if(ai)ai.textContent=data.freeAIEnabled?'AI חינמי מוגדר · נדרשת כניסה; זמינות נבדקת בעת שליחה':'AI חינמי ממתין להגדרה'}).catch(()=>{});
