export function planPosition({account, riskPercent, entry, stop, target, budget, side='long'}) {
  if (![account,riskPercent,entry,stop,target,budget].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||riskPercent>100||!['long','short'].includes(side)) throw Error('יש להזין מספרים חיוביים; סיכון עד 100% וכיוון עסקה תקין.');
  if (side==='long' ? !(stop<entry&&target>entry) : !(stop>entry&&target<entry)) throw Error(side==='long'?'בלונג: הסטופ מתחת לכניסה והיעד מעליה.':'בשורט: הסטופ מעל הכניסה והיעד מתחתיה.');
  const perShare=Math.abs(entry-stop), reward=Math.abs(target-entry), riskBudget=account*riskPercent/100;
  const riskShares=Math.floor(riskBudget/perShare), capitalShares=Math.floor(Math.min(account,budget)/entry), shares=Math.min(riskShares,capitalShares);
  if (!Number.isSafeInteger(shares)) throw Error('טווח החישוב גדול מדי; בדוק את המחירים ואת גודל התיק.');
  return {shares, riskBudget, actualRisk:shares*perShare, actualRiskPercent:shares*perShare/account*100, positionValue:shares*entry, targetProfit:shares*reward, ratio:reward/perShare, capitalLimited:capitalShares<riskShares};
}

if (typeof document!=='undefined') {
  const $=id=>document.getElementById(id), outputs=['riskAmount','shares','rr','positionValue','targetProfit','actualRiskPct'];
  const number=n=>n.toLocaleString('en-US',{maximumFractionDigits:2}), money=n=>'$'+number(n);
  function calculate(){
    try {
      const read=id=>{const v=$(id).value.trim();return v===''?NaN:Number(v)};
      const r=planPosition({account:read('account'),riskPercent:read('pct'),entry:read('entry'),stop:read('stop'),target:read('target'),budget:read('positionBudget'),side:$('riskSide').value});
      $('riskError').textContent='';
      const values=[money(r.actualRisk),number(r.shares),number(r.ratio)+':1',money(r.positionValue),money(r.targetProfit),number(r.actualRiskPercent)+'%'];
      outputs.forEach((id,i)=>$(id).textContent=values[i]);
      $('riskLimit').textContent=!r.shares?'התקציב אינו מספיק למניה שלמה אחת במסגרת הסיכון שנבחר.':r.capitalLimited?'הכמות הוגבלה לפי ההון הזמין לעסקה. תקציב הסיכון המרבי: '+money(r.riskBudget)+'.':'הכמות הוגבלה לפי תקציב הסיכון: '+money(r.riskBudget)+'.';
    } catch(err){outputs.forEach(id=>$(id).textContent='—');$('riskLimit').textContent='';$('riskError').textContent=err.message}
  }
  $('rr').dir='ltr';$('calc').onclick=calculate;
  for(const id of ['account','pct','entry','stop','target','positionBudget','riskSide'])$(id).addEventListener('input',calculate);
  calculate();
}
