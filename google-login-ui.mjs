import {authState,refreshAuth} from './auth-ui.mjs';
import {welcomeMessage} from './welcome-message.mjs';
const $=id=>document.getElementById(id),button=$('googlePrepare'),status=$('googleLoginStatus'),slot=$('googleLoginButton');
let scriptPromise=null;
function loadGoogle(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>{if(window.google?.accounts?.id)resolve();else{scriptPromise=null;reject(Error('Google לא נטען'))}};script.onerror=()=>{scriptPromise=null;reject(Error('לא ניתן לטעון את Google כרגע. נסה שוב.'))};document.head.append(script)});
 return scriptPromise;
}
async function post(body){const r=await fetch('/.netlify/functions/google-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.error||'הכניסה נכשלה');return data}
async function setup(){try{const r=await fetch('/.netlify/functions/google-auth',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const c=await r.json();button.disabled=!c.enabled;status.textContent=c.enabled?(c.signupEnabled?'אפשר להיכנס או לפתוח חשבון עם Google.':'אפשר להיכנס עם Google לחשבון מקושר. הרשמה חדשה טרם נפתחה.'):'כניסה עם Google בהכנה — מחכים להשלמת הגדרת החיבור.'}catch{button.disabled=true;status.textContent='לא ניתן לבדוק את חיבור Google כרגע.'}}
button.onclick=async()=>{button.disabled=true;slot.replaceChildren();status.classList.remove('welcome-message');status.removeAttribute('dir');try{
 const linking=authState.authenticated;const begin=await post({action:'begin'});await loadGoogle();
 window.google.accounts.id.initialize({client_id:begin.clientId,nonce:begin.nonce,auto_select:false,callback:async result=>{
  slot.replaceChildren();status.textContent='מאמת כניסה…';try{const signed=await post({action:'signin',nonce:begin.nonce,credential:result.credential});await refreshAuth();if(!authState.authenticated)throw Error('לא ניתן לאמת כניסה כרגע. נסה שוב.');status.textContent=welcomeMessage(signed.displayName,signed.created===true);status.classList.add('welcome-message');status.dir='auto';await refreshAccount()}catch(e){status.textContent=e.message}finally{button.disabled=false}
 }});
 window.google.accounts.id.renderButton(slot,{theme:'outline',size:'large',text:linking?'continue_with':'signin_with',locale:'he',width:260});status.textContent=linking?'בחר את חשבון Google עם אותו אימייל כדי לקשר אותו לחשבון הקיים.':'לחץ על הכפתור של Google כדי לבחור חשבון. הבקשה תקפה ל־5 דקות.';
 button.disabled=false;
 }catch(e){status.textContent=e.message;button.disabled=false}};

async function accountRequest(body){const r=await fetch('/.netlify/functions/account',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw Error(data.error||'הפעולה נכשלה');return data}
async function refreshAccount(){const host=$('accountActions');host.hidden=!authState.authenticated;if(!authState.authenticated){$('adminActions').hidden=true;return}try{const info=await accountRequest();$('adminActions').hidden=!info.admin;$('accountDetails').textContent=info.googleLinked?'Google מקושר לחשבון. אפשר להיכנס שוב באמצעות Google ללא סיסמה מקומית.':'אפשר לקשר Google לאחר כניסה עם הסיסמה הקיימת.'}catch(e){$('accountDetails').textContent=e.message}}
$('accountLogoutAll').onclick=async()=>{if(!window.confirm('לנתק את כל הכניסות הפעילות לחשבון?'))return;try{await accountRequest({action:'logout-all'});await refreshAuth();$('accountActionStatus').textContent='כל הכניסות לחשבון נותקו.'}catch(e){$('accountActionStatus').textContent=e.message}};
$('accountDelete').onclick=async()=>{if(!window.confirm('למחוק את כל העותקים שבחשבון — מעקב, יומן, מחקר, העדפות, קווים, שיחות שמורות והתראות — ולסגור את החשבון? לא ניתן לבטל פעולה זו. הנתונים המקומיים במכשיר יישארו.'))return;try{await accountRequest({action:'delete',confirmation:'DELETE'});await refreshAuth();$('accountActionStatus').textContent='החשבון נסגר והעותקים האישיים שבשרת נמחקו. העותק המקומי לא שונה.'}catch(e){$('accountActionStatus').textContent=e.message}};
$('adminForm').onsubmit=async e=>{e.preventDefault();const action=$('adminAction').value;if(action!=='status'&&!window.confirm('לעדכן את הגישה למשתמש שבחרת? הכניסות הקיימות שלו יבוטלו.'))return;try{const d=await accountRequest({action:'admin-'+action,email:$('adminEmail').value});$('adminStatus').textContent=d.exists?'חשבון '+d.memberId+' · '+(d.enabled?'פעיל':'חסום'):'לא נמצא חשבון.'}catch(err){$('adminStatus').textContent=err.message}};
window.addEventListener('asaf:auth',()=>{slot.replaceChildren();if(!authState.authenticated&&status.classList.contains('welcome-message')){status.textContent='';status.classList.remove('welcome-message');status.removeAttribute('dir')}button.textContent=authState.authenticated?'קשר Google לחשבון':'כניסה / הרשמה עם Google';refreshAccount()});
setup();refreshAccount();
