import {randomBytes,timingSafeEqual} from 'node:crypto';
import {googleRedirectEnabled} from '../../server/google-auth.mjs';

const credentialPattern=/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
const csrfPattern=/^[A-Za-z0-9._~%+=:/-]{1,256}$/;
const htmlHeaders=nonce=>({
 'Content-Type':'text/html; charset=utf-8',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"+(nonce?"; script-src 'nonce-"+nonce+"'":"")
});
function cookieValues(request,name){
 return (request.headers.get('cookie')||'').split(';').map(c=>c.trim()).filter(c=>c.startsWith(name+'=')).map(c=>c.slice(name.length+1));
}
async function limitedForm(request){
 const limit=16_000;
 if(Number(request.headers.get('content-length'))>limit||!request.body)return null;
 const parts=[],reader=request.body.getReader();let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.length;
   if(total>limit){await reader.cancel();return null;}
   parts.push(value);
  }
  return new URLSearchParams(Buffer.concat(parts,total).toString('utf8'));
 }finally{reader.releaseLock();}
}
function response(status,credential){
 const nonce=credential?randomBytes(24).toString('base64'):null;
 // Only a bounded, strict JWT character set ever reaches the HTML attribute.
 // The token is not in a URL, server-side storage, logs, or a third-party script.
 const bridge=nonce?`<meta name="google-credential" content="${credential}"><script type="module" nonce="${nonce}" src="/google-redirect-return.mjs"></script>`:'';
 return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ASAF Pro · Google</title>${bridge}</head><body><main><h1>ASAF Pro</h1><p id="status" role="status">${credential?'מאמת כניסה עם Google…':'לא ניתן להשלים את הכניסה עם Google. חזור לאתר ונסה שוב.'}</p><p><a id="back" href="/">חזרה לאתר</a></p></main></body></html>`,{status,headers:htmlHeaders(nonce)});
}
export function createGoogleRedirectHandler({env=process.env}={}){
 return async request=>{
  if(!googleRedirectEnabled(env,new URL(request.url).origin))return response(404);
  if(request.method!=='POST')return response(405);
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return response(415);
  try{
   const form=await limitedForm(request);
   if(!form)return response(400);
   const tokens=form.getAll('g_csrf_token'),cookies=cookieValues(request,'g_csrf_token'),credentials=form.getAll('credential');
   if(tokens.length!==1||cookies.length!==1||!csrfPattern.test(tokens[0])||!csrfPattern.test(cookies[0])||tokens[0].length!==cookies[0].length||
      !timingSafeEqual(Buffer.from(tokens[0]),Buffer.from(cookies[0])))return response(403);
   if(credentials.length!==1||credentials[0].length>14_000||!credentialPattern.test(credentials[0]))return response(400);
   // GIS verifies its double-submit cookie above. A separate same-tab step
   // sends the existing site's own Strict binding/session cookies to its JSON
   // endpoint, where nonce, Google claims and account policy are all enforced.
   return response(200,credentials[0]);
  }catch{return response(400);}
 };
}
export default request=>createGoogleRedirectHandler()(request);
