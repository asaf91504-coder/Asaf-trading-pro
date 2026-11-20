// Public prices are USD/month; allowances renew every seven days, never daily.
export const NEW_TRIAL_CREDITS=50;
export const WEEK=7*86400000;
export const CREDIT_USD_CEILING=0.02;
export const PLANS=Object.freeze({
 starter:Object.freeze({id:'starter',price:55,weeklyCredits:150,bonusPercent:10}),
 plus:Object.freeze({id:'plus',price:75,weeklyCredits:300,bonusPercent:12}),
 pro:Object.freeze({id:'pro',price:115,weeklyCredits:600,bonusPercent:20}),
 premium:Object.freeze({id:'premium',price:359,weeklyCredits:2500,bonusPercent:20})
});
export const creditsEnabled=(env=process.env)=>env.ASAF_WEEKLY_CREDITS_ENABLED==='true';
export const planEnv=id=>'PAYPAL_PLAN_'+id.toUpperCase()+'_ID';
export function planFor(id){if(!Object.hasOwn(PLANS,id))throw Error('Unknown plan');return PLANS[id]}
export function configuredPlans(env=process.env){return Object.values(PLANS).map(p=>({...p,paypalPlanId:env[planEnv(p.id)]}));}
export function creditPlansReady(env=process.env){const ids=configuredPlans(env).map(p=>p.paypalPlanId);return ids.every(id=>/^P-[A-Z0-9]+$/.test(id||''))&&new Set(ids).size===4;}
export const consentFor=id=>`USD${planFor(id).price}_MONTHLY_WEEKLY_V1`;
// Paid accounts get a new anchor only on first verified payment, not on login,
// renewal, or a duplicate webhook. A bonus stops at the first calendar month.
export function creditWindow(record,now=Date.now()){
 if(record?.paidUntil>now){
  if(!record.planId)return null; // grandfathered $10 account; never silently migrate
  const p=planFor(record.planId),anchor=record.creditAnchor;
  if(!Number.isFinite(anchor)||anchor>now)throw Error('Missing verified credit anchor');
  const period=Math.floor((now-anchor)/WEEK),start=anchor+period*WEEK;
  const bonus=Number.isFinite(record.bonusUntil)&&now<record.bonusUntil;
  return {key:`paid:${anchor}:${period}`,limit:p.weeklyCredits+(bonus?Math.floor(p.weeklyCredits*p.bonusPercent/100):0),startsAt:start,resetsAt:Math.min(start+WEEK,record.paidUntil,bonus?record.bonusUntil:Infinity),planId:p.id};
 }
 const anchor=record?.trialStartedAt,end=Math.max(record?.trialEndsAt||0,record?.complimentaryUntil||0);
 if(!Number.isFinite(anchor)||![7,14].some(days=>record.trialEndsAt===anchor+days*86400000)||now<anchor||now>=end)return null;
 // Missing allowance identifies previously granted trials; never reduce their balance.
 const limit=record.trialTotalCredits===undefined?100:record.trialTotalCredits;
 if(!Number.isSafeInteger(limit)||limit<0)throw Error('Invalid trial allowance');
 return {key:`trial-total:${anchor}`,limit,startsAt:anchor,resetsAt:end,planId:'trial'};
}
export function creditsForCost(usd){if(!Number.isFinite(usd)||usd<0)throw Error('Invalid cost');return Math.max(1,Math.ceil((usd-1e-10)/CREDIT_USD_CEILING));}
