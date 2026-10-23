import {parseCSV,stockContext} from './market-chat.mjs';
// Keep chart history separate from the small, bounded payload sent to AI.
export const CHART_HISTORY_LIMIT=2000;
export function prepareChartData(text,selectedSymbol){
 if(typeof text!=='string'||text.length>2000000)throw Error('נתוני CSV גדולים מ-2MB');
 const symbol=String(selectedSymbol||'').trim().toUpperCase();
 if(!/^[A-Z0-9:._-]{1,30}$/.test(symbol))throw Error('יש לבחור סימול מניה תקין');
 const all=parseCSV(text),symbols=[...new Set(all.map(b=>b.ticker).filter(Boolean))];
 if(symbols.length>1)throw Error('בקובץ מופיעות כמה מניות; יש לבחור נתוני מניה אחת');
 if(symbols.some(s=>s.split(':').at(-1)!==symbol.split(':').at(-1)))throw Error('הסימול בנתונים אינו תואם לסימול שנבחר');
 const bars=all.slice(-CHART_HISTORY_LIMIT),interval=bars.some(b=>b.date.length>10)?'intraday':'1day';
 return {symbol,bars,interval,context:stockContext(symbol,bars,{source:'CSV',interval})};
}
export const recentAIBars=bars=>Array.isArray(bars)?bars.slice(-CHART_HISTORY_LIMIT):null;
