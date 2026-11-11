const $=id=>document.getElementById(id);
let busy=false,pending=null;
const date=value=>new Intl.DateTimeFormat('he-IL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
async function perform(action){
 if(busy||!$('trialAdminForm').reportValidity())return;
 const email=$('trialAdminEmail').value.trim().toLowerCase(),days=Number($('trialAdminDays').value);
 if(action==='extend'&&!window.confirm(`להוסיף ${days} ימי ניסיון לחשבון ${email}?`))return;
 if(!pending||pending.email!==email||pending.days!==days)pending={email,days,requestId:crypto.randomUUID()};
 busy=true;for(const node of $('trialAdminForm').elements)node.disabled=true;
 $('trialAdminMessage').textContent='בודק ומעדכן…';
 try{
  const r=await fetch('/.netlify/functions/billing-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...pending}),signal:AbortSignal.timeout(45000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'לא ניתן להשלים את הפעולה.');
  $('trialAdminMessage').textContent=(action==='extend'?'ההארכה נשמרה. ':'')+(data.trialEndsAt?'סיום הניסיון: '+date(data.trialEndsAt):'המשתמש רשום וטרם התחיל ניסיון.')+(data.paidUntil?' · גישה בתשלום עד: '+date(data.paidUntil):'');
  if(action==='extend')pending=null;
 }catch(e){$('trialAdminMessage').textContent=e.message+' אפשר לנסות שוב; ניסיון חוזר של אותה בקשה לא יוסיף ימים פעמיים.';}
 finally{busy=false;for(const node of $('trialAdminForm').elements)node.disabled=false;}
}
$('trialAdminForm').onsubmit=e=>{e.preventDefault();perform('extend');};
$('trialAdminInspect').onclick=()=>perform('inspect');
for(const button of document.querySelectorAll('[data-trial-days]'))button.onclick=()=>{$('trialAdminDays').value=button.dataset.trialDays;};
try{
 const r=await fetch('/.netlify/functions/account',{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(r.ok){const account=await r.json();$('trialAdmin').hidden=account.admin!==true;}
}catch{}
