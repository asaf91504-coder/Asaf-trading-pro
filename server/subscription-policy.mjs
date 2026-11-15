// Versioned proposed catalog. Do not activate against the legacy USD 10 PayPal
// plan: each paid tier requires its own verified provider plan and checkout.
export const POLICY_VERSION = '2026-11-15';
export const PLANS = Object.freeze({
  trial: Object.freeze({id:'trial',priceUSD:0,dailyMessages:7,trialDays:14,premiumDailyLimit:1}),
  pro: Object.freeze({id:'pro',priceUSD:22,dailyMessages:40,premiumDailyLimit:8}),
  max: Object.freeze({id:'max',priceUSD:45,dailyMessages:100,premiumDailyLimit:20}),
});
export function planFor(id) {
  if(!Object.hasOwn(PLANS,id)) throw new Error('Unknown subscription tier');
  return PLANS[id];
}
export function consentFor(id) {
  const plan=planFor(id);
  if(!plan.priceUSD) throw new Error('Trial does not authorize a charge');
  return `USD${plan.priceUSD}_MONTHLY_${id.toUpperCase()}_V2`;
}
// UTC is deliberate: the reset is shared across devices, independent of a
// browser clock/time zone, and cannot be moved by changing client settings.
export function quotaWindow(now=Date.now()) {
  if(!Number.isFinite(now)) throw new Error('Invalid clock');
  const date=new Date(now);
  return {day:date.toISOString().slice(0,10),resetsAt:Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)};
}
export function usageDecision({tier,used,premiumUsed=0,complex=false,now=Date.now()}) {
  const plan=planFor(tier);
  if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(premiumUsed)||premiumUsed<0||premiumUsed>used) throw new Error('Invalid usage');
  const allowed=used<plan.dailyMessages;
  return {allowed,remaining:Math.max(0,plan.dailyMessages-used),limit:plan.dailyMessages,
    route:allowed?(complex&&premiumUsed<plan.premiumDailyLimit?'premium':'economy'):null,
    upgradeTo:tier==='trial'?'pro':tier==='pro'?'max':null,
    autoCharge:false,...quotaWindow(now)};
}
// Planning estimate only, not a spend cap. Input includes prompt, history,
// evidence and search results; billed output includes reasoning. No cache
// discount is assumed. Provider markups, retries, news jobs, image tokens,
// storage, market-data licensing, payment fees and taxes are excluded.
export function estimateMonthlyCost({users,days=30,messagesPerDay,inputTokens=5000,outputTokens=1000,premiumShare=.2,searchShare=.2,searchesPerSearchedMessage=1,economyInput=.10,economyOutput=.50,premiumInput=2,premiumOutput=10,searchPrice=.005}) {
  const nonnegative={users,days,messagesPerDay,inputTokens,outputTokens,searchesPerSearchedMessage,economyInput,economyOutput,premiumInput,premiumOutput,searchPrice};
  if(Object.values(nonnegative).some(n=>!Number.isFinite(n)||n<0)||![premiumShare,searchShare].every(n=>Number.isFinite(n)&&n>=0&&n<=1)) throw new Error('Invalid estimate inputs');
  const messages=users*days*messagesPerDay;
  const economy=messages*(1-premiumShare)*(inputTokens*economyInput+outputTokens*economyOutput)/1e6;
  const premium=messages*premiumShare*(inputTokens*premiumInput+outputTokens*premiumOutput)/1e6;
  const search=messages*searchShare*searchesPerSearchedMessage*searchPrice;
  return {messages,economy,premium,search,total:economy+premium+search};
}
