const $=id=>document.getElementById(id),t=text=>window.asafTranslate?.(text)||text;
let state=null,busy=false,retryAction;
const show=(id,visible)=>{$(id).hidden=!visible;};
const date=value=>new Intl.DateTimeFormat(document.documentElement.lang||'he',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
async function request(action){
 const r=await fetch('/.netlify/functions/billing',{method:action?'POST':'GET',cache:'no-store',headers:action?{'Content-Type':'application/json'}:{},...(action?{body:JSON.stringify({action,...(action==='subscribe'?{consent:'USD10_MONTHLY_V1'}:{})})}:{}),signal:AbortSignal.timeout(45000)});
 const data=await r.json();if(!r.ok){const error=Error(data.error||t('לא ניתן לבדוק את המנוי כרגע. נסה שוב.'));error.status=r.status;throw error;}return data;
}
function render(){
 if(!state)return;
 const ready=state.ready===true,auth=state.authenticated===true;
 $('billingStatus').textContent=t(!ready?'ההרשמה למנוי תיפתח בקרוב. החיוב עדיין אינו פעיל.':!auth?'התחבר לחשבון כדי לקבל 14 ימים בחינם.':state.status==='trial'?'תקופת הניסיון שלך פעילה.':state.status==='paid'?'המנוי שלך פעיל.':state.status==='expired'?'תקופת הניסיון הסתיימה.':'14 ימי ניסיון בחינם מחכים לך.');
 if(ready&&auth&&!state.access&&state.subscriptionStatus==='APPROVAL_PENDING')$('billingStatus').textContent=t('ממתינים לאישור המנוי ב־PayPal.');
 if(ready&&auth&&!state.access&&['ACTIVE','APPROVED'].includes(state.subscriptionStatus))$('billingStatus').textContent=t('המנוי אושר, אך עדיין אין אישור לתשלום. לחץ על בדיקת תשלום.');
 if(ready&&auth&&!state.access&&state.subscriptionStatus==='SUSPENDED')$('billingStatus').textContent=t('המנוי הושהה. בדוק את אמצעי התשלום בחשבון PayPal.');
 $('billingDate').textContent=state.status==='trial'?t('סיום הניסיון:')+' '+date(state.trialEndsAt):state.status==='paid'?t('גישה עד:')+' '+date(state.paidUntil):'';
 if(state.subscriptionStatus==='CANCELLED')$('billingDate').textContent+=' '+t('החידוש החודשי בוטל.');
 show('billingSandbox',state.sandbox===true);show('billingLogin',ready&&!auth);show('billingTrial',ready&&auth&&state.status==='not_started');show('billingContinue',ready&&auth&&state.access);
 show('billingCheckout',ready&&auth&&state.status==='expired'&&!state.canCancel);show('billingCancel',ready&&auth&&state.canCancel);show('billingSync',ready&&auth&&!!state.subscriptionStatus);
 $('billingSubscribe').disabled=busy||!$('billingConsent').checked;
}
async function perform(action){
 if(busy)return;busy=true;retryAction=action==='sync'?'sync':undefined;$('billingMessage').textContent=t('בודק את מצב החשבון…');show('billingRetry',false);
 for(const id of ['billingTrial','billingSubscribe','billingSync','billingCancel'])$(id).disabled=true;
 try{
  const data=await request(action);
  if(data.approvalUrl){const u=new URL(data.approvalUrl);if(u.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(u.hostname))throw Error('Invalid payment destination');location.assign(u.href);return;}
  state=data;render();$('billingMessage').textContent=action==='cancel'?t('החידוש החודשי בוטל.'):action==='sync'&&!state.access?t('טרם התקבל אישור תשלום. אפשר לבדוק שוב.'):'';
 }catch(e){
  if(e.status===401){state={...state,authenticated:false,access:false,status:'not_started',subscriptionStatus:null,canCancel:false,trialEndsAt:null,paidUntil:null};retryAction=undefined;}
  $('billingMessage').textContent=t(e.message);show('billingRetry',true);
 }
 finally{busy=false;for(const id of ['billingTrial','billingSync','billingCancel'])$(id).disabled=false;render();}
}
const params=new URLSearchParams(location.search),returned=params.get('paypal')==='return';
// PayPal callback parameters are never proof of payment. The server looks up
// only the authenticated account's own saved subscription.
if(params.has('paypal')||params.has('subscription_id')||params.has('ba_token')||params.has('token'))history.replaceState(null,'','/subscription.html');
$('billingTrial').onclick=()=>perform('start-trial');$('billingSubscribe').onclick=()=>{if($('billingConsent').checked)perform('subscribe');};$('billingConsent').onchange=render;
$('billingSync').onclick=()=>perform('sync');$('billingRetry').onclick=()=>perform(retryAction);
$('billingCancel').onclick=()=>{if(window.confirm(t('לבטל את החידוש החודשי? הגישה ששולמה תישאר עד סוף התקופה.')))perform('cancel');};
window.addEventListener('asaf:language',render);
await perform();if(returned&&state?.authenticated&&state?.ready)await perform('sync');
