// Evidence stays in server metadata. Customer replies contain the answer only.
// Also clean old persisted replies when they are reopened, without rewriting history.
export function chatAnswerText(value){
 let text=String(value??'');
 const heading=/^\s*(?:#{1,4}\s*)?(?:\*\*)?(?:מקורות(?: מהחיפוש באינטרנט| שנמצאו בחיפוש)?|sources(?: from (?:the )?(?:web )?search)?|fuentes|sources de recherche|quellen|fontes|источники|المصادر|来源|情報源)(?:\*\*)?\s*:?\s*$/imu;
 const match=heading.exec(text);
 if(match)text=text.slice(0,match.index);
 return readableChatTables(text).replace(/\s*[\[［]\d{1,2}(?:\s*[,،–-]\s*\d{1,2})*[\]］]/gu,'')
  .replace(/cite[^]*/gu,'')
  .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

// Compact financial tables become labeled rows that wrap on a phone. Keep the
// transformation plain text, and leave code examples or malformed rows intact.
export function readableChatTables(value){
 const text=String(value??''),lines=text.split(/\r?\n/u),output=[];let changed=false,fence=null;
 const cells=line=>{
  let row=line.trim();if(row.startsWith('|'))row=row.slice(1);if(row.endsWith('|')&&!row.endsWith('\\|'))row=row.slice(0,-1);
  return row.split(/(?<!\\)\|/u).map(cell=>cell.trim().replace(/\\\|/gu,'|'));
 };
 const divider=line=>cells(line).every(cell=>/^:?-{3,}:?$/u.test(cell));
 for(let i=0;i<lines.length;i++){
  const marker=lines[i].match(/^\s*(`{3,}|~{3,})/u);
  if(marker){if(!fence)fence={char:marker[1][0],size:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.size)fence=null;output.push(lines[i]);continue;}
  if(fence||i+1>=lines.length||!/(?<!\\)\|/u.test(lines[i])||!divider(lines[i+1])){output.push(lines[i]);continue;}
  const headers=cells(lines[i]),separators=cells(lines[i+1]);
  if(headers.length<2||headers.length!==separators.length){output.push(lines[i]);continue;}
  const rows=[];let end=i+2,valid=true;
  for(;end<lines.length&&/(?<!\\)\|/u.test(lines[end])&&lines[end].trim();end++){
   const row=cells(lines[end]);if(row.length!==headers.length){valid=false;break;}rows.push(row);
  }
  if(!valid||!rows.length){output.push(lines[i]);continue;}
  for(const row of rows)output.push('- '+headers.map((header,j)=>header?header+': '+row[j]:row[j]).join(' · '));
  i=end-1;changed=true;
 }
 return changed?output.join('\n'):text;
}
