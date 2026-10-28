export function isAppleMobile(nav={}){
 return /iPhone|iPad|iPod/i.test(nav.userAgent||'')||(/Mac/i.test(nav.platform||'')&&Number(nav.maxTouchPoints)>1);
}
export function appDisplayMode(win={},nav={}){
 return nav.standalone===true||win.matchMedia?.('(display-mode: standalone)').matches===true;
}

// Installation is an explicit browser action. No credentials or account state
// are read here; AI, authentication, news and market data stay network-only.
export function mountAppInstall({window:win=globalThis.window,document:doc=globalThis.document,navigator:nav=globalThis.navigator}={}){
 if(!win||!doc||!nav||doc.getElementById('appInstallButton'))return;
 const element=(tag,text,className)=>{const node=doc.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node};
 const button=element('button','התקן אפליקציה','app-install-button');button.id='appInstallButton';button.type='button';button.setAttribute('aria-haspopup','dialog');
 const dialog=element('dialog',null,'app-install-dialog');dialog.id='appInstallDialog';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','appInstallTitle');dialog.setAttribute('aria-describedby','appInstallDescription');
 const title=element('h2','ASAF Trading Pro');title.id='appInstallTitle';
 const description=element('p','פתח את ASAF AI והגרפים ממסך הבית, בחלון עצמאי. הצ׳אט, ההתחברות, החדשות ונתוני השוק דורשים חיבור לאינטרנט.');description.id='appInstallDescription';
 const instructions=element('p',null,'app-install-instructions');
 const promptButton=element('button','התקן כעת','primary');promptButton.type='button';promptButton.hidden=true;
 const status=element('p',null,'app-install-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const chat=element('a','פתח את ASAF AI');chat.href='/?tab=chat';
 const close=element('button','סגור');close.type='button';
 const actions=element('div',null,'app-install-actions');actions.append(promptButton,chat,close);dialog.append(title,description,instructions,status,actions);
 const offline=element('p','אין כרגע חיבור לאינטרנט. הצ׳אט, הכניסה לחשבון, החדשות ונתוני השוק יפעלו כשהחיבור יחזור.','app-offline-banner');offline.id='appOfflineStatus';offline.setAttribute('role','status');offline.setAttribute('aria-live','polite');
 (doc.querySelector('header')||doc.body).append(button);doc.body.append(dialog,offline);
 let deferred=null,busy=false,installed=false,workerStatus='';
 const display=win.matchMedia?.('(display-mode: standalone)');
 const refresh=()=>{
  button.hidden=installed||appDisplayMode(win,nav);
  promptButton.hidden=!deferred||button.hidden;
  promptButton.disabled=busy;
  instructions.textContent=isAppleMobile(nav)?'באייפון או באייפד: פתח ב־Safari, לחץ על שיתוף, בחר ״הוסף למסך הבית״ ואז ״הוסף״. אין צורך להוריד מחנות אפליקציות.':deferred?'לחץ על ״התקן כעת״ ואשר את בקשת ההתקנה של הדפדפן.':'פתח את תפריט הדפדפן וחפש ״התקנת אפליקציה״ או ״הוסף למסך הבית״. אם האפשרות אינה זמינה, אפשר להמשיך להשתמש באתר כרגיל.';
  offline.hidden=nav.onLine!==false;
 };
 const dismiss=()=>{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');if(!button.hidden)button.focus()};
 button.addEventListener('click',()=>{refresh();status.textContent=workerStatus;if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true')}close.focus()});
 close.addEventListener('click',dismiss);
 dialog.addEventListener('close',()=>{if(!button.hidden)button.focus()});
 // Native dialog supplies focus trapping. The fallback retains Escape and Tab
 // behavior for browsers without showModal rather than exposing a dead panel.
 dialog.addEventListener('keydown',event=>{
  if(typeof dialog.showModal==='function')return;
  if(event.key==='Escape'){event.preventDefault();dismiss()}
  if(event.key==='Tab'){
   const controls=[...dialog.querySelectorAll('button,a[href]')].filter(node=>!node.hidden&&!node.disabled),first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus()}
  }
 });
 win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;refresh()});
 win.addEventListener('appinstalled',()=>{installed=true;deferred=null;refresh();dismiss()});
 display?.addEventListener?.('change',refresh);
 win.addEventListener('online',refresh);win.addEventListener('offline',refresh);
 promptButton.addEventListener('click',async()=>{
  if(!deferred||busy)return;
  const request=deferred;deferred=null;busy=true;promptButton.disabled=true;
  try{
   await request.prompt();
   const choice=await request.userChoice;
   if(choice?.outcome==='accepted'){installed=true;status.textContent='בקשת ההתקנה אושרה. פתח את ASAF Trading Pro ממסך הבית או מרשימת האפליקציות.'}
   else status.textContent='בקשת ההתקנה נסגרה. אפשר להמשיך באתר ולהתקין בהמשך דרך תפריט הדפדפן.';
  }catch{status.textContent='הדפדפן לא השלים את בקשת ההתקנה. אפשר להוסיף את האתר דרך תפריט הדפדפן.'}
  finally{busy=false;refresh()}
 });
 async function register(){
  if(!nav.serviceWorker||win.isSecureContext===false)return;
  try{await nav.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});workerStatus='פתיחה ללא רשת תציג מסך חיבור מחדש. שירותי החשבון והנתונים נשארים מקוונים בלבד.'}
  catch{workerStatus='מסך החיבור מחדש אינו זמין כרגע. אפשר להמשיך להשתמש באתר ולהתקין דרך הדפדפן.'}
  if(dialog.hasAttribute('open'))status.textContent=workerStatus;
 }
 if(doc.readyState==='complete')void register();else win.addEventListener('load',register,{once:true});
 refresh();return {button,dialog,promptButton,status,offline};
}

if(typeof window!=='undefined'&&typeof document!=='undefined')mountAppInstall();
