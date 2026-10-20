export const normalizeSymbol=value=>String(value||'').trim().toUpperCase().replace(/[^A-Z0-9:._-]/g,'').slice(0,30);
export function watchRecords(input){
 if(!Array.isArray(input))throw Error('רשימת המעקב חייבת להיות מערך');const seen=new Set();
 return input.slice(0,100).flatMap(item=>{
  const symbol=normalizeSymbol(typeof item==='string'?item:item?.symbol);if(!symbol||seen.has(symbol))return [];seen.add(symbol);
  return [{symbol,note:typeof item?.note==='string'?item.note.slice(0,1000):'',level:typeof item?.level==='number'&&Number.isFinite(item.level)&&item.level>0?item.level:null}];
 });
}
export function parseWorkspaceBackup(text){
 if(typeof text!=='string'||text.length>500000)throw Error('גיבוי גדול מדי');const data=JSON.parse(text);
 if(data?.version!==1||data?.kind!=='asaf-workspace'||!Array.isArray(data.watch))throw Error('זה אינו גיבוי סביבת ASAF תקין');
 return watchRecords(data.watch);
}
export function crossing(previous,current,level){
 if(![previous,current,level].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0))return null;
 return previous<level&&current>=level?'up':previous>level&&current<=level?'down':null;
}
