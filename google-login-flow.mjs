export const googleLoginAttemptKey='asaf:google-redirect:v1';
export const googleLoginAttemptMs=300000;
export function usesIosGoogleRedirect(nav){
 const ua=String(nav?.userAgent||'');
 return /iPhone|iPad|iPod/i.test(ua)||(/Macintosh|MacIntel/i.test(ua+' '+String(nav?.platform||''))&&Number(nav?.maxTouchPoints)>1);
}
export function oauthGoogleOptions(win,{redirect,nonce,returnTo,startedAt}){
 if(!redirect)return {};
 try{
  const entry=JSON.stringify({nonce,returnTo,startedAt});
  win.sessionStorage.setItem(googleLoginAttemptKey,entry);
  if(win.sessionStorage.getItem(googleLoginAttemptKey)!==entry)throw Error();
 }catch{
  throw Error('לא ניתן להכין כניסה עם Google. פתח את האתר ישירות ב־Safari בלשונית רגילה ונסה שוב.');
 }
 return {ux_mode:'redirect',login_uri:win.location.origin+'/.netlify/functions/google-redirect'};
}
export function forgetGoogleAttempt(win,nonce){
 if(!nonce)return;
 try{
  if(JSON.parse(win.sessionStorage.getItem(googleLoginAttemptKey))?.nonce===nonce)win.sessionStorage.removeItem(googleLoginAttemptKey);
 }catch{/* Callback and server independently check expiration and nonce. */}
}
