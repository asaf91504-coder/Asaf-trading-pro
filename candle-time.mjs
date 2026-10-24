// Validate the supplied calendar/clock without guessing an exchange timezone.
// Offsets, when supported by the CSV parser, are converted separately to UTC.
export function validCandleTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value))return false;
 const date=value.slice(0,10),time=value.length===10?'00:00:00':value.slice(11).padEnd(8,':00'),expected=date+'T'+time,parsed=new Date(expected+'Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===expected;
}
