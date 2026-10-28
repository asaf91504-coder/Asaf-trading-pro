/* Offline fallback only. Account, API, market, chat and application resources
   always use the network; no user content or authenticated response is cached. */
const OFFLINE_CACHE='asaf-offline-v1';
const OFFLINE_PATH='/offline.html';
const PUBLIC_PAGES=new Set(['/','/index.html','/journal','/journal.html','/data-privacy','/data-privacy.html']);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(OFFLINE_CACHE).then(cache=>cache.add(OFFLINE_PATH)));
 // Do not activate over an in-progress chat or sign-in flow.
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('asaf-offline-')&&name!==OFFLINE_CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!PUBLIC_PAGES.has(url.pathname))return;
 // Callback and unknown query parameters must never receive an offline page.
 // Only the app's public shareable chart/tab location is eligible.
 if([...url.searchParams.keys()].some(name=>!['tab','symbol'].includes(name)))return;
 event.respondWith((async()=>{
  try{return await fetch(request)}
  catch{
   const offline=await (await caches.open(OFFLINE_CACHE)).match(OFFLINE_PATH);
   return offline||new Response('ASAF Trading Pro: אין חיבור לרשת. התחברות, צ׳אט ונתוני שוק דורשים אינטרנט.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
 })());
});
