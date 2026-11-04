// Navigation catalogue only: prices and availability always come from the server.
export const assets=[
 ['NASDAQ:AAPL','Apple אפל','stock'],['NASDAQ:NVDA','NVIDIA אנבידיה','stock'],['NASDAQ:TSLA','Tesla טסלה','stock'],['NASDAQ:MSFT','Microsoft מיקרוסופט','stock'],['NASDAQ:AMZN','Amazon אמזון','stock'],['NASDAQ:GOOGL','Alphabet Google גוגל','stock'],['NASDAQ:META','Meta מטא','stock'],['NASDAQ:AMD','AMD','stock'],['NYSE:PLTR','Palantir פלנטיר','stock'],['NASDAQ:MSTR','Strategy MicroStrategy','stock'],['NASDAQ:COIN','Coinbase','stock'],['NASDAQ:IREN','IREN','stock'],['NYSE:SPY','S&P 500 ETF','stock'],['NASDAQ:QQQ','Nasdaq 100 ETF','stock'],['BTCUSD','Bitcoin ביטקוין','crypto'],['ETHUSD','Ethereum את׳ריום אתריום','crypto'],['SOLUSD','Solana סולאנה','crypto'],['XRPUSD','XRP ריפל','crypto'],['DOGEUSD','Dogecoin דוג׳קוין','crypto']
].map(([symbol,name,type])=>({symbol,name,type}));
export function searchAssets(query,type='all'){
 const q=String(query||'').trim().toLowerCase();
 return assets.filter(a=>(type==='all'||a.type===type)&&(!q||(a.symbol+' '+a.name).toLowerCase().includes(q))).slice(0,12);
}
export function manualSymbol(query){const q=String(query||'').trim().toUpperCase();return /^[A-Z0-9][A-Z0-9:._-]{0,29}$/.test(q)?q:null}
