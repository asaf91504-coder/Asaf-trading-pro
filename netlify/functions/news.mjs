import {command,storeConfigured,storageKey} from '../../server/storage.mjs';
import {newsConfigured,snapshotState} from '../../server/news-core.mjs';
const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async function handler(request){
 if(request.method!=='GET')return respond({error:'GET only'},405);
 if(!newsConfigured()||!storeConfigured())return respond({enabled:false,articles:[],updatedAt:null,stale:true,message:'חדשות אוטומטיות ממתינות לרישיון, אישור הפעלה והגדרת ספק. לא מתבצעת פנייה לספק.'});
 try{const symbol=new URL(request.url).searchParams.get('symbol');if(symbol&&!/^[A-Z0-9:._-]{1,30}$/.test(symbol))return respond({error:'סימול לא תקין'},400);const raw=await command(['GET',storageKey('news:snapshot')]),snapshot=snapshotState(raw?JSON.parse(raw):null);if(symbol)snapshot.articles=snapshot.articles.filter(a=>a.symbols.includes(symbol.split(':').at(-1)));return respond({enabled:true,...snapshot})}
 catch{return respond({error:'פיד החדשות אינו זמין כרגע; לא מוצגים עדכונים מומצאים.'},503)}
}
