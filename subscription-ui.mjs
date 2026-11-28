import {ownerCreditCopy} from './owner-credit-copy.mjs';
import {subscriptionCopy} from './subscription-copy.mjs';
import {PLANS,consentFor,CHECKOUT_PRICE_VERSION,usdPriceText} from './server/plans.mjs';
const $=id=>document.getElementById(id),t=text=>window.asafTranslate?.(text)||text;
let state=null,busy=false,retryAction;
const show=(id,visible)=>{$(id).hidden=!visible;};
const date=value=>new Intl.DateTimeFormat(document.documentElement.lang||'he',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
async function request(action){
 const r=await fetch('/.netlify/functions/billing',{method:action?'POST':'GET',cache:'no-store',headers:action?{'Content-Type':'application/json'}:{},...(action?{body:JSON.stringify({action,...(action==='subscribe'?{promoCode:$('billingPromoCode')?.value?.trim()||'',planId:$('billingPlan').value,consent:window.asafBillingPromotion?.consent||consentFor($('billingPlan').value)}:{})})}:{}),signal:AbortSignal.timeout(45000)});
 const data=await r.json();if(!r.ok){const error=Error(data.error||t('לא ניתן לבדוק את המנוי כרגע. נסה שוב.'));error.status=r.status;throw error;}return data;
}
const copy=(key,values)=>subscriptionCopy(document.documentElement.lang,key,values);
function renderPlan(){
 if(state?.ownerUnlimited){$('planTitle').textContent='ASAF Pro';$('billingPlanDetails').textContent=ownerCreditCopy(document.documentElement.lang,'unlimited');document.querySelector('.subscription-price').hidden=true;$('billingCredits').textContent=ownerCreditCopy(document.documentElement.lang,'unlimited');return;}
 const existing=state?.status==='paid'||state?.priorCheckoutUnresolved===true;
 const verifiedPlan=existing&&(state.subscriptionPlanId||state.credits?.planId);
 if(verifiedPlan&&Object.hasOwn(PLANS,verifiedPlan))$('billingPlan').value=verifiedPlan;
 const plan=PLANS[$('billingPlan').value]||PLANS.starter;
 const effectivePrice=existing?state.subscriptionMonthlyPrice:window.asafBillingPromotion?.planId===plan.id?window.asafBillingPromotion.monthlyPrice:plan.price;
 const amount=effectivePrice==null?'':usdPriceText(effectivePrice);
 const values={price:amount,credits:plan.weeklyCredits.toLocaleString(document.documentElement.lang||'he'),bonus:plan.bonusPercent};
 $('planTitle').textContent='ASAF Pro · '+plan.id[0].toUpperCase()+plan.id.slice(1);
 $('billingPlanDetails').textContent=amount&&(!existing||verifiedPlan)?copy('summary',values):'';
 document.querySelector('.subscription-price bdi').textContent=amount?'$'+amount:'';
 document.querySelector('.subscription-price').hidden=!amount;
 $('billingConsentText').textContent=copy('consent',values);
 $('billingSubscribe').textContent=copy('checkout',values);
 const baseBalance=state?.credits?.baseRemaining??state?.credits?.remaining,baseLimit=state?.credits?.baseLimit??state?.credits?.limit;
 $('billingCredits').textContent=state?.ownerUnlimited?ownerCreditCopy(document.documentElement.lang,'unlimited'):state?.credits?copy(state.credits.planId==='trial'?'trialBalance':'balance',{remaining:baseBalance,limit:baseLimit,date:date(state.credits.resetsAt)}):'';
 if(state?.credits?.bonusRemaining>0)$('billingCredits').textContent+=' · '+ownerCreditCopy(document.documentElement.lang,'balance',state.credits.bonusRemaining);
}
function render(){
 renderPlan();
 if(!state)return;
 const ready=state.ready===true,checkoutReady=ready&&state.pricingVersion===2&&state.checkoutPriceVersion===CHECKOUT_PRICE_VERSION&&state.checkoutAllowed===true&&!state.priorCheckoutUnresolved,auth=state.authenticated===true;
 $('billingStatus').textContent=t(state.ownerUnlimited?ownerCreditCopy(document.documentElement.lang,'unlimited'):!ready?'ההרשמה למנוי תיפתח בקרוב. החיוב עדיין אינו פעיל.':!auth?'התחבר לחשבון כדי לקבל 7 ימים בחינם.':state.status==='owner'?ownerCreditCopy(document.documentElement.lang,'unlimited'):state.status==='trial'?'תקופת הניסיון שלך פעילה.':state.status==='paid'?'המנוי שלך פעיל.':state.status==='expired'?'תקופת הניסיון הסתיימה.':'7 ימי ניסיון בחינם מחכים לך.');
 if(ready&&auth&&!state.access&&state.subscriptionStatus==='APPROVAL_PENDING')$('billingStatus').textContent=t('ממתינים לאישור המנוי ב־PayPal.');
 if(ready&&auth&&!state.access&&['ACTIVE','APPROVED'].includes(state.subscriptionStatus))$('billingStatus').textContent=t('המנוי אושר, אך עדיין אין אישור לתשלום. לחץ על בדיקת תשלום.');
 if(ready&&auth&&!state.access&&state.subscriptionStatus==='SUSPENDED')$('billingStatus').textContent=t('המנוי הושהה. בדוק את אמצעי התשלום בחשבון PayPal.');
 $('billingDate').textContent=state.status==='trial'?t('סיום הניסיון:')+' '+date(state.trialEndsAt):state.status==='paid'?t('גישה עד:')+' '+date(state.paidUntil):'';
 if(state.subscriptionStatus==='CANCELLED')$('billingDate').textContent+=' '+t('החידוש החודשי בוטל.');
 show('billingSandbox',state.sandbox===true);show('billingLogin',ready&&!auth);show('billingTrial',ready&&auth&&state.status==='not_started');show('billingContinue',auth&&state.access&&(ready||state.ownerUnlimited===true));
 show('billingCheckout',checkoutReady&&auth&&!['paid','owner'].includes(state.status)&&!state.canCancel);show('billingCancel',ready&&auth&&state.canCancel);show('billingSync',ready&&auth&&!!state.subscriptionStatus);
 const availability=state.paymentPilot&&checkoutReady
  ?'בדיקת מנהל: זהו חיוב אמיתי ומתחדש. הצ׳אט בתשלום והחיפוש עדיין בהכנה. ניתן לבטל את החידוש לאחר הבדיקה.'
  :ready&&!checkoutReady&&!['paid','owner'].includes(state.status)
   ?'המסלולים החדשים בהכנה. רכישה תיפתח לאחר בדיקת התשלום ומכסות השימוש.'
   :'';
 $('billingAvailability').textContent=availability?t(availability):'';
 show('billingAvailability',!!availability);
 $('billingSubscribe').disabled=busy||!checkoutReady||!$('billingConsent').checked;
}
async function perform(action){
 if(busy)return;busy=true;retryAction=action==='sync'?'sync':undefined;$('billingMessage').textContent=t('בודק את מצב החשבון…');show('billingRetry',false);
 for(const id of ['billingTrial','billingSubscribe','billingSync','billingCancel'])$(id).disabled=true;
 try{
  const data=await request(action);
  if(data.approvalUrl){const u=new URL(data.approvalUrl);if(u.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(u.hostname))throw Error('Invalid payment destination');location.assign(u.href);return;}
  state=data;render();$('billingMessage').textContent=action==='cancel'?t('החידוש החודשי בוטל.'):action==='sync'&&!state.access?t('טרם התקבל אישור תשלום. אפשר לבדוק שוב.'):'';
 }catch(e){
  if(e.status===401){state={...state,authenticated:false,access:false,status:'not_started',subscriptionStatus:null,canCancel:false,trialEndsAt:null,paidUntil:null,credits:null,subscriptionMonthlyPrice:null,subscriptionPlanId:null,priorCheckoutUnresolved:false};retryAction=undefined;}
  $('billingMessage').textContent=e.status?t(e.message):copy('error');show('billingRetry',true);
 }
 finally{busy=false;for(const id of ['billingTrial','billingSync','billingCancel'])$(id).disabled=false;render();}
}
const params=new URLSearchParams(location.search),returned=params.get('paypal')==='return';
if(Object.hasOwn(PLANS,params.get('plan')))$('billingPlan').value=params.get('plan');
// PayPal callback parameters are never proof of payment. The server looks up
// only the authenticated account's own saved subscription.
if(params.has('testPayment')||params.has('paypal')||params.has('subscription_id')||params.has('ba_token')||params.has('token'))history.replaceState(null,'','/subscription.html');
$('billingPlan').onchange=()=>{$('billingConsent').checked=false;render();};
$('billingTrial').onclick=()=>perform('start-trial');$('billingSubscribe').onclick=()=>{if(!$('billingSubscribe').disabled&&$('billingConsent').checked)perform('subscribe');};$('billingConsent').onchange=render;
$('billingSync').onclick=()=>perform('sync');$('billingRetry').onclick=()=>perform(retryAction);
$('billingCancel').onclick=()=>{if(window.confirm(t('לבטל את החידוש החודשי? הגישה ששולמה תישאר עד סוף התקופה.')))perform('cancel');};
for(const id of ['billingPlanDetails','billingConsentText','billingSubscribe','billingCredits'])$(id).setAttribute('translate','no');
window.addEventListener('asaf:language',render);
window.addEventListener('asaf:promotion',render);
renderPlan();
await perform();if(returned&&state?.authenticated&&state?.ready)await perform('sync');
