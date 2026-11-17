import {twelveSettings} from './twelve-config.mjs';
// Conservative cold-cache planning. The shared atomic quota remains authoritative
// when charts, other members or background jobs consume the same provider budget.
export function scannerBatchPlan(env,{fundamentals=false}={}){
 const {minuteCredits,dailyCredits}=twelveSettings(env);
 const creditsPerSymbol=fundamentals?51:1;
 const maxSymbols=Math.min(10,Math.floor(Math.min(minuteCredits,dailyCredits)/creditsPerSymbol));
 const batchDelayMs=maxSymbols*creditsPerSymbol*2>minuteCredits?61000:31000;
 return {maxSymbols,batchDelayMs};
}
