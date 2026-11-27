let current={phase:'idle'};
const copy={
 idle:['בחר מניה וטען את הגרף.','חפש חברה לפי שם או סימול כדי להתחיל.'],
 loading:['המניה נבחרה — טוען נתונים…','הגרף יוצג לאחר קבלת נתוני שוק תקינים.'],
 error:['המניה נבחרה; הנתונים לא נטענו.','נסה לטעון שוב או פתח גרף מתוצאות הסורק שכבר זמינות.'],
 quota:['המניה נבחרה; מכסת הנתונים נוצלה כרגע.','אפשר לפתוח גרף מתוצאות הסורק שכבר זמינות, או לנסות שוב לאחר חידוש המכסה.']
};
export function chartLoadState({phase='idle',error='',hasChart=false}={}){
 current={phase,error,hasChart};
 const panel=document.getElementById('chartEmpty'),title=panel?.querySelector('h2'),description=panel?.querySelector('p');
 if(!title||!description)return;
 const state=phase==='error'&&/מכס|קרדיט|quota|429/i.test(error)?'quota':phase==='ready'?'idle':phase;
 const [heading,note]=copy[state]||copy.idle,tr=value=>globalThis.window?.asafTranslate?.(value)??value;
 title.textContent=tr(heading);description.textContent=tr(note);
 if((phase==='loading'||phase==='error')&&!hasChart)panel.hidden=false;
 if(phase==='ready'&&hasChart)panel.hidden=true;
 let retry=panel.querySelector('[data-chart-retry]');
 if(!retry){retry=document.createElement('button');retry.type='button';retry.dataset.chartRetry='';retry.onclick=()=>document.getElementById('marketFetch')?.click();panel.append(retry);}
 retry.textContent=tr('נסה לטעון שוב');retry.hidden=phase!=='error'||hasChart;
}
if(typeof window!=='undefined')window.addEventListener('asaf:language',()=>chartLoadState(current));
