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
  status.textContent="✓ שרת מחובר | גרסה "+body.version+" | נתוני שוק: "+(body.marketDataEnabled?"מופעלים":"כבויים")+" | AI חינמי: "+(body.freeAIEnabled?"מחובר":"לא הוגדר")+" | AI בתשלום: "+(body.paidAIEnabled?"מופעל (בדוק תקציב ואימות)":"כבוי")+" | חדשות: "+(body.newsEnabled?"מוגדרות":"טרם חוברו")+" | חשבונות משתמשים: "+(body.publicAuthEnabled?"מוגדרים":"טרם הופעלו")+" | הבדיקה עצמה אינה פונה לספקים";
 }catch(error){
  status.textContent="⚠️ לא אומת חיבור השרת: "+error.message+". חבר את המאגר ל-Netlify ובצע Deploy.";
 }finally{clearTimeout(timeout);button.disabled=false}
});

