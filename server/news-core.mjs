export function newsConfigured(env=process.env){return env.ASAF_NEWS_ENABLED==='true'&&env.ASAF_NEWS_LICENSE_CONFIRMED==='true'&&env.ASAF_EXTERNAL_SERVICES_APPROVED==='true'&&!!env.MARKETAUX_API_TOKEN}
export function normalizeNews(payload){
 if(!Array.isArray(payload?.data))throw Error('Invalid news response');
 const seen=new Set(),articles=[];
 for(const a of payload.data.slice(0,100)){
  try{const url=new URL(a.url);if(url.protocol!=='https:'||url.username||url.password||!a.title||!a.published_at||!Number.isFinite(Date.parse(a.published_at)))continue;
   url.hash='';if(seen.has(url.href))continue;seen.add(url.href);
   articles.push({id:String(a.uuid||url.href).slice(0,500),title:String(a.title).slice(0,240),url:url.href,source:String(a.source||url.hostname).slice(0,120),publishedAt:new Date(a.published_at).toISOString(),symbols:[...new Set((Array.isArray(a.entities)?a.entities:[]).map(x=>String(x.symbol||'').toUpperCase()).filter(x=>/^[A-Z0-9:._-]{1,30}$/.test(x)))].slice(0,20)});
  }catch{}
 }
 return articles.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,50);
}
export function snapshotState(snapshot,now=Date.now()){
 const time=Date.parse(snapshot?.updatedAt);if(!Number.isFinite(time)||!Array.isArray(snapshot.articles))return {articles:[],updatedAt:null,stale:true};
 // Re-validate cached records before serving. No full article text is stored or displayed.
 const articles=normalizeNews({data:snapshot.articles.map(a=>({uuid:a.id,title:a.title,url:a.url,source:a.source,published_at:a.publishedAt,entities:(a.symbols||[]).map(symbol=>({symbol}))}))});
 return {articles,updatedAt:new Date(time).toISOString(),stale:now-time>30*60000||time>now+60000};
}
