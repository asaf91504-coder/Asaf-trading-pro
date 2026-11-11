import {command,storageKey} from '../../server/storage.mjs';
import {billingReady,readBilling,saveBilling,withBillingLock,syncSubscription} from '../../server/billing.mjs';
import {createPayPal,verifyWebhook} from '../../server/paypal.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createWebhookHandler({env=process.env,run=command,now=()=>Date.now(),api=createPayPal({env})}={}){return async request=>{
 if(request.method!=='POST')return reply({error:'POST only'},405);
 if(!billingReady(env))return reply({error:'Billing unavailable'},503);
 try{
  const raw=await request.text();if(raw.length>100000)return reply({error:'Request too large'},413);
  let event;try{event=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
  if(!event?.id||!event?.event_type||!await verifyWebhook(request,event,api,env))return reply({error:'Invalid signature'},401);
  const type=event.event_type;
  if(!type.startsWith('BILLING.SUBSCRIPTION.')&&!['PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type))return reply({received:true});
  let id=type.startsWith('BILLING.SUBSCRIPTION.')?event.resource?.id:event.resource?.billing_agreement_id;
  // Refund events can omit billing_agreement_id; resolve the original sale
  // through PayPal, never by trusting a callback URL or browser-supplied ID.
  const sale=event.resource?.sale_id||(type.startsWith('PAYMENT.SALE.')?event.resource?.id:null);
  if(!id&&sale&&/^[A-Z0-9]+$/.test(sale))id=(await api('/v1/payments/sale/'+sale)).billing_agreement_id;
  if(!/^I-[A-Z0-9]+$/.test(id||''))return reply({received:true});
  const identity=await run(['GET',storageKey('billing:subscription:'+id,env)],{env});
  if(!identity)return reply({error:'Subscription mapping pending'},503);
  if(!/^[a-f0-9]{64}$/.test(identity))throw Error('Invalid billing identity');
  await withBillingLock(identity,async()=>{
   let record=await readBilling(identity,{env,run});
   if(record?.subscriptionId!==id)return; // A late event for an old subscription.
   if(['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type)&&sale){
    record={...record,paidUntil:0,revokedTransactionIds:[...new Set([...(record.revokedTransactionIds||[]),sale])].slice(-100)};
    await saveBilling(identity,record,{env,run});
   }
   await syncSubscription(identity,record,{env,run,api,now:now()});
  },{env,run});
  return reply({received:true});
 }catch{return reply({error:'Webhook processing unavailable; retry required'},503)}
};}
export default request=>createWebhookHandler()(request);
