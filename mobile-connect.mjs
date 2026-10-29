export function mobileRequestId(search){
 const params=new URLSearchParams(search),values=params.getAll('request');
 return values.length===1&&/^[a-f0-9]{64}$/.test(values[0])?values[0]:null;
}

async function existingAuth(){
 const auth=await import('./auth-ui.mjs');
 await import('./google-login-ui.mjs');
 return auth;
}

// This is an external-browser approval surface, never an OAuth WebView or an
// automatic approval redirect. The native verifier stays only in the app.
export async function mountMobileConnect({window:win=globalThis.window,document:doc=globalThis.document,fetcher=globalThis.fetch,loadAuth=existingAuth}={}){
 if(!win||!doc)return;
 const $=id=>doc.getElementById(id),status=$('mobileApprovalStatus'),button=$('mobileApprove'),confirmation=$('mobileConfirmDevice');
 const requestId=mobileRequestId(win.location.search);
 let auth=null,enabled=false,busy=false,completed=false;
 const render=()=>{
  const verified=auth?.authState.checkAvailable===true&&auth.authState.authenticated===true;
  button.disabled=!enabled||!verified||!confirmation.checked||busy||completed;
  const id=verified?auth.authState.memberId:null;
  $('mobileAccountIdentity').textContent=id?'חשבון מאומת · מזהה '+String(id).slice(0,8)+'. אם זה אינו החשבון הרצוי, צא ובחר חשבון אחר.':'';
 };
 const resetConfirmation=()=>{confirmation.checked=false;render()};
 confirmation.addEventListener('change',render);
 win.addEventListener('asaf:auth',resetConfirmation);
 if(!requestId){status.textContent='קישור החיבור אינו תקין. פתח בקשת חיבור חדשה מתוך האפליקציה.';return {enabled:false};}
 try{
  const response=await fetcher('/.netlify/functions/mobile-session',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(6000)});
  const config=await response.json();
  if(!response.ok||config?.enabled!==true){status.textContent='גרסת החיבור לאפליקציה עדיין בהכנה. לא ניתן לאשר חיבור כרגע; אפשר להמשיך להשתמש באתר.';return {enabled:false};}
  enabled=true;
  $('mobileRequestCode').textContent=requestId.slice(0,6).toUpperCase();
  $('mobileRequest').hidden=false;$('mobileLoginPanel').hidden=false;$('mobileApprovalPanel').hidden=false;
  auth=await loadAuth();
  await auth.refreshAuth();render();
  status.textContent='היכנס לחשבון הרצוי, השווה את קוד הבקשה ואשר את החיבור בלחיצה. בקשה זו תקפה לזמן מוגבל.';
 }catch{
  enabled=false;render();$('mobileLoginPanel').hidden=true;$('mobileApprovalPanel').hidden=true;status.textContent='לא ניתן לבדוק את בקשת החיבור כרגע. לא אושר חיבור. נסה לפתוח את הקישור מחדש כשהרשת חוזרת.';
  return {enabled:false};
 }
 button.addEventListener('click',async()=>{
  if(button.disabled||busy||completed)return;
  busy=true;render();status.textContent='מאמת את החשבון לפני אישור…';
  try{
   // Refresh may dispatch asaf:auth and uncheck the UI. Preserve only the explicit
   // consent made for this click, and bind it to the same verified member.
   const memberId=auth.authState.memberId,consented=confirmation.checked;
   await auth.refreshAuth();
   if(!consented||auth.authState.checkAvailable!==true||auth.authState.authenticated!==true||!memberId||auth.authState.memberId!==memberId)throw Error('מצב החשבון השתנה או לא אומת. בדוק את החשבון ואשר שוב את התאמת הקוד.');
   const response=await fetcher('/.netlify/functions/mobile-session',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'approve',requestId,confirmation:'CONNECT'}),signal:AbortSignal.timeout(10000)
   });
   let data;try{data=await response.json()}catch{throw Error('לא התקבל אישור תקין מהשרת. חזור לאפליקציה ובדוק אם החיבור הושלם לפני ניסיון נוסף.');}
   if(!response.ok)throw Error(data.error||'החיבור לא אושר. ייתכן שהבקשה פגה; פתח בקשה חדשה מהאפליקציה.');
   if(data?.status!=='approved')throw Error('לא התקבל אישור תקין מהשרת. חזור לאפליקציה ובדוק אם החיבור הושלם לפני ניסיון נוסף.');
   completed=true;$('mobileApprovalPanel').hidden=true;
   status.textContent='הבקשה אושרה. חזור לאפליקציה בעצמך כדי להשלים את החיבור שם. אל תעביר את הקישור לאדם אחר.';
  }catch(error){
   status.textContent=error.name==='TimeoutError'||error.name==='AbortError'?'לא התקבל אישור בזמן. חזור לאפליקציה ובדוק אם החיבור הושלם. אם לא, פתח בקשה חדשה או אשר שוב לאחר בדיקת הקוד.':error.message;
  }finally{busy=false;render();}
 });
 return {enabled:true,button};
}

if(typeof window!=='undefined'&&typeof document!=='undefined')void mountMobileConnect();
