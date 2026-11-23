import {PLANS,usdPriceText} from './server/plans.mjs';
export const CREDIT_PLANS_NOTICE='רכישה דורשת אישור מפורש ב־PayPal. אם כבר יש לך מנוי, בדוק בעמוד המנוי את מועד חידוש המכסה.';
export function showCreditPlans(){
 if(document.getElementById('creditPlansDialog'))return;
 const dialog=document.createElement('dialog');dialog.id='creditPlansDialog';dialog.style.cssText='max-width:820px;width:90%;background:#101d29;color:#fff;border:1px solid #507181;border-radius:18px;padding:28px';
 dialog.setAttribute('aria-labelledby','creditPlansTitle');
 const title=document.createElement('h2');title.id='creditPlansTitle';title.textContent='בחר מסלול להמשך השימוש';dialog.append(title);
 const info=document.createElement('p');info.textContent=CREDIT_PLANS_NOTICE;dialog.append(info);
 for(const p of Object.values(PLANS)){
  const a=document.createElement('a');a.href='/subscription.html?plan='+p.id+'#billingAccount';a.style.cssText='display:block;color:#5de4c3;padding:14px;border:1px solid #34505d;border-radius:10px;margin:10px 0';
  // Keep numbers and plan names separate from the strings localized by the
  // normal language observer. Open dialogs also track language changes.
  const price=document.createElement('bdi');price.textContent=p.id.toUpperCase()+' · $'+usdPriceText(p.price);
  const interval=document.createElement('span');interval.textContent='לחודש';
  const amount=document.createElement('bdi');amount.textContent=String(p.weeklyCredits);
  const period=document.createElement('span');period.textContent='קרדיטים לשבוע';
  a.append(price,' ',interval,' · ',amount,' ',period);dialog.append(a);
 }
 const close=document.createElement('button');close.type='button';close.textContent='חזרה לשיחה';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
