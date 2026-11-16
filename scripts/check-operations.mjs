import {checkDeployment} from './check-deployment.mjs';
const origin='https://joyful-seahorse-967889.netlify.app';
const report=await checkDeployment(origin);
for(const [name,path,expected] of [['retired payment test','/.netlify/functions/payment-test',410],['help','/help.html',200],['subscriptions','/subscription.html',200]]){
 try{const r=await fetch(origin+path,{redirect:'follow',signal:AbortSignal.timeout(15000)});report.checks.push({name,passed:r.status===expected});}catch{report.checks.push({name,passed:false});}
}
// English reads the common RSS cache; it cannot trigger a translation/model call.
try{const r=await fetch(origin+'/.netlify/functions/news?lang=en',{signal:AbortSignal.timeout(20000)});const news=await r.json();const age=Date.now()-Date.parse(news.updatedAt);report.checks.push({name:'news cache refreshed within 45 minutes',passed:r.ok&&news.enabled===true&&Number.isFinite(age)&&age>=-60000&&age<45*60000});}catch{report.checks.push({name:'news cache refreshed within 45 minutes',passed:false});}
report.operational=report.checks.every(c=>c.passed);
console.log(JSON.stringify(report,null,2));process.exitCode=report.operational?0:1;
