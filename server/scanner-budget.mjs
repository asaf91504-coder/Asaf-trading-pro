import {twelveSettings} from './twelve-config.mjs';
// Conservative cold-cache planning. The shared atomic quota remains authoritative
// when charts, other members or background jobs consume the same provider budget.
export function scannerBatchPlan(env,{fundamentals=false}={}){
 const {minuteCredits,dailyCredits}=twelveSettings(env);
 const creditsPerSymbol=(fundamentals?51:1)+(env.ASAF_SCANNER_DAILY_VOLUME_ENABLED==='true'?1:0);
 const maxSymbols=Math.min(10,Math.floor(Math.min(minuteCredits,dailyCredits)/creditsPerSymbol));
 const batchDelayMs=maxSymbols*creditsPerSymbol*2>minuteCredits?61000:31000;
 return {maxSymbols,batchDelayMs};
}

export function scannerCapacity(env,{symbols,fundamentals=false}={}){
 const {minuteCredits,dailyCredits}=twelveSettings(env),plan=scannerBatchPlan(env,{fundamentals});
 const priceCredits=env.ASAF_SCANNER_DAILY_VOLUME_ENABLED==='true'?2:1;
 const coldCredits=symbols*(priceCredits+(fundamentals?50:0));
 return {symbols,coldCredits,dailyBudget:dailyCredits,minuteBudget:minuteCredits,
  coldMinutes:plan.maxSymbols?Math.ceil(symbols/plan.maxSymbols):null,
  coldFitsDailyBudget:coldCredits<=dailyCredits,
  threeHourCyclePossible:plan.maxSymbols>0&&Math.ceil(symbols/plan.maxSymbols)<=180};
}
