// Identify requests about the selected chart, without loading market data for
// general conversation or lessons about how technical analysis works.
export function requestsChartAnalysis(question,{command}={}){
 const text=String(question||'').trim();
 if(/(?:אל|לא)\s+(?:(?:רוצה|צריך|מבקש)\s+)?(?:ש?תנתח|לנתח|נתח)|\b(?:do not|don't|don’t)\s+(?:want (?:you )?to\s+)?analy[sz]e\b/iu.test(text))return false;
 if(/^(?:מה(?:ו|י)?\s+(?:זה\s+)?ניתוח|(?:תסביר|הסבר)\s+(?:לי\s+)?(?:מה(?:ו|י)?\s+)?ניתוח)|\b(?:what is|explain what)\s+(?:(?:stock|chart|technical)\s+)?analysis\b/iu.test(text))return false;
 if(/(?:איך|כיצד)\s+(?:מנתחים|לנתח|לקרוא|קוראים)|\bhow (?:do (?:I|you)|to) (?:analy[sz]e|read)\b/iu.test(text))return false;
 if(/^(?:(?:מהו|מהי|מה זה)\s+|(?:הסבר|תסביר)\s+(?:לי\s+)?(?:מה(?:ו|י)?|את המושג)\s+|(?:איך|כיצד)\s+(?:קובעים|מחשבים|משתמשים|להגדיר)\s+).*(?:כניסה|סטופ)|\b(?:what is|explain what|how to)\b.*\b(?:entry|stop)\b/iu.test(text))return false;
 if(/^(?:נתח|תנתח)(?:\s+בבקשה)?$|(?:נקודת כניסה|סטופ[־ -]?לוס|איפה.*(?:כניסה|סטופ)|\b(?:entry (?:point|price)|stop[ -]?loss)\b)/iu.test(text))return true;
 const analysis=/(?:תנתח|נתח|ניתוח|analy[sz]e|analysis)/iu.test(text);
 if(analysis&&command?.actions?.some(action=>action.type==='symbol'))return true;
 const chart=/(?:גרף|מניה|מנייה|המגמה|הנרות|\b(?:chart|stock|candles|trend)\b)/iu.test(text);
 return chart&&(analysis||/(?:תסביר|הסבר|מה (?:דעתך|המגמה|רואים)|\bexplain\b)/iu.test(text));
}

export function hasAnalysisCandles(data,symbol,interval){
 return !!data&&data.symbol===symbol&&data.interval===interval&&Array.isArray(data.bars)&&data.bars.length>=21;
}
