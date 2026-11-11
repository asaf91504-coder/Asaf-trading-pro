// Owner-authorized live setup. Does not create subscriptions or payments.
// Production build credentials remain on Netlify; only public resource IDs are logged.
import {validatePlan} from '../server/paypal.mjs';
const env=process.env;
if(env.CONTEXT!=='production'||env.BRANCH!=='main'||env.PAYPAL_ENVIRONMENT!=='live'||env.ASAF_BILLING_ENABLED==='true'){
 console.log('Live setup skipped outside pre-launch production.');
 process.exit(0);
}
if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)throw Error('Live credentials missing.');
const base='https://api-m.paypal.com';
try {
 const auth=await fetch(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});
 if(!auth.ok)throw Error('Live authentication rejected: '+auth.status);
 const {access_token}=await auth.json();
 if(!access_token)throw Error('No live access token.');
 async function api(path,body,requestId){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Live operation rejected: '+response.status);
  return response.json();
 }
 async function find(path,field,name){
  for(let page=1;page<=20;page++){
   const list=await api(path+(path.includes('?')?'&':'?')+'page_size=20&page='+page+'&total_required=true');
   const items=list[field]||[],item=items.find(x=>x.name===name);
   if(item)return item;
   if(items.length<20)return null;
  }
  throw Error('Too many live records; manual reconciliation needed.');
 }
 const productName='ASAF Pro Live Monthly';
 const product=await find('/v1/catalogs/products','products',productName)||await api('/v1/catalogs/products',{name:productName,description:'ASAF Pro Live only. Trial is managed by the application.',type:'SERVICE',category:'SOFTWARE'},'asaf-live-product-20261111');
 const planName='ASAF Pro USD 10 Monthly - Live';
 const plan=await find('/v1/billing/plans?product_id='+product.id,'plans',planName)||await api('/v1/billing/plans',{product_id:product.id,name:planName,description:'USD 10 per calendar month after the application-managed trial. Live only.',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:'10.00',currency_code:'USD'}}}],payment_preferences:{auto_bill_outstanding:false,setup_fee:{value:'0',currency_code:'USD'},setup_fee_failure_action:'CANCEL',payment_failure_threshold:1}},'asaf-live-plan-20261111');
 const detail=await api('/v1/billing/plans/'+plan.id);
 validatePlan(detail,plan.id);
 const webhookUrl='https://joyful-seahorse-967889.netlify.app/.netlify/functions/paypal-webhook';
 const events=['BILLING.SUBSCRIPTION.CREATED','BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED','BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED','PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'];
 const hooks=await api('/v1/notifications/webhooks');
 const hook=hooks.webhooks?.find(h=>h.url===webhookUrl)||await api('/v1/notifications/webhooks',{url:webhookUrl,event_types:events.map(name=>({name}))});
 if(!hook.id||!events.every(name=>hook.event_types.some(e=>e.name===name||e.name==='*')))throw Error('Webhook configuration incomplete');
 console.log('ASAF_PAYPAL_LIVE_VERIFIED '+JSON.stringify({environment:'live',productId:product.id,planId:plan.id,webhookId:hook.id,webhookUrl,status:detail.status,currency:'USD',monthlyPrice:10,trial:'managed_by_application',paymentCreated:false}));
}catch(error){
 console.error('Live provisioning incomplete: '+String(error.message).replace(/Bearer\s+\S+/g,'[hidden]'));
 process.exitCode=1;
}
