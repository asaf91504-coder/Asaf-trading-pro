import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {AppLauncher} from '@capacitor/app-launcher';

export const API_ORIGIN='https://joyful-seahorse-967889.netlify.app';
const API_PATH=/^\/\.netlify\/functions\/[a-z0-9-]+$/;
const METHODS=new Set(['GET','POST','PUT','PATCH','DELETE','HEAD']);
const abortError=()=>new DOMException('הבקשה בוטלה','AbortError');

// Native HTTP owns its cookie jar. JavaScript never reads, stores or forwards a
// session token, and Set-Cookie headers never escape into the fetch facade.
export function setupNativeFetch({window:win,http,origin=API_ORIGIN}={}){
 if(!win?.fetch||!http?.request||origin!==API_ORIGIN)throw Error('Native API configuration is invalid');
 const original=win.fetch.bind(win);
 const wrapped=async(input,init={})=>{
  const isRequest=typeof Request!=='undefined'&&input instanceof Request;
  const address=isRequest?input.url:input instanceof URL?input.href:String(input);
  let url;try{url=new URL(address,win.location.href)}catch{return original(input,init)}
  const localURL=new URL(win.location.href),sameLocal=url.protocol===localURL.protocol&&url.host===localURL.host;
  if(!API_PATH.test(url.pathname)||!sameLocal&&url.origin!==API_ORIGIN)return original(input,init);
  const method=String(init.method||(isRequest?input.method:'GET')).toUpperCase();
  if(!METHODS.has(method))throw Error('Native API method is not supported');
  const signal=init.signal||(isRequest?input.signal:null);if(signal?.aborted)throw abortError();
  const headers=new Headers(init.headers||(isRequest?input.headers:undefined)),outgoing={};
  for(const [name,value] of headers){if(!['cookie','cookie2','host','origin','authorization','proxy-authorization'].includes(name.toLowerCase()))outgoing[name]=value;}
  outgoing.Origin=API_ORIGIN;
  let data=init.body;
  if(data===undefined&&isRequest&&!['GET','HEAD'].includes(method))data=await input.clone().text();
  if(data!==undefined&&data!==null){
   if(['GET','HEAD'].includes(method))throw Error('Native GET requests cannot have a body');
   if(typeof data!=='string')throw Error('Native API accepts JSON request bodies only');
   try{data=JSON.parse(data)}catch{throw Error('Native API body is not valid JSON')}
   outgoing['Content-Type']='application/json';
  }
  if(signal?.aborted)throw abortError();
  const target=new URL(url.pathname+url.search,API_ORIGIN).href;
  let removeAbort=()=>{};
  const cancellation=new Promise((_,reject)=>{if(signal){const onAbort=()=>reject(abortError());signal.addEventListener('abort',onAbort,{once:true});removeAbort=()=>signal.removeEventListener('abort',onAbort)}});
  try{
   const request=http.request({url:target,method,headers:outgoing,...(data!==undefined&&data!==null?{data}:{}),responseType:'json',connectTimeout:5000,readTimeout:25000,disableRedirects:true});
   const result=await (signal?Promise.race([request,cancellation]):request);
   if(signal?.aborted)throw abortError();
   const safeHeaders=new Headers();
   for(const [name,value] of Object.entries(result.headers||{}))if(!['set-cookie','set-cookie2'].includes(name.toLowerCase()))safeHeaders.set(name,String(value));
   const status=Number(result.status);if(!Number.isInteger(status)||status<200||status>599)throw Error('Native API returned an invalid HTTP status');
   const body=['HEAD'].includes(method)||[204,205,304].includes(status)?null:typeof result.data==='string'?result.data:JSON.stringify(result.data??null);
   return new Response(body,{status,headers:safeHeaders});
  }finally{removeAbort()}
 };
 win.fetch=wrapped;return ()=>{if(win.fetch===wrapped)win.fetch=original};
}

export function approvalURL(value,requestId){
 if(!/^[a-f0-9]{64}$/.test(requestId||'')||value!=='/mobile-connect.html?request='+requestId)throw Error('כתובת אישור האפליקציה אינה תקינה.');
 return API_ORIGIN+value;
}
export function base64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export async function createPKCE(crypto){
 const random=crypto.getRandomValues(new Uint8Array(32)),verifier=base64url(random);
 return {verifier,challenge:base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))};
}

