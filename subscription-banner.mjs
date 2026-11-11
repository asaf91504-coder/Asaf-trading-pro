import {authState} from './auth-ui.mjs';
const banner=document.createElement('aside');banner.className='subscription-banner';banner.hidden=true;banner.setAttribute('aria-label','מצב המנוי');
const text=document.createElement('span'),link=document.createElement('a');link.href='/subscription.html';link.textContent='ניהול המנוי';banner.append(text,link);document.querySelector('header')?.after(banner);
let revision=0;
async function refresh(){
 const current=++revision,member=authState.memberId;banner.hidden=true;if(!authState.authenticated||!member)return;
 try{
  let r=await fetch('/.netlify/functions/billing',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();let d=await r.json();
  if(current!==revision||member!==authState.memberId||!d.ready)return;
  if(d.status==='not_started'){r=await fetch('/.netlify/functions/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start-trial'}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();d=await r.json();}
  if(current!==revision||member!==authState.memberId)return;
  text.textContent=d.status==='trial'?'14 ימי ניסיון בחינם · '+new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'medium'}).format(new Date(d.trialEndsAt)):d.status==='paid'?'המנוי שלך פעיל.':'תקופת הניסיון הסתיימה. המשך השימוש דורש מנוי ב־10 דולר לחודש.';
  banner.hidden=false;
 }catch{if(current===revision){text.textContent='לא ניתן לבדוק את המנוי כרגע. נסה שוב.';banner.hidden=false;}}
}
window.addEventListener('asaf:auth',refresh);refresh();
