const KEY='asaf:google-redirect:v1';
const safePath=p=>p==='/subscription.html'?p:'/';
const notice=document.getElementById('status'),back=document.getElementById('back');
async function finish(){
 const meta=document.querySelector('meta[name="google-credential"]'),credential=meta?.content;
 meta?.remove();
 let attempt;
 try{
  const raw=sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  attempt=JSON.parse(raw||'null');
 }catch{}
 const path=safePath(attempt?.returnTo);
 back.href=path;
 const age=Date.now()-attempt?.startedAt;
 if(!credential||!attempt||!/^[a-f0-9]{64}$/.test(attempt.nonce)||typeof attempt.startedAt!=='number'||!(age>=0&&age<300_000)){
  notice.textContent='הבקשה פגה או שנפתחה בלשונית אחרת. חזור לאתר והתחל את ההתחברות מחדש.';
  return;
 }
 try{
  // An inherited 'no-referrer' policy would turn Origin into null on this
  // same-origin POST. Let the browser send Origin only to our own endpoint.
  const r=await fetch('/.netlify/functions/google-auth',{method:'POST',mode:'same-origin',credentials:'same-origin',referrerPolicy:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signin',nonce:attempt.nonce,credential}),signal:AbortSignal.timeout(15_000)});
  const data=await r.json();
  if(!r.ok||data.authenticated!==true){
   notice.textContent=typeof data.error==='string'?data.error:'לא ניתן לאמת את הכניסה. חזור לאתר ונסה שוב.';
   return;
  }
  window.location.replace(path);
 }catch{notice.textContent='לא ניתן לאמת את הכניסה. חזור לאתר ונסה שוב.';}
}
void finish();
