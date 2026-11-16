// Daily labels are exchange-local dates; Twelve Data ignores timezone=UTC for them.
export function newYorkDate(now=Date.now()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}
export function previousDailyBars(bars,now=Date.now()){
 const today=newYorkDate(now);
 return bars.filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date)&&b.date<today);
}
export function marketCoverage(interval,volumeCoverage='unconfirmed'){
 const volume=volumeCoverage==='consolidated'?'מחזור מאוחד לפי הגדרת המסלול שאושרה.':volumeCoverage==='partial'?'מחזור מזירות נבחרות בלבד; אינו מחזור שוק מאוחד.':'כיסוי נפח המסחר טרם אומת; אין להניח שזהו מחזור השוק המלא.';
 return (interval==='1day'?'נרות יומיים קודמים בלבד. ':interval==='1week'?'נרות שבועיים; השבוע האחרון עשוי להיות חלקי. ':'נרות תוך־יומיים; הנר האחרון עשוי להיות חלקי. ')+volume;
}
export function marketCapAvailable(record,now=Date.now()){
 const cap=record?.fundamentals,age=now-Date.parse(cap?.receivedAt);
 return cap?.status==='available'&&cap.source==='Twelve Data'&&cap.currency==='USD'&&cap.symbol===String(record.symbol||'').split(':').at(-1)&&Number.isFinite(cap.marketCap)&&cap.marketCap>0&&age>=0&&age<86400000;
}
export function marketCapLabel(record,now=Date.now()){
 return marketCapAvailable(record,now)?'שווי שוק $'+record.fundamentals.marketCap.toLocaleString('en-US',{maximumFractionDigits:0})+' · התקבל '+new Date(record.fundamentals.receivedAt).toLocaleString('he-IL'):'שווי שוק לא זמין או פג תוקף';
}

export function marketSnapshotMetadata(data={}){
 return {coverage:typeof data.coverage==='string'?data.coverage.slice(0,500):null,exchangeTimezone:typeof data.exchangeTimezone==='string'?data.exchangeTimezone:null,barPolicy:data.barPolicy==='previous-daily-sessions'?'previous-daily-sessions':'may-include-open-candle',latestBarMayBePartial:data.latestBarMayBePartial!==false};
}
