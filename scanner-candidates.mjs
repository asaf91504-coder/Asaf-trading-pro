// Consume server-derived opportunities only. A rank is an ordering aid, never
// a probability, trade instruction, or a way to promote a rejected full match.
export function rankedScannerCandidates(records,{side='any',limit=8}={}){
 const candidates=[];
 for(const record of records){
  if(record?.presentation!=='derived-only')continue;
  const choices=(record.opportunities||[]).filter(o=>o.eligible===true&&['long','short'].includes(o.side)&&(side==='any'||o.side===side)&&Number.isFinite(o.rank));
  const best=choices.sort((a,b)=>b.rank-a.rank)[0];
  if(best)candidates.push({record,opportunity:best});
 }
 candidates.sort((a,b)=>b.opportunity.rank-a.opportunity.rank||a.record.symbol.localeCompare(b.record.symbol));
 const unique=[];for(const candidate of candidates)if(!unique.some(c=>c.record.symbol===candidate.record.symbol))unique.push(candidate);
 return unique.slice(0,Math.max(0,Math.min(50,limit)));
}
