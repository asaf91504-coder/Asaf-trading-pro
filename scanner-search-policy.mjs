export const SCANNER_SEARCH_POOL_LIMIT=10000;
export const SCANNER_MATCH_LIMIT=50;
// A stock counts once, regardless of how many long/short patterns it has.
// Watch candidates, missing data and raw provider responses do not count.
export function collectScannerResults(records,rows){
 let matches=[...records.values()].filter(r=>r.screen?.matches===true).length;
 for(const row of rows||[]){
  if(row?.presentation!=='derived-only'||typeof row.symbol!=='string')continue;
  const symbol=row.symbol.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(symbol))continue;
  const previous=records.get(symbol),wasMatch=previous?.screen?.matches===true,isMatch=row.screen?.matches===true;
  if(isMatch&&!wasMatch&&matches>=SCANNER_MATCH_LIMIT)continue;
  records.set(symbol,{...row,symbol});matches+=Number(isMatch)-Number(wasMatch);
 }
 return matches;
}
