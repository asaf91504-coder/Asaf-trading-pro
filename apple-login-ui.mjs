import {authState,refreshAuth} from './auth-ui.mjs';
const host=document.getElementById('appleLogin');
if(host){
 const prepare=host.querySelector('[data-apple-prepare]'),signin=host.querySelector('[data-apple-signin]'),status=host.querySelector('[data-apple-status]');
 let config,loading;
 async function post(body){const r=await fetch('/.netlify/functions/apple-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw Error(data.error||'הכניסה עם Apple נכשלה. נסה שוב.');return data;}
 function load(){
  if(window.AppleID?.auth)return Promise.resolve();
  if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';script.async=true;const timer=setTimeout(fail,15000);function fail(){clearTimeout(timer);script.remove();loading=null;reject(Error('לא ניתן לטעון את Apple. נסה שוב.'));}script.onload=()=>{clearTimeout(timer);if(window.AppleID?.auth)resolve();else fail();};script.onerror=fail;document.head.append(script);});return loading;
 }
 prepare.onclick=async()=>{
  prepare.disabled=true;signin.hidden=true;status.textContent='מכין כניסה מאובטחת עם Apple…';
  try{config=await post({action:'begin'});await load();window.AppleID.auth.init({clientId:config.clientId,redirectURI:config.redirectURI,scope:'email',nonce:config.nonce,state:config.state,usePopup:true});signin.hidden=false;status.textContent='לחץ על כניסה עם Apple כדי לבחור חשבון. אם כבר נרשמת עם Google, היכנס אליו תחילה לקישור החשבונות.';}
  catch(error){status.textContent=error.message;}finally{prepare.disabled=false;}
 };
 signin.onclick=async()=>{
  signin.disabled=true;prepare.disabled=true;
  try{
   // Call synchronously from the gesture so Safari can open Apple's popup.
   const result=await window.AppleID.auth.signIn();
   if(result.authorization?.state!==config.state)throw Error('הכניסה אינה תואמת לבקשה. התחל שוב.');
   await post({action:'signin',nonce:config.nonce,state:result.authorization.state,code:result.authorization.code});
   await refreshAuth({fresh:true});if(!authState.authenticated)throw Error('לא ניתן לאמת את החשבון. נסה שוב.');
   window.location.replace('/subscription.html');
  }catch(error){status.textContent=error.error==='popup_closed_by_user'?'הכניסה בוטלה. אפשר לנסות שוב.':error.message||'הכניסה עם Apple נכשלה. נסה שוב.';}
  finally{signin.hidden=true;signin.disabled=false;prepare.disabled=false;}
 };
 try{const r=await fetch('/.netlify/functions/apple-auth',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const data=await r.json();host.hidden=data.enabled!==true;}}catch{}
}
