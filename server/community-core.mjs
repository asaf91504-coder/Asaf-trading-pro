import {setupInterval,setupHoldingPeriod} from '../community-setup.mjs';
export function setupInput(body){
 const text=(key,min,max)=>{const s=typeof body?.[key]==='string'?body[key].trim():'';if(s.length<min||s.length>max)throw Error('יש למלא '+key+' באורך תקין');return s};
 const symbol=text('symbol',1,30).toUpperCase();if(!/^[A-Z0-9][A-Z0-9:._-]*$/.test(symbol))throw Error('סימול לא תקין');
 const side=body.side;if(!['long','short','watch'].includes(side))throw Error('בחר כיוון');
 const interval=setupInterval(body.interval);if(!interval)throw Error('בחר טווח נרות');
 const holdingPeriod=setupHoldingPeriod(body.holdingPeriod);if(!holdingPeriod)throw Error('בחר טווח החזקה');
 const result={symbol,side,interval,holdingPeriod,title:text('title',4,100),thesis:text('thesis',10,2000)};
 for(const key of ['entry','stop','target']){const v=body[key];if(v===''||v===null||v===undefined)result[key]=null;else{const n=Number(v);if(!Number.isFinite(n)||n<=0||n>1e12)throw Error('רמת מחיר לא תקינה');result[key]=n}}
 const {entry,stop,target}=result;
 if(side!=='watch'&&[entry,stop,target].some(x=>x===null))throw Error('בסטאפ לונג או שורט יש למלא כניסה, סטופ ויעד');
 if(side==='long'&&!(stop<entry&&entry<target)||side==='short'&&!(target<entry&&entry<stop))throw Error('סדר רמות המחיר אינו מתאים לכיוון');
 return result;
}
export function publicSetup(post,author,admin){const {authorId,reports,...safe}=post;return {...safe,interval:setupInterval(post.interval)||post.interval,holdingPeriod:setupHoldingPeriod(post.holdingPeriod)||'unspecified',author:'חבר '+authorId.slice(0,6),mine:authorId===author,canDelete:authorId===author||admin,reported:!!reports?.[author],...(admin?{reportCount:Object.keys(reports||{}).length}:{})}}
