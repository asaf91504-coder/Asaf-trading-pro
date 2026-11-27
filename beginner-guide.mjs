const main=document.getElementById('mainContent');
if(main){
 const guide=document.createElement('details');guide.className='panel beginner-guide';guide.id='beginnerGuide';
 const summary=document.createElement('summary');summary.textContent='חדש כאן? התחלה בשתי דקות';
 const intro=document.createElement('p');intro.textContent='ASAF Pro עוזר לחקור מניות וקריפטו. מתחילים בחיפוש חברה או בסורק, בודקים את הנתונים ורק אז בוחנים תרחיש.';
 const steps=document.createElement('ol');
 for(const text of ['חפש שם חברה, למשל אפל, ופתח את הגרף. בדוק את תאריך הנתונים.','בסורק, ״עומדת במסננים״ מתאר את הבדיקה. ״ממתין לחצייה״ אומר שתנאי הכניסה עדיין לא התקיים.','תרגל במחשבון הסיכון עם הדוגמה המוכנה, לפני הזנת מספרים משלך.']){const item=document.createElement('li');item.textContent=text;steps.append(item);}
 const glossary=document.createElement('details'),glossaryTitle=document.createElement('summary'),list=document.createElement('dl');glossaryTitle.textContent='מושגים בקצרה';
 for(const [term,explanation] of [
  ['Long / Short','לונג הוא תרחיש של עלייה במחיר; שורט הוא תרחיש של ירידה.'],
  ['MA20 / MA150','ממוצע של המחיר לאורך 20 או 150 נרות; הוא עוזר להבין את כיוון המגמה.'],
  ['ATR','מדד לטווח התנועה הממוצע במחיר; הוא עוזר להעריך תנודתיות.'],
  ['RSI / ADX','RSI מתאר עוצמת תנועה יחסית; ADX מתאר את חוזק המגמה, בלי לקבוע את כיוונה.'],
  ['EOD','נתוני סוף יום מסחר שהסתיים, ולא מחיר חי.'],
  ['Stop','מחיר מתוכנן ליציאה אם התרחיש נכשל. המחיר שבו העסקה תבוצע בפועל עלול להיות שונה.']
 ]){const key=document.createElement('dt'),value=document.createElement('dd');key.textContent=term;key.translate=false;value.textContent=explanation;list.append(key,value);}
 glossary.append(glossaryTitle,list);const practice=document.createElement('a');practice.href='/?tab=risk';practice.textContent='פתח דוגמה במחשבון הסיכון';
 guide.append(summary,intro,steps,glossary,practice);main.prepend(guide);
 const stopHelp=document.getElementById('stopHelp'),stopInput=document.getElementById('stop');
 if(stopHelp&&stopInput){const definition=document.createElement('small');definition.id='stopDefinition';definition.textContent='מחיר מתוכנן ליציאה אם התרחיש נכשל. המחיר שבו העסקה תבוצע בפועל עלול להיות שונה.';stopHelp.after(definition);stopInput.setAttribute('aria-describedby',[(stopInput.getAttribute('aria-describedby')||''),'stopDefinition'].filter(Boolean).join(' '));}
}
