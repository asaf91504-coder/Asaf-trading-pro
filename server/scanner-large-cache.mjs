import {randomUUID} from 'node:crypto';
import {scanBars} from '../scanner-core.mjs';
import {MarketError} from './market-feed.mjs';

const parse=raw=>{try{return JSON.parse(raw)}catch{return null}};
const FORMAT='scanner-symbol-manifest-v1';
export const isScannerManifest=snapshot=>snapshot?.format===FORMAT&&Array.isArray(snapshot.rows);

// Read small groups of server-only rows; 1,000 OHLCV series must never become
// one oversized Redis value or one large HTTP response from the data store.
export async function readScannerManifest(snapshot,{symbols,run,env,now}){
 const selected=new Set(symbols),rows=snapshot.rows.filter(r=>selected.has(r.symbol)),records=[],errors=[];
 for(let offset=0;offset<rows.length;offset+=25){
  const batch=rows.slice(offset,offset+25),values=await run(['MGET',...batch.map(r=>r.key)],{env});
  for(let i=0;i<batch.length;i++){
   const record=parse(values?.[i]),age=now-Date.parse(record?.receivedAt);
   if(record?.symbol===batch[i].symbol&&Number.isFinite(age)&&age>=0&&age<86400000)records.push(record);
   else errors.push({symbol:batch[i].symbol,error:'נתוני המניה ממתינים לעדכון.'});
  }
 }
 return {records,errors};
}

export async function refreshLargeScanner({env,run,fetcher,now,key,symbols,plan,memberId,readBars,readFundamentals,fundamentals,commitScript,periodMs}){
 const token=randomUUID(),lock=key+':lock';
 if(await run(['SET',lock,token,'NX','EX','55'],{env})!=='OK')return {status:'busy'};
 try{
  let state=parse(await run(['GET',key+':large-state'],{env}));
  if(state?.done&&now<state.nextUpdateAt)return {status:'current'};
  if(await run(['SET',key+':tick:'+Math.floor(now/60000),'1','NX','EX','120'],{env})!=='OK')return {status:'busy'};
  let manifest=parse(await run(['GET',key+':snapshot'],{env}));
  if(!isScannerManifest(manifest))manifest={format:FORMAT,rows:[],errors:[],records:[],completedAt:null};
  // An unfinished cycle survives period boundaries and daily quota pauses.
  if(!state||state.done){
   state={cursor:0,done:false,startedAt:new Date(now).toISOString()};
   manifest={...manifest,errors:[],startedAt:state.startedAt};
  }
  const batch=symbols.slice(state.cursor,state.cursor+plan.maxSymbols);
  const maxAgeMs=Math.max(3600000,86400000-(Math.ceil(symbols.length/plan.maxSymbols)*60000+periodMs));
  const results=await Promise.all(batch.map(async symbol=>{
   try{
    const [snapshot,company]=await Promise.all([
     readBars({selected:symbol,interval:'1day',memberId,env,run,fetcher,now}),
     fundamentals?readFundamentals({selected:symbol,memberId,env,run,fetcher,now,maxAgeMs}).catch(e=>{
      if(e?.status===429)throw e;
      return {status:'unavailable',reason:'שווי שוק לא אומת בסריקה זו.'};
     }):Promise.resolve({status:'unavailable',reason:'נתוני שווי שוק אינם מופעלים.'})
    ]);
    const record={...scanBars(symbol,snapshot.bars,snapshot),source:snapshot.source,interval:snapshot.interval,receivedAt:snapshot.receivedAt,coverage:snapshot.coverage,exchangeTimezone:snapshot.exchangeTimezone,barPolicy:snapshot.barPolicy,volumeBasis:snapshot.volumeBasis,volumeConflictDates:snapshot.volumeConflictDates,latestBarMayBePartial:snapshot.latestBarMayBePartial,fundamentals:company};
    // Immutable batch keys: an expired worker cannot replace a published row.
    const rowKey=key+':row:'+symbol+':'+token;
    await run(['SET',rowKey,JSON.stringify(record),'EX','90000'],{env});
    return {symbol,row:{symbol,key:rowKey}};
   }catch(e){return {symbol,...(e instanceof MarketError&&e.status===429?{retry:true}:{error:'נתוני המניה לא היו זמינים בעדכון האחרון.'})};}
  }));
  const rows=new Map(manifest.rows.map(r=>[r.symbol,r])),errors=new Map(manifest.errors.map(e=>[e.symbol,e]));
  const superseded=results.filter(r=>r.row&&rows.has(r.symbol)).map(r=>rows.get(r.symbol).key);
  for(const result of results){if(result.row){rows.set(result.symbol,result.row);errors.delete(result.symbol);}else if(result.error){errors.set(result.symbol,{symbol:result.symbol,error:result.error});}}
  const paused=results.findIndex(r=>r.retry);
  state.cursor+=paused<0?batch.length:paused;state.done=state.cursor>=symbols.length;
  state.nextUpdateAt=state.done?(Math.floor(now/periodMs)+1)*periodMs:now+60000;
  manifest={...manifest,rows:[...rows.values()],errors:[...errors.values()],updatedAt:new Date(now).toISOString(),completedAt:state.done?new Date(now).toISOString():manifest.completedAt,nextUpdateAt:state.nextUpdateAt,partial:!state.done||errors.size>0,total:symbols.length,progress:{processed:state.cursor,total:symbols.length,complete:state.done}};
  const committed=await run(['EVAL',commitScript,'3',lock,key+':large-state',key+':snapshot',token,JSON.stringify(state),JSON.stringify(manifest)],{env});
  // Keep old manifest readers working briefly, without retaining every full
  // 1,000-stock generation for a day. Only a successfully published worker
  // may shorten the life of its superseded rows.
  if(committed===1&&superseded.length)try{await run(['EVAL',"-- scanner-expire-superseded\nfor i=1,#KEYS do redis.call('EXPIRE',KEYS[i],300) end return 1",String(superseded.length),...superseded],{env})}catch{}
  return {status:committed!==1?'superseded':paused>=0?'quota-paused':state.done?'updated':'progress',processed:state.cursor,total:symbols.length};
 }finally{try{await run(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token],{env})}catch{}}
}
