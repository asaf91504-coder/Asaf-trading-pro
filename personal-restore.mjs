import {personalData,parsePersonalBackup,mergePersonal} from './personal-data.mjs';

export function preparePersonalRestore(section,current,text){
 const local=personalData(section,current),incoming=parsePersonalBackup(text,section),merged=mergePersonal(section,local,incoming);
 const keys=value=>Array.isArray(value)?value.map(x=>x.id):Object.keys(value),a=new Set(keys(local)),b=keys(incoming);
 return {section,text,before:JSON.stringify(local),data:merged,counts:{current:a.size,incoming:b.length,merged:keys(merged).length,overlapping:b.filter(k=>a.has(k)).length}};
}
export function completePersonalRestore(plan,section,current,text){
 if(!plan||plan.section!==section||plan.text!==text||plan.before!==JSON.stringify(personalData(section,current)))throw Error('הנתונים או סוג הגיבוי השתנו מאז התצוגה המקדימה. בדוק שוב לפני המיזוג.');
 return personalData(section,plan.data);
}
