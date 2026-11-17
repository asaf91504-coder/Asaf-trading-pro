import {createHash} from 'node:crypto';
import {planFor} from './plans.mjs';
// Server-owned recurring discounts. Dedicated PayPal plans must be created and
// verified before a code is enabled. Never accept a price from the browser.
export function resolvePromotion(code,planId,{env=process.env,now=Date.now()}={}){
 if(code==null||code==='')return null;
 if(typeof code!=='string'||!/^[-A-Za-z0-9_]{1,64}$/.test(code.trim()))throw Error('Invalid promo code');
 const entries=JSON.parse(env.ASAF_PROMOTIONS_JSON||'[]');
 if(!Array.isArray(entries))throw Error('Invalid promotions configuration');
 const normalized=code.trim().toUpperCase();
 const promo=entries.find(p=>p.code===normalized&&p.planId===planId&&p.enabled===true);
 const base=planFor(planId);
 if(!promo||!base||!Number.isFinite(Date.parse(promo.expiresAt))||now>=Date.parse(promo.expiresAt)||!Number.isFinite(Date.parse(promo.startsAt))||now<Date.parse(promo.startsAt)||!/^P-[A-Z0-9]+$/.test(promo.paypalPlanId||'')||!Number.isFinite(promo.monthlyPrice)||promo.monthlyPrice<=0||promo.monthlyPrice>=base.price||Math.abs(Math.round(promo.monthlyPrice*100)-promo.monthlyPrice*100)>1e-6)throw Error('Promo code unavailable for this plan');
 const result={code:normalized,planId,monthlyPrice:promo.monthlyPrice,paypalPlanId:promo.paypalPlanId};
 return {...result,consent:'PROMO_MONTHLY_V1_'+createHash('sha256').update(JSON.stringify(result)).digest('hex')};
}
export function publicPromotion(promo){return {code:promo.code,planId:promo.planId,monthlyPrice:promo.monthlyPrice,currency:'USD',recurring:true,consent:promo.consent};}
