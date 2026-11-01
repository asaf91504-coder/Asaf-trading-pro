export function planPosition({account, riskPercent, entry, stop, target, budget, side='long'}) {
  if (![account,riskPercent,entry,stop,target,budget].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||riskPercent>100||!['long','short'].includes(side)) throw Error('יש להזין מספרים חיוביים; סיכון עד 100% וכיוון עסקה תקין.');
  if (side==='long' ? !(stop<entry&&target>entry) : !(stop>entry&&target<entry)) throw Error(side==='long'?'בלונג: הסטופ מתחת לכניסה והיעד מעליה.':'בשורט: הסטופ מעל הכניסה והיעד מתחתיה.');
  const perShare=Math.abs(entry-stop), reward=Math.abs(target-entry), riskBudget=account*riskPercent/100;
  const riskShares=Math.floor(riskBudget/perShare), capitalShares=Math.floor(Math.min(account,budget)/entry), shares=Math.min(riskShares,capitalShares);
  if (!Number.isSafeInteger(shares)) throw Error('טווח החישוב גדול מדי; בדוק את המחירים ואת גודל התיק.');
  return {shares, riskBudget, actualRisk:shares*perShare, actualRiskPercent:shares*perShare/account*100, positionValue:shares*entry, targetProfit:shares*reward, ratio:reward/perShare, capitalLimited:capitalShares<riskShares};
}

// Field-level guidance is separate from calculation so incomplete input never
// silently becomes zero or leaves an old result visible.
export function positionInputErrors(input={}) {
 const errors={};
 const fields={account:'סכום התיק',riskPercent:'אחוז הסיכון',entry:'מחיר הכניסה',stop:'מחיר הסטופ',target:'מחיר היעד',budget:'ההון המרבי לעסקה'};
 for(const [key,label] of Object.entries(fields))if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<=0)errors[key]=label+': יש להזין מספר גדול מאפס.';
 if(!errors.riskPercent&&input.riskPercent>100)errors.riskPercent='אחוז הסיכון חייב להיות עד 100.';
 if(!['long','short'].includes(input.side??'long'))errors.side='יש לבחור לונג או שורט.';
 if(!errors.side&&!errors.entry){
  const short=input.side==='short';
  if(!errors.stop&&(short?input.stop<=input.entry:input.stop>=input.entry))errors.stop=short?'בשורט הסטופ חייב להיות מעל מחיר הכניסה.':'בלונג הסטופ חייב להיות מתחת למחיר הכניסה.';
  if(!errors.target&&(short?input.target>=input.entry:input.target<=input.entry))errors.target=short?'בשורט היעד חייב להיות מתחת למחיר הכניסה.':'בלונג היעד חייב להיות מעל מחיר הכניסה.';
 }
 return errors;
}

if (typeof document!=='undefined') {
  const $=id=>document.getElementById(id), outputs=['riskAmount','shares','rr','positionValue','targetProfit','actualRiskPct'];
  const number=n=>n.toLocaleString('en-US',{maximumFractionDigits:2}), money=n=>'$'+number(n);
  const fieldIds={account:'account',riskPercent:'pct',entry:'entry',stop:'stop',target:'target',budget:'positionBudget',side:'riskSide'};
  const fieldMessages=new Map();
  for(const id of Object.values(fieldIds)){
    const field=$(id),message=document.createElement('span');message.id=id+'Error';message.className='risk-field-error';message.hidden=true;field.after(message);fieldMessages.set(id,message);
    field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),message.id].filter(Boolean).join(' '));
  }
  function markFields(errors){
    for(const [key,id] of Object.entries(fieldIds)){const message=errors[key]||'';$(id).setAttribute('aria-invalid',String(Boolean(message)));fieldMessages.get(id).textContent=message;fieldMessages.get(id).hidden=!message}
  }
  function calculate({focusError=false}={}){
    try {
      const read=id=>{const v=$(id).value.trim();return v===''?NaN:Number(v)};
      const input={account:read('account'),riskPercent:read('pct'),entry:read('entry'),stop:read('stop'),target:read('target'),budget:read('positionBudget'),side:$('riskSide').value};
      const errors=positionInputErrors(input);markFields(errors);
      if(Object.keys(errors).length){
        if(focusError)$(fieldIds[Object.keys(errors)[0]]).focus();
        throw Error('לא ניתן לחשב: '+Object.values(errors).join(' '));
      }
      const r=planPosition(input);
      $('riskError').textContent='';
      const values=[money(r.actualRisk),number(r.shares),number(r.ratio)+':1',money(r.positionValue),money(r.targetProfit),number(r.actualRiskPercent)+'%'];
      outputs.forEach((id,i)=>$(id).textContent=values[i]);
      $('riskLimit').textContent=!r.shares?'התקציב אינו מספיק למניה שלמה אחת במסגרת הסיכון שנבחר.':r.capitalLimited?'הכמות הוגבלה לפי ההון הזמין לעסקה. תקציב הסיכון המרבי: '+money(r.riskBudget)+'.':'הכמות הוגבלה לפי תקציב הסיכון: '+money(r.riskBudget)+'.';
    } catch(err){outputs.forEach(id=>$(id).textContent='—');$('riskLimit').textContent='';$('riskError').textContent=err.message}
  }
  $('rr').dir='ltr';$('calc').onclick=()=>calculate({focusError:true});
  for(const id of ['account','pct','entry','stop','target','positionBudget','riskSide'])$(id).addEventListener('input',calculate);
  calculate();
}
