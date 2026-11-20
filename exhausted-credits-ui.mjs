import {PLANS,usdPriceText} from './server/plans.mjs';
export const CREDIT_PLANS_NOTICE='רכישה דורשת אישור מפורש ב־PayPal. אם כבר יש לך מנוי, בדוק בעמוד המנוי את מועד חידוש המכסה.';
export function showCreditPlans(){
 if(document.getElementById('creditPlansDialog'))return;
 const he=(document.documentElement.lang||'he').startsWith('he'),dialog=document.createElement('dialog');dialog.id='creditPlansDialog';dialog.style.cssText='max-width:820px;width:90%;background:#101d29;color:#fff;border:1px solid #507181;border-radius:18px;padding:28px';
 const title=document.createElement('h2');title.textContent=he?'בחר מסלול להמשך השימוש':'Choose a plan to continue';dialog.append(title);
 const info=document.createElement('p');info.textContent=CREDIT_PLANS_NOTICE;dialog.append(info);
 for(const p of Object.values(PLANS)){const a=document.createElement('a');a.href='/subscription.html?plan='+p.id+'#billingAccount';a.style.cssText='display:block;color:#5de4c3;padding:14px;border:1px solid #34505d;border-radius:10px;margin:10px 0';a.textContent=p.id.toUpperCase()+' · $'+usdPriceText(p.price)+(he?' לחודש · ':' / month · ')+p.weeklyCredits+(he?' קרדיטים לשבוע':' credits / week');dialog.append(a);}
 const close=document.createElement('button');close.textContent=he?'חזרה לשיחה':'Back to chat';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
