// Evidence stays in server metadata. Customer replies contain the answer only.
// Also clean old persisted replies when they are reopened, without rewriting history.
export function chatAnswerText(value){
 let text=String(value??'');
 const heading=/^\s*(?:#{1,4}\s*)?(?:\*\*)?(?:מקורות(?: מהחיפוש באינטרנט| שנמצאו בחיפוש)?|sources(?: from (?:the )?(?:web )?search)?|fuentes|sources de recherche|quellen|fontes|источники|المصادر|来源|情報源)(?:\*\*)?\s*:?\s*$/imu;
 const match=heading.exec(text);
 if(match)text=text.slice(0,match.index);
 return text.replace(/\s*[\[［]\d{1,2}(?:\s*[,،–-]\s*\d{1,2})*[\]］]/gu,'')
  .replace(/cite[^]*/gu,'')
  .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
