import {indexStocks} from './index-stock-catalogue.mjs';
// Navigation catalogue only: prices and availability always come from the server.
const shortcuts=[
 ['NASDAQ:CRWV','CoreWeave קורוויב','stock'],
 ['NASDAQ:AAPL','Apple אפל','stock'],['NASDAQ:NVDA','NVIDIA אנבידיה','stock'],['NASDAQ:TSLA','Tesla טסלה','stock'],['NASDAQ:MSFT','Microsoft מיקרוסופט','stock'],['NASDAQ:AMZN','Amazon אמזון','stock'],['NASDAQ:GOOGL','Alphabet Google גוגל','stock'],['NASDAQ:META','Meta מטא','stock'],['NASDAQ:AMD','AMD','stock'],['PLTR','Palantir פלנטיר','stock'],['NASDAQ:MSTR','Strategy MicroStrategy','stock'],['NASDAQ:COIN','Coinbase','stock'],['NASDAQ:IREN','IREN','stock'],['SPY','S&P 500 ETF','stock'],['NASDAQ:QQQ','Nasdaq 100 ETF','stock'],['BTCUSD','Bitcoin ביטקוין','crypto'],['ETHUSD','Ethereum את׳ריום אתריום','crypto'],['SOLUSD','Solana סולאנה','crypto'],['XRPUSD','XRP ריפל','crypto'],['DOGEUSD','Dogecoin דוג׳קוין','crypto']
].map(([symbol,name,type])=>({symbol,name,type}));
const byTicker=new Map(indexStocks.map(a=>[a.symbol,a]));
for(const a of shortcuts){const ticker=a.symbol.split(':').at(-1);byTicker.set(ticker,{...byTicker.get(ticker),...a})}
export const assets=[...byTicker.values()];
// The bilingual shortcut labels contain explicit company aliases. Prefer these
// exact names over incidental substrings (Apple must precede Pineapple).
const aliasesBySymbol=new Map(shortcuts.map(a=>[a.symbol,new Set(a.name.toLowerCase().split(/\s+/))]));
export function searchAssets(query,type='all',availableSymbols=null,{group='all',offset=0,limit=12}={}){
 const q=String(query||'').trim().toLowerCase();
 const available=Array.isArray(availableSymbols)?new Set(availableSymbols):null;
 const catalog=available?[...assets.filter(a=>a.type==='crypto'||available.has(a.symbol.split(':').at(-1))),...[...available].filter(s=>!byTicker.has(s)).map(symbol=>({symbol,name:symbol,type:'stock'}))]:assets;
 const matches=catalog.filter(a=>(type==='all'||a.type===type)&&(group==='all'||a.groups?.includes(group))&&(!q||(a.symbol+' '+a.name).toLowerCase().includes(q)));
 const score=a=>{
  if(!q)return 0;
  const symbol=a.symbol.toLowerCase(),ticker=symbol.split(':').at(-1),name=a.name.toLowerCase();
  if(symbol===q||ticker===q)return 0;
  if(name===q||aliasesBySymbol.get(a.symbol)?.has(q))return 1;
  if(ticker.startsWith(q))return 2;
  // Match the start of a company name or a name token, not the middle of a word.
  if(name.startsWith(q)||name.split(/[^\p{L}\p{N}]+/u).some(word=>word.startsWith(q)))return 3;
  return 4;
 };
 matches.sort((a,b)=>score(a)-score(b)||a.symbol.localeCompare(b.symbol));
 return matches.slice(offset,offset+limit);
}
export function manualSymbol(query){const q=String(query||'').trim().toUpperCase();return /^[A-Z0-9][A-Z0-9:._-]{0,29}$/.test(q)?q:null}
export function resolveAssetQuery(query,type='all'){
 const q=String(query||'').trim().toUpperCase();if(!q)return null;
 const exact=assets.find(a=>a.symbol===q||a.symbol.split(':').at(-1)===q);
 if(exact)return type==='all'||exact.type===type?exact.symbol:null;
 const named=assets.filter(a=>a.name.toUpperCase()===q);
 const alias=named.length===1?named[0]:shortcuts.find(a=>a.name.toUpperCase().split(' ').includes(q));
 if(alias)return type==='all'||alias.type===type?alias.symbol:null;
 const matches=searchAssets(q,type);
 if(matches.length===1)return matches[0].symbol;
 if(matches.length>1||searchAssets(q).length)return null;
 return manualSymbol(q);
}