export function installNativeBootstrap({window:win,document:doc,http,capacitor,app,launcher,now=Date.now}={}){
 if(!win||!doc||!capacitor?.isNativePlatform?.())return;
 win.__ASAF_NATIVE_APP__=true;
 setupNativeFetch({window:win,http});
 const initial=new URL(win.location.href);if(!initial.searchParams.has('tab')){initial.searchParams.set('tab','chat');win.history.replaceState(null,'',initial.pathname+initial.search+initial.hash)}
 let pending=null,busy=false,timer=null,epoch=0,controls=null,returnButton=null,cancelButton=null;
 const status=()=>doc.getElementById('googleLoginStatus');
 const tell=text=>{const node=status();if(node)node.textContent=text};
 const clear=()=>{epoch++;pending=null;if(timer!==null)win.clearTimeout(timer);timer=null;if(controls)controls.hidden=true;setBusy(false)};
 function expired(){return pending&&pending.expires<=now()}
 function ensureControls(){
  if(controls?.isConnected)return;
  const host=status();if(!host)return;
  controls=doc.createElement('div');controls.id='nativeLoginControls';controls.className='row';controls.hidden=true;
  returnButton=doc.createElement('button');returnButton.type='button';returnButton.textContent='חזרתי מהדפדפן — השלם כניסה';returnButton.addEventListener('click',redeem);
  cancelButton=doc.createElement('button');cancelButton.type='button';cancelButton.textContent='בטל חיבור לאפליקציה';cancelButton.addEventListener('click',()=>{if(busy)return;clear();tell('חיבור האפליקציה בוטל. אפשר להתחיל שוב.')});
  controls.append(returnButton,cancelButton);host.after(controls);
 }
 function setBusy(value){busy=value;if(returnButton)returnButton.disabled=value;if(cancelButton)cancelButton.disabled=value}
 async function post(body){
  const response=await win.fetch('/.netlify/functions/mobile-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'לא ניתן להשלים את חיבור האפליקציה.');return {response,data};
 }
 async function redeem(){
  if(!pending||busy)return;
  if(expired()){clear();tell('הבקשה לחיבור האפליקציה פגה. התחל כניסה מחדש.');return;}
  const current=pending,currentEpoch=epoch;setBusy(true);tell('בודק את אישור חיבור האפליקציה…');
  try{
   const {response,data}=await post({action:'redeem',requestId:current.requestId,verifier:current.verifier});
   if(currentEpoch!==epoch||pending!==current)return;
   if(response.status===202&&data.status==='pending'){tell('האישור עדיין ממתין. השלם בדפדפן את הכניסה ואת אישור קוד החיבור '+current.requestId.slice(0,6)+', ואז חזור לאפליקציה.');return;}
   if(data.authenticated!==true)throw Error('לא התקבל אישור כניסה לחשבון.');
   clear();tell('החשבון חובר לאפליקציה. מאמת את הכניסה…');win.dispatchEvent(new Event('asaf:native-authenticated'));
  }catch(error){if(currentEpoch===epoch)tell(error.message||'חיבור האפליקציה נכשל. אפשר לנסות שוב.');}
  finally{if(currentEpoch===epoch){setBusy(false);if(expired()){clear();tell('הבקשה לחיבור האפליקציה פגה. התחל כניסה מחדש.');}}}
 }
 async function begin(){
  if(busy)return;clear();const currentEpoch=epoch;setBusy(true);tell('מכין כניסה דרך הדפדפן המאובטח…');
  try{
   const configuration=await win.fetch('/.netlify/functions/mobile-session',{cache:'no-store'}),config=await configuration.json();
   if(currentEpoch!==epoch)return;
   if(!configuration.ok||config.enabled!==true){tell('הכניסה בגרסה המקורית עדיין בבדיקות ולא הופעלה. אפשר להיכנס בינתיים באתר דרך הדפדפן.');return;}
   const pkce=await createPKCE(win.crypto),{data}=await post({action:'begin',challenge:pkce.challenge});
   if(currentEpoch!==epoch)return;
   const url=approvalURL(data.approvalPath,data.requestId);
   if(data.expiresIn!==300)throw Error('תוקף בקשת חיבור האפליקציה אינו תקין.');
   pending={requestId:data.requestId,verifier:pkce.verifier,expires:now()+300000};ensureControls();if(controls)controls.hidden=false;
   tell('קוד החיבור: '+data.requestId.slice(0,6)+'. אשר בדפדפן את אותו קוד ואת החשבון הרצוי, ואז חזור לאפליקציה.');
   timer=win.setTimeout(()=>{if(pending){clear();tell('הבקשה לחיבור האפליקציה פגה. התחל כניסה מחדש.');}},300000);
   const opened=await launcher.openUrl({url});if(opened?.completed===false)throw Error('דפדפן המכשיר לא נפתח. אפשר לבטל ולנסות להתחיל שוב.');
  }catch(error){if(currentEpoch===epoch)tell(error.message||'לא ניתן לפתוח את דפדפן המכשיר.');}
  finally{if(currentEpoch===epoch)setBusy(false)}
 }
 // Capture runs before the website GIS onclick. Google credentials are entered
 // only in the external system browser, never inside this native WebView.
 doc.addEventListener('click',event=>{
  if(!event.target?.closest?.('#googlePrepare'))return;
  event.preventDefault();event.stopImmediatePropagation();void begin();
 },true);
 win.addEventListener('asaf:logout',clear);
 try{const handle=app?.addListener?.('appStateChange',state=>{if(state.isActive&&pending)void redeem()});handle?.catch?.(()=>{});}catch{}
 return {begin,redeem,cancel(){if(!busy)clear()}};
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installNativeBootstrap({window,document,http:CapacitorHttp,capacitor:Capacitor,app:App,launcher:AppLauncher});
