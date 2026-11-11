// PayPal credentials and requests stay on the server. No SDK or payment data in the browser.
import {storageKey} from './storage.mjs';
export function paypalConfigured(env=process.env){
 return ['live','sandbox'].includes(env.PAYPAL_ENVIRONMENT)&&!!env.PAYPAL_CLIENT_ID&&!!env.PAYPAL_CLIENT_SECRET&&/^P-[A-Z0-9]+$/.test(env.PAYPAL_PLAN_ID||'')&&!!env.PAYPAL_WEBHOOK_ID&&
  (env.PAYPAL_ENVIRONMENT!=='live'||storageKey('x',env).startsWith('asaf:production:'));
}
export function createPayPal({env=process.env,fetcher=fetch}={}){
 const base=env.PAYPAL_ENVIRONMENT==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
 let token;
 return async function api(path,{method='GET',body,requestId}={}){
  if(!paypalConfigured(env))throw Error('PayPal is not configured');
  if(!token){
   const r=await fetcher(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(8000)});
   const data=await r.json();if(!r.ok||!data.access_token)throw Error('PayPal authorization unavailable');token=data.access_token;
  }
  const r=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('PayPal request unavailable');
  return r.status===204?{}:r.json();
 };
}
export function validatePlan(plan,planId){
 const cycles=plan?.billing_cycles,c=cycles?.[0],fee=plan?.payment_preferences?.setup_fee;
 if(plan?.id!==planId||plan.status!=='ACTIVE'||cycles?.length!==1||c.tenure_type!=='REGULAR'||c.frequency?.interval_unit!=='MONTH'||c.frequency.interval_count!==1||c.total_cycles!==0||c.pricing_scheme?.fixed_price?.currency_code!=='USD'||Number(c.pricing_scheme.fixed_price.value)!==10||Number(fee?.value||0)!==0||Number(plan.taxes?.percentage||0)!==0||plan.quantity_supported===true||plan.payment_preferences?.auto_bill_outstanding!==false||plan.payment_preferences?.payment_failure_threshold!==1)throw Error('Expected a fixed USD 10 monthly plan with no trial or extra fees');
}
export function approvalLink(subscription,env=process.env){
 const raw=subscription?.links?.find(x=>x.rel==='approve')?.href;
 if(!raw)return null;
 const u=new URL(raw),host=env.PAYPAL_ENVIRONMENT==='live'?'www.paypal.com':'www.sandbox.paypal.com';
 if(u.protocol!=='https:'||u.hostname!==host||u.port||u.username||u.password)throw Error('Unexpected PayPal approval URL');
 return u.href;
}
export async function verifyWebhook(request,event,api,env=process.env){
 const fields={'auth_algo':'paypal-auth-algo','cert_url':'paypal-cert-url','transmission_id':'paypal-transmission-id','transmission_sig':'paypal-transmission-sig','transmission_time':'paypal-transmission-time'},body={webhook_id:env.PAYPAL_WEBHOOK_ID,webhook_event:event};
 for(const [field,header] of Object.entries(fields)){body[field]=request.headers.get(header);if(!body[field]||body[field].length>4096)return false;}
 const result=await api('/v1/notifications/verify-webhook-signature',{method:'POST',body});
 return result.verification_status==='SUCCESS';
}
