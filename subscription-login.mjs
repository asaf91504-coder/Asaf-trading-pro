import {authState,refreshAuth} from './auth-ui.mjs';
import {forgetGoogleAttempt,googleLoginAttemptMs,oauthGoogleOptions,usesIosGoogleRedirect} from './google-login-flow.mjs';
const button=document.getElementById('billingLogin');
const slot=document.getElementById('billingGoogleButton');
const status=document.getElementById('billingLoginStatus');
let loading,active=null;
function clearAttempt(attempt=active){
 if(!attempt||attempt!==active)return;
 active=null;
 if(attempt.timer!=null)window.clearTimeout(attempt.timer);
 forgetGoogleAttempt(window,attempt.nonce);
 slot.replaceChildren();
 button.disabled=false;
}
function expireAttempt(attempt){
 if(active===attempt){clearAttempt(attempt);status.textContent='הכניסה פגה. לחץ שוב על כניסה עם Google.'}
}
async function redirectAvailable(){
 if(!usesIosGoogleRedirect(window.navigator))return false;
 const response=await fetch('/.netlify/functions/google-auth',{cache:'no-store',signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw Error('לא ניתן לבדוק את חיבור Google כרגע. נסה שוב.');
 return (await response.json()).redirectEnabled===true;
}
function loadGoogle(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(!loading)loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  const timer=setTimeout(()=>fail(),15000);
  function fail(){clearTimeout(timer);script.remove();loading=null;reject(Error('לא ניתן לטעון את Google. נסה שוב.'));}
  script.onerror=fail;script.onload=()=>{clearTimeout(timer);if(window.google?.accounts?.id)resolve();else fail();};document.head.append(script);
 });
 return loading;
}
async function post(body){
 const response=await fetch('/.netlify/functions/google-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'ההתחברות נכשלה. נסה שוב.');return data;
}
button.onclick=async()=>{
 clearAttempt();
 const attempt={startedAt:Date.now(),nonce:null,timer:null};
 active=attempt;
 button.disabled=true;slot.replaceChildren();status.textContent='מכין כניסה מאובטחת עם Google…';
 try{
  const redirect=await redirectAvailable();
  if(active!==attempt)return;
  const begin=await post({action:'begin'});
  if(active!==attempt)return;
  attempt.nonce=begin.nonce;await loadGoogle();
  if(active!==attempt)return;
  if(Date.now()-attempt.startedAt>=googleLoginAttemptMs){expireAttempt(attempt);return}
  const options=oauthGoogleOptions(window,{redirect,nonce:begin.nonce,returnTo:'/subscription.html',startedAt:attempt.startedAt});
  if(!redirect)options.callback=async result=>{
   if(active!==attempt)return;
   if(Date.now()-attempt.startedAt>=googleLoginAttemptMs){expireAttempt(attempt);return}
   clearAttempt(attempt);button.disabled=true;status.textContent='מאמת את החשבון…';
   try{
    await post({action:'signin',nonce:begin.nonce,credential:result.credential});
    await refreshAuth({fresh:true});
    if(!authState.authenticated)throw Error('לא ניתן לאמת את החשבון כרגע. נסה שוב.');
    // Stay on billing: the server determines trial and payment access after sign-in.
    window.location.replace('/subscription.html');
   }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  };
  window.google.accounts.id.initialize({client_id:begin.clientId,nonce:begin.nonce,auto_select:false,...options});
  window.google.accounts.id.renderButton(slot,{theme:'outline',size:'large',text:'signin_with',locale:document.documentElement.lang||'he',width:260});
  status.textContent='בחר חשבון באמצעות הכפתור של Google. לאחר הכניסה תוכל להפעיל ניסיון או לנהל את המנוי.';
  attempt.timer=window.setTimeout?.(()=>expireAttempt(attempt),Math.max(0,googleLoginAttemptMs-(Date.now()-attempt.startedAt)));
  button.disabled=false;
 }catch(error){if(active===attempt){clearAttempt(attempt);status.textContent=error.message}}
};
