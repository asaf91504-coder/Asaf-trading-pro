import {patternLabels} from './pattern-research.mjs';
// Only candidate-selection constraints cross from scanner to chart, never
// client coordinates, bars or an invented scenario.
export function scannerScenarioFilters(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['pattern','crossedOnly','minMeasuredMove','minScenarioRR'].includes(k)))throw Error('Invalid scanner scenario filters');
 const result={pattern:value.pattern??'any',crossedOnly:value.crossedOnly??false,minMeasuredMove:value.minMeasuredMove??0,minScenarioRR:value.minScenarioRR??0};
 if(result.pattern!=='any'&&!Object.hasOwn(patternLabels,result.pattern)||typeof result.crossedOnly!=='boolean'||!Number.isFinite(result.minMeasuredMove)||result.minMeasuredMove<0||result.minMeasuredMove>1000||!Number.isFinite(result.minScenarioRR)||result.minScenarioRR<0||result.minScenarioRR>100)throw Error('Invalid scanner scenario filters');
 return result;
}
