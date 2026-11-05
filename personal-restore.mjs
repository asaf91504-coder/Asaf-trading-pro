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

export async function prepareFileRestore({file,section,read,getMember,confirm}){
 const member=getMember(),before=read(section);
 if(file.size>750000)throw Error('גיבוי גדול מדי');
 const text=await file.text(),plan=preparePersonalRestore(section,before,text);
 const validate=()=>{if(getMember()!==member)throw Error('החשבון השתנה בזמן קריאת הגיבוי. בחר את הקובץ מחדש.');return completePersonalRestore(plan,section,read(section),text)};
 validate();
 if(!confirm())return null;
 return validate();
}
