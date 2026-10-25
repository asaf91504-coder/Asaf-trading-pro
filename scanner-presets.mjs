import {patternLabels} from './pattern-research.mjs';
export const scannerFields={
 scanMinPrice:{default:5,min:0,max:1e12},scanMinVolume:{default:1,min:0,max:1e9},scanMinATR:{default:0,min:0,max:10000},scanMinRSI:{default:0,min:0,max:100},scanMaxRSI:{default:100,min:0,max:100},scanMinADX:{default:25,min:0,max:100},scanMinMeasuredMove:{default:0,min:0,max:1000},scanMinScenarioRR:{default:0,min:0,max:100},
 scanAbove20:{default:true},scanBreakout20:{default:false},scanRisingVolume:{default:false},scanRSIEnabled:{default:false},scanMACDSignal:{default:false},scanMACDPositive:{default:false},scanStochastic:{default:false},scanOBVRising:{default:false},scanADXEnabled:{default:false},scanPatternCrossed:{default:false},scanOnlyMatches:{default:false},
 scanDIDirection:{default:'any',values:['any','up','down']},scanSupertrend:{default:'any',values:['any','up','down']},scanPattern:{default:'any',values:['any',...Object.keys(patternLabels)]},scanSort:{default:'atr',values:['atr','volume','symbol','scenario']}
};
export function scannerSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('הגדרות הסריקה אינן תקינות');const result={};
 for(const [key,spec] of Object.entries(scannerFields)){const value=input[key]===undefined?spec.default:input[key];if(typeof value!==typeof spec.default||typeof value==='number'&&(!Number.isFinite(value)||value<spec.min||value>spec.max)||spec.values&&!spec.values.includes(value))throw Error('ערך לא תקין במסנן '+key);result[key]=value}
 if(result.scanMinRSI>result.scanMaxRSI)throw Error('טווח RSI הפוך');return result;
}
export const scannerDefaults=()=>scannerSettings();
export const asafScannerPreset=()=>scannerSettings({scanMinPrice:5,scanAbove20:true,scanRisingVolume:true,scanMinMeasuredMove:15,scanSort:'atr',scanOnlyMatches:true});
