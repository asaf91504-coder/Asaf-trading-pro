// Local calculations only; no market data requests or paid services.
const number = value => {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text || /^(null|nan|n\/a|-)$/i.test(text)) return NaN;
  return Number(text);
};
function csvRow(line) {
  const cells = []; let current = '', quoted = false;
  for (let i=0; i<line.length; i++) {
    const c=line[i];
    if (c==='"' && quoted && line[i+1]==='"') {current+='"';i++;}
    else if (c==='"') quoted=!quoted;
    else if (c===',' && !quoted) {cells.push(current.trim());current='';}
    else current+=c;
  }
  cells.push(current.trim());
  return cells;
}
export function parseCSV(csv) {
  if (typeof csv !== 'string' || csv.length > 2_000_000) throw Error('קובץ גדול מדי או לא תקין');
  const lines=csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x=>x.trim());
  if (lines.length<3) throw Error('נדרשות לפחות שתי שורות נתונים');
  const cols=csvRow(lines[0]).map(x=>x.toLowerCase().replace(/\s+/g,'').replace(/[^a-z]/g,''));
  const pick=(...names)=>cols.findIndex(x=>names.includes(x));
  const ix={date:pick('date','datetime','time'),open:pick('open'),high:pick('high'),low:pick('low'),close:pick('close'),volume:pick('volume','vol')};
  if ([ix.date,ix.high,ix.low,ix.close].some(x=>x<0)) throw Error('חסרות עמודות Date, High, Low, Close');
  const rows=[];
  for(const line of lines.slice(1)) {
    const c=csvRow(line);const date=c[ix.date],high=number(c[ix.high]),low=number(c[ix.low]),close=number(c[ix.close]),volume=ix.volume<0?null:number(c[ix.volume]);
    if(!/^\d{4}-\d{2}-\d{2}/.test(date||'')) continue;
    if(![high,low,close].every(Number.isFinite)||low<=0||high<low||close<low||close>high) continue;
    rows.push({date:date.slice(0,10),high,low,close,volume:Number.isFinite(volume)&&volume>=0?volume:null});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  const uniq=new Map(rows.map(x=>[x.date,x]));
  return [...uniq.values()];
}
const average=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
const round=x=>Math.round(x*10000)/10000;
export function analyze(bars) {
  if(!Array.isArray(bars)||bars.length<21) throw Error('צריך לפחות 21 נרות יומיים תקינים');
  const last=bars.at(-1),previous=bars.slice(0,-1);
  const sma20=average(bars.slice(-20).map(x=>x.close));
  const sma150=bars.length>=150?average(bars.slice(-150).map(x=>x.close)):null;
  const prevHigh20=Math.max(...previous.slice(-20).map(x=>x.high));
  const trs=bars.slice(1).map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-bars[i].close),Math.abs(x.low-bars[i].close)));
  let atr14=null;
  if(trs.length>=14) {
    atr14=average(trs.slice(0,14));
    for(const tr of trs.slice(14)) atr14=(atr14*13+tr)/14;
  }
  const prevVol=previous.slice(-20).map(x=>x.volume);
  const volumeRatio=last.volume!==null&&prevVol.length===20&&prevVol.every(x=>x!==null)&&average(prevVol)>0?last.volume/average(prevVol):null;
  return {date:last.date,close:round(last.close),bars:bars.length,sma20:round(sma20),sma150:sma150===null?null:round(sma150),atr14:atr14===null?null:round(atr14),atrPercent:atr14===null?null:round(atr14/last.close*100),prior20DayHigh:round(prevHigh20),aboveMA20:last.close>sma20,aboveMA150:sma150===null?null:last.close>sma150,breakout20:last.close>prevHigh20,volumeRatio:volumeRatio===null?null:round(volumeRatio)};
}