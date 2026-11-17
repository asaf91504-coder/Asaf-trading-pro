// Twelve Data owner-only connector. Disabled by default. No OpenAI calls.
// Never put a provider API key in frontend code or the repository.
import {validCandleTime} from '../../candle-time.mjs';
const respond=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export const validateBar=item=>{
  if(!item||typeof item!=='object')return null;
  const open=Number(item.open),high=Number(item.high),low=Number(item.low),close=Number(item.close);
  const vol=item.volume===undefined||item.volume===null||typeof item.volume==='boolean'||String(item.volume).trim()===''?null:Number(item.volume);
  const date=typeof item.datetime==="string"?item.datetime:"";
  if(!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(date)||!validCandleTime(date))return null;
  if(![open,high,low,close].every(Number.isFinite)||low<=0||high<low||open<low||open>high||close<low||close>high)return null;
  return {date,open,high,low,close,volume:vol!==null&&Number.isFinite(vol)&&vol>=0?vol:null};
};
// The old passcode route must never become a raw-data bypass in Venture mode.
export default async function handler() {
 return respond({error:'החיבור הישן הוחלף בתמונות גרף מהשרת. יש להיכנס לחשבון.'},410);
}
