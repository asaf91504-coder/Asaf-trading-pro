import {publicNewsEnabled} from '../../server/public-news.mjs';
import {refreshPublicNews,readPublicNews} from '../../server/public-news-service.mjs';
import {command,storeConfigured,storageKey} from '../../server/storage.mjs';
import {newsConfigured,snapshotState} from '../../server/news-core.mjs';
const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async function handler(request){
 if(request.method!=='GET')return respond({error:'GET only'},405);
 if(!newsConfigured()&&publicNewsEnabled()&&storeConfigured()){try{const symbol=new URL(request.url).searchParams.get('symbol');if(symbol&&!/^[A-Z0-9:._-]{1,30}$/.test(symbol))return respond({error:'סימול לא תקין'},400);const initial=await readPublicNews();if(!initial.updatedAt||Date.now()-Date.parse(initial.updatedAt)>=900000)await refreshPublicNews();const snapshot=await readPublicNews();if(symbol)snapshot.articles=snapshot.articles.filter(a=>a.symbols.includes(symbol.split(':').at(-1)));return respond({enabled:true,mode:'public-rss',...snapshot,message:'כותרות וקישורים מ־RSS ציבורי; רענון מתוזמן כל 15 דקות. X: רק קישורים ציבוריים שאונדקסו, ללא פיד מלא וללא אימות התוכן. שיוך למניות לפי שמות בכותרת בלבד.'})}catch{return respond({error:'החדשות הציבוריות אינן זמינות כרגע'},503)}}
 if(!newsConfigured()||!storeConfigured())return respond({enabled:false,articles:[],updatedAt:null,stale:true,message:'חדשות אוטומטיות ממתינות לרישיון, אישור הפעלה והגדרת ספק. לא מתבצעת פנייה לספק.'});
 try{const symbol=new URL(request.url).searchParams.get('symbol');if(symbol&&!/^[A-Z0-9:._-]{1,30}$/.test(symbol))return respond({error:'סימול לא תקין'},400);const raw=await command(['GET',storageKey('news:snapshot')]),snapshot=snapshotState(raw?JSON.parse(raw):null);if(symbol)snapshot.articles=snapshot.articles.filter(a=>a.symbols.includes(symbol.split(':').at(-1)));return respond({enabled:true,...snapshot})}
 catch{return respond({error:'פיד החדשות אינו זמין כרגע; לא מוצגים עדכונים מומצאים.'},503)}
}
