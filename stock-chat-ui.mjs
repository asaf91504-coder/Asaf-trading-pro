import {chartAttachment} from './chart-attachment.mjs';
import {mountConversationArchive} from './conversation-archive-ui.mjs';
import {prepareChartData,recentAIBars,CHART_HISTORY_LIMIT} from "./chart-data.mjs";
import {authState,refreshAuth} from "./auth-ui.mjs";
import {parseCSV,stockContext,answerStockQuestion} from "./market-chat.mjs";
import {initLocalChart} from "./local-chart.mjs";

const $=id=>document.getElementById(id);
const log=$("chatLog"),file=$("chatCsv"),message=$("chatInput"),badge=$("chatDataStatus");
const status=$("chatStatus"),form=$("chatForm"),chartSymbol=$("symbol");
const key="asaf_market_candles_v1";
const privateAccessKey="asaf_market_access_v1";
const marketStatus=$("marketFetchStatus");
const marketButton=$("marketFetch");
const localChart=initLocalChart();
let loaded=null,lastVisibleChart=null;
const normSymbol=()=>String(chartSymbol.value||"").trim().toUpperCase().replace(/[^A-Z0-9:._-]/g,"").slice(0,30);
function say(role,content){
 const item=document.createElement("div");
 item.className="bubble "+role;
 item.setAttribute('role','group');
 item.setAttribute('aria-label',role==='user'?'אתה':'ASAF AI');
 item.textContent=content;
 log.append(item);
 log.scrollTop=log.scrollHeight;
 return item;
}
function currentContext(){
 if(!loaded) return null;
 const now=normSymbol();
 if(now!==loaded.symbol) {
   badge.textContent="⚠️ קובץ "+loaded.symbol+" אינו תואם לגרף "+now+". חזור לסימול הנכון או טען CSV חדש.";
   return null;
 }
 return loaded.context;
}
function renderStatus(){
 const attribution=$("marketAttribution");
 if($('marketCoverage'))$('marketCoverage').textContent=['1day','1week'].includes(loaded?.interval)?'נתוני יום/EOD מאוחדים לפי הספק':'פיד תוך־יומי מזירות נבחרות, כ־5% ממחזור ארה״ב לפי הספק; המחזורים אינם מחזור כלל השוק';
 if(attribution)attribution.hidden=!(loaded&&loaded.source==="Twelve Data"&&normSymbol()===loaded.symbol);
 if(!loaded){badge.textContent="אין נתוני גרף מחוברים. כשהפיד יחובר, הנרות יוצגו בגרף וישמשו לניתוח אוטומטי בעת שליחת שאלה.";return;}
 const now=normSymbol();
 badge.textContent=now===loaded.symbol?
 "✓ "+(loaded.source==="Twelve Data"?"ספק Twelve Data (ייתכן עיכוב)":"CSV מקומי")+" | "+loaded.symbol+" | "+loaded.interval+" | נר אחרון: "+loaded.context.date+" | "+loaded.context.bars+" נרות":
 "⚠️ הקובץ שייך לסימול "+loaded.symbol+" שהוזן, אבל הגרף הנבחר הוא "+now+". הנתונים לא ישמשו לניתוח הסימול האחר.";
}
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||"null");
  if(saved&&Array.isArray(saved.bars)&&typeof saved.symbol==="string"&&/^[A-Z0-9:._-]{1,30}$/.test(saved.symbol)){
    saved.bars=saved.bars.slice(-CHART_HISTORY_LIMIT);if(!new URLSearchParams(location.search).has("symbol"))chartSymbol.value=saved.symbol;
    loaded={symbol:saved.symbol,bars:saved.bars,source:saved.source||"CSV",interval:saved.interval||"1day",receivedAt:saved.receivedAt||null,context:stockContext(saved.symbol,saved.bars,{source:saved.source,interval:saved.interval,receivedAt:saved.receivedAt,exchangeTimezone:saved.exchangeTimezone})};
    if(normSymbol()===saved.symbol)localChart.setData(saved.symbol,saved.bars);
  }
 }catch{}
 renderStatus();
}
// The free AI endpoint is a real LLM. The old keyword-based responder is now
// available only after an explicit click on "local mathematical analysis".
const freeAiAccessKey="asaf_free_ai_code_v1";
const aiStatus=$("freeAiStatus"),imageInput=$("chatImageUpload"),imageStatus=$("chatImageStatus");
let pendingImage=null,chatBusy=false,requestController=null,conversationEpoch=0;
let conversation=[];
mountConversationArchive({readCurrent:()=>({symbol:normSymbol(),messages:conversation}),isBusy:()=>chatBusy});
function rememberSymbol(){const symbol=normSymbol();if(symbol){const url=new URL(location.href);url.searchParams.set("symbol",symbol);history.replaceState(null,"",url)}}
function datasetReady(){rememberSymbol();if(loaded)window.dispatchEvent(new CustomEvent('asaf:dataset-ready',{detail:{symbol:loaded.symbol,bars:loaded.bars,source:loaded.source,interval:loaded.interval,receivedAt:loaded.receivedAt}}))}
function resetRequest(){lastVisibleChart=null;conversationEpoch++;requestController?.abort();requestController=null;chatBusy=false;conversation=[];pendingImage=null;form.querySelector('button').disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(imageInput)imageInput.value='';if($('chatRequestState'))$('chatRequestState').textContent='';if($('chartCapturePanel'))$('chartCapturePanel').hidden=true}
$('cancelChat')?.addEventListener('click',()=>requestController?.abort());
window.addEventListener('asaf:logout',()=>{resetRequest();log.replaceChildren();sessionStorage.removeItem(freeAiAccessKey);});
function setAiStatus(text){if(aiStatus)aiStatus.textContent=text}
async function shrinkImage(source){
 const isFile=typeof File!=="undefined"&&source instanceof File;
 if(isFile&&source.size>4500000)throw Error("תמונה גדולה מדי (מקסימום 4.5MB)");
 const url=isFile?URL.createObjectURL(source):source;
 try{
  const img=await new Promise((resolve,reject)=>{
   const element=new Image();
   element.onload=()=>resolve(element);
   element.onerror=()=>reject(Error("לא הצלחתי לפתוח את התמונה"));
   element.src=url;
  });
  const scale=Math.min(1,1050/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext("2d");ctx.fillStyle="white";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let data=canvas.toDataURL("image/jpeg",0.72);
  if(data.length>205000)data=canvas.toDataURL("image/jpeg",0.48);
  if(data.length>205000)throw Error("התמונה גדולה מדי לעיבוד. נסה לחתוך את הגרף.");
  return data;
 }finally{if(isFile)URL.revokeObjectURL(url)}
}
async function ask(q,extra={}){
 if(chatBusy)return;
 const question=String(q||"").trim();
 if(!question)return;
 chatBusy=true;
 const epoch=conversationEpoch;
 const submitButton=form.querySelector('button');
 submitButton.disabled=true;if($("cancelChat"))$("cancelChat").disabled=false;
 const requestState=$('chatRequestState');
 if(requestState)requestState.textContent='ממתין למודל החינמי…';
 const activeController=new AbortController();requestController=activeController;
 let preparedPayload=extra.retryPayload||null;
 let timedOut=false;
 const requestTimeout=setTimeout(()=>{timedOut=true;activeController.abort()},26000);
 say("user",question);
 const waiting=say("bot","כותב תשובה…");
 try{
  await refreshAuth();
  if(epoch!==conversationEpoch)return;
  if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(authState.checkAvailable===false)throw Error("לא ניתן לבדוק את החיבור לחשבון כרגע. השאלה נשמרה; נסה שוב כשהחיבור חוזר.");
  if(authState.enabled&&!authState.authenticated)throw Error("יש להיכנס לחשבון באזור הכניסה מעל הצ׳אט.");
  let code=authState.enabled?"":sessionStorage.getItem(freeAiAccessKey)||"";
  if(!authState.enabled&&!code){
   code=prompt("הכנס קוד גישה פרטי ל-AI החינמי (לא API key):")||"";
   if(!code)throw Error("כדי לקבל תשובות AI אמיתיות, יש להפעיל חיבור OpenRouter החינמי ב-Netlify ולהכניס קוד גישה.");
  }
  if(!authState.enabled&&code.length<24)throw Error("קוד הגישה הפרטי ל-AI חייב לכלול לפחות 24 תווים");
  const context=currentContext();
  const activeData=context&&loaded?.symbol===normSymbol()?loaded:null;
  let image=null;
  const candidate=chartAttachment({manual:extra.image||pendingImage,auto:$('chatAutoChart')?.checked===true,hasMatchingData:!!activeData,snapshot:()=>{if($('localChartCanvas').getBoundingClientRect().width<1)return lastVisibleChart?.symbol===activeData.symbol&&lastVisibleChart?.bars===activeData.bars?lastVisibleChart.image:null;return localChart.snapshot()}});
  if(candidate)image=await shrinkImage(candidate);
  if(epoch!==conversationEpoch)return;
  if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
  preparedPayload=preparedPayload||{
    message:question,
    symbol:activeData?.symbol||normSymbol(),
    source:activeData?.source||"none",
    interval:activeData?.interval||"1day",
    receivedAt:activeData?.receivedAt||null,
    useServerMarket:activeData?.source==="Twelve Data",
    includeNews:extra.newsArticleId?true:$("chatIncludeNews")?.checked===true,
    newsArticleId:extra.newsArticleId||null,
    bars:recentAIBars(activeData?.bars),
    chartSettings:activeData?localChart.settings():null,
    image,
    history:conversation.slice(-8)
  };
  const response=await fetch("/.netlify/functions/free-chat",{method:"POST",signal:activeController.signal,headers:{"Content-Type":"application/json",...(!authState.enabled?{"x-asaf-free-ai-code":code}:{})},body:JSON.stringify(preparedPayload)});
  let data;try{data=await response.json()}catch{throw Error("פונקציית AI לא נפרסה ל-Netlify. צריך לחבר את GitHub ולפרוס את האתר.")}
  if(!response.ok){
   if(response.status===401)sessionStorage.removeItem(freeAiAccessKey);
   throw Error(data.error||"חיבור ה-AI נכשל (HTTP "+response.status+")");
  }
  if(epoch!==conversationEpoch)return;
  if(!data.answer)throw Error("לא התקבלה תשובה מהמודל");
  if(!authState.enabled)sessionStorage.setItem(freeAiAccessKey,code);
  waiting.textContent=data.answer;
  if(data.newsArticle){const article=data.newsArticle;try{const url=new URL(article.url);if(url.protocol==='https:'&&!url.username&&!url.password){const card=document.createElement('p'),link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(article.title||'כותרת המקור');card.append(link);const meta=document.createElement('small');meta.textContent=' · '+String(article.source||'')+' · '+String(article.publishedAt||'');card.append(meta);waiting.append(card)}}catch{}}

  conversation.push({role:"user",content:question},{role:"assistant",content:data.answer});
  conversation=conversation.slice(-8);
  pendingImage=null;
  if(imageInput)imageInput.value="";
  if(imageStatus)imageStatus.textContent=image?"התמונה נשלחה עם ההודעה. התמיכה החזותית תלויה במודל שנבחר.":"נתוני הגרף הפתוח מצורפים אוטומטית כשיש נתונים תואמים.";
  setAiStatus("✓ AI שיחתי מחובר · openrouter/free · ללא חיוב טוקנים · נתוני שוק לפי מקור/תאריך");
 }catch(e){
  if(epoch!==conversationEpoch)return;
  waiting.textContent="⚠️ "+(e.name==="AbortError"?(timedOut?"הזמן להמתנה לתשובה הסתיים.":"הבקשה בוטלה."):e.message);
  // Recover text locally, without making another request or spending quota.
  // The next send is an explicit new request using the then-visible context.
  if(!message.value.trim()){message.value=question;message.dispatchEvent(new Event('input'))}
  const recovery=document.createElement('p');
  recovery.textContent=(extra.newsArticleId?'כדי לנסות שוב עם אותה כותרת, פתח אותה מחדש בלשונית החדשות. ':'')+'השאלה נשמרה כאן. לפני שליחה מחדש, בדוק את המניה, הגרף והקבצים המצורפים; ההודעה הבאה תשתמש בבחירה הנוכחית.';
  waiting.append(recovery);
  const edit=document.createElement('button');edit.type='button';edit.textContent='העתק את השאלה לעריכה';
  edit.addEventListener('click',()=>{if(message.value.trim()&&message.value.trim()!==question){if(!window.confirm('להחליף את הטיוטה הנוכחית בשאלה הזו?'))return}message.value=question;message.dispatchEvent(new Event('input'));message.focus()});
  waiting.append(edit);
  if(preparedPayload){const retry=document.createElement('button');retry.type='button';retry.textContent='נסה שוב עם אותם נתונים';retry.addEventListener('click',()=>{if(chatBusy)return;ask(question,{...extra,retryPayload:preparedPayload})});waiting.append(retry)}
  setAiStatus("החיבור ל-AI אינו פעיל או נחסם — התשובה לא הוחלפה בטקסט מוכן.");
 }finally{
  clearTimeout(requestTimeout);
  if(epoch===conversationEpoch){chatBusy=false;requestController=null;submitButton.disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(requestState)requestState.textContent='';}
 }
}
$('clearConversation')?.addEventListener('click',()=>{
 conversationEpoch++;requestController?.abort();requestController=null;chatBusy=false;conversation=[];pendingImage=null;log.replaceChildren();form.querySelector('button').disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(imageInput)imageInput.value='';if(imageStatus)imageStatus.textContent='אפשר לצרף צילום גרף חדש.';if($('chatRequestState'))$('chatRequestState').textContent='';say('bot','שיחה חדשה. נתוני הגרף שנבחרו נשארו זמינים.');
});
$('exportConversation')?.addEventListener('click',()=>{
 const text=[...log.querySelectorAll('.bubble')].map(el=>(el.classList.contains('user')?'אתה: ':'ASAF AI: ')+el.textContent).join('\n\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='asaf-conversation.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('asaf:load-dataset',event=>{
 const data=event.detail;if(!data||!Array.isArray(data.bars))return;
 const symbol=String(data.symbol||'').toUpperCase().replace(/[^A-Z0-9:._-]/g,'').slice(0,30);
 try{const bars=data.bars.slice(-CHART_HISTORY_LIMIT),interval=['intraday','1min','5min','15min','30min','1h','1day','1week','1month'].includes(data.interval)?data.interval:'1day',source=data.source==='Twelve Data'?'Twelve Data':'CSV',receivedAt=data.receivedAt||null,context=stockContext(symbol,bars,{source,interval,receivedAt});
 resetRequest();chartSymbol.value=symbol;$("chart").replaceChildren();loaded={symbol,bars,context,source,interval,receivedAt};localChart.setData(symbol,bars);try{sessionStorage.setItem(key,JSON.stringify({symbol,bars,source,interval,receivedAt}))}catch{}
 renderStatus();datasetReady();status.textContent='נתוני '+symbol+' נטענו לגרף ולצ׳אט.';
 }catch(e){status.textContent=e.message}
});
$("forgetFreeAiCode")?.addEventListener("click",()=>{
 sessionStorage.removeItem(freeAiAccessKey);
 resetRequest();
 setAiStatus("קוד הגישה הפרטי נשכח; יידרש בכניסה הבאה.");
});
$("offlineAnalysis")?.addEventListener("click",()=>{
 const context=currentContext();
 say("bot","🧮 ניתוח מתמטי מקומי (ללא AI):\\n"+answerStockQuestion("תנתח את הגרף ואת המגמה",context));
});
imageInput?.addEventListener("change",()=>{
 const candidate=imageInput.files?.[0];
 if(!candidate){pendingImage=null;return}
 if(!["image/png","image/jpeg","image/webp"].includes(candidate.type)||candidate.size>4500000){
  pendingImage=null;imageInput.value="";
  imageStatus.textContent="נא לבחור צילום מסך PNG, JPEG או WEBP עד 4.5MB.";
  return;
 }
 pendingImage=candidate;
 imageStatus.textContent="📎 "+candidate.name+" צורף. לחץ נתח כדי לשלוח אותו ל-AI החינמי.";
});
async function loadCsv(uploaded){
 if(!uploaded)return;
 const chartFileStatus=$("chartCsvStatus");
 const report=(text)=>{status.textContent=text;if(chartFileStatus)chartFileStatus.textContent=text};
 report("מחשב נתונים מקומית...");
 try{
   if(uploaded.size>2000000)throw Error("קובץ CSV גדול מ-2MB");
   const {symbol,bars,interval,context}=prepareChartData(await uploaded.text(),normSymbol());
   resetRequest();loaded={symbol,bars,source:"CSV",interval,receivedAt:null,context};
   localChart.setData(symbol,bars);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars:bars.slice(-CHART_HISTORY_LIMIT),source:"CSV",interval}))}catch{report("חושב, אך אין מספיק מקום לשמירה זמנית.")}
   renderStatus();datasetReady();
   report("✓ "+bars.length+" נרות חושבו במכשיר בלבד עבור "+symbol+". מקור CSV. ודא שהנתונים שייכים לסימול שבחרת.");
   say("bot","קיבלתי "+context.bars+" נרות עבור הסימול "+symbol+" שבחרת, עד "+context.date+". אפשר לשאול אותי: 'תנתח את הגרף', 'מה התמיכות?', 'האם יש פריצה?', 'איך המחזורים?'");
 }catch(err){report("לא ניתן לנתח את הקובץ: "+err.message)}
}
file.addEventListener("change",async()=>{await loadCsv(file.files?.[0]);file.value=""});
const chartCsv=$("chartCsv");
chartCsv?.addEventListener("change",async()=>{await loadCsv(chartCsv.files?.[0]);chartCsv.value=""});

const lastFetchBySymbol=new Map();
const publicFeed=fetch('/.netlify/functions/public-market',{cache:'no-store'}).then(async r=>r.ok?await r.json():{enabled:false}).catch(()=>({enabled:false}));
publicFeed.then(c=>{const option=$('marketAutoRefresh');if(option)option.disabled=!c.enabled;if(authState.enabled)$('marketForgetCode').hidden=true});
marketButton.addEventListener("click",async()=>{
 const symbol=normSymbol();
 if(!symbol){marketStatus.textContent="נא להזין סימול מניה תחילה.";return;}
 const interval=$("marketInterval").value;
 const fetchKey=symbol+"|"+interval;
 const memberMode=authState.enabled,feed=await publicFeed;
 if(memberMode&&!feed.enabled){marketStatus.textContent='נתוני השוק למשתמשים טרם חוברו. ממתינים לספק ולאישור רישוי.';return;}
 if(memberMode&&!authState.authenticated){marketStatus.textContent='יש להיכנס לחשבון באזור ASAF AI לפני טעינת נתונים.';return;}
 if(Date.now()-(lastFetchBySymbol.get(fetchKey)||0)<(memberMode?60000:300000)){
   marketStatus.textContent="הרענון עדיין בהמתנה למכסה. בחיבור חשבון אפשר לרענן פעם בדקה; בחיבור פרטי פעם ב־5 דקות.";
   return;
 }
 let passcode=memberMode?"":sessionStorage.getItem(privateAccessKey);
 if(!memberMode&&!passcode){
   passcode=window.prompt("קוד הגישה הפרטי לנתוני השוק (לא מפתח API):")||"";
   if(!passcode)return;
 }
 if(!memberMode&&passcode.length<20){marketStatus.textContent="קוד הגישה חייב להכיל לפחות 20 תווים.";return;}
 marketButton.disabled=true;
 marketStatus.textContent="מתחבר לספק הנתונים (לחיצה ידנית בלבד)...";
 try{
   const response=await fetch(memberMode?"/.netlify/functions/public-market":"/.netlify/functions/market",{
     method:"POST",
     credentials:"same-origin",
     headers:{"Content-Type":"application/json",...(!memberMode?{"x-asaf-market-access":passcode}:{})},
     body:JSON.stringify({symbol,interval})
   });
   let result;try{result=await response.json()}catch{throw Error("פונקציית Netlify לא נפרסה או החזירה תשובה לא תקינה (ייתכן 404)")};
   if(!response.ok){
     if(response.status===401)sessionStorage.removeItem(privateAccessKey);
     throw Error(result.error||"קריאת נתונים נכשלה");
   }
   if(!Array.isArray(result.bars)||result.bars.length<21)throw Error("התקבלו פחות מ-21 נרות");
   if(normSymbol()!==symbol||$("marketInterval").value!==interval)throw Error("הסימול בגרף השתנה בזמן הטעינה, נסה שוב");
   if(result.symbol!==symbol.split(":").at(-1))throw Error("הספק החזיר סימול שונה מהנבחר");
   const bars=result.bars.slice(-200);
   const meta={source:"Twelve Data",interval,receivedAt:result.receivedAt,exchangeTimezone:result.exchangeTimezone};
   const context=stockContext(symbol,bars,meta);
   resetRequest();loaded={symbol,bars,context,source:"Twelve Data",interval,receivedAt:result.receivedAt};
   localChart.setData(symbol,bars);
   if(!memberMode)sessionStorage.setItem(privateAccessKey,passcode);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars,...meta}))}catch{}
   lastFetchBySymbol.set(fetchKey,Date.now());
   renderStatus();datasetReady();
   marketStatus.textContent="✓ נר אחרון: "+result.latestBarTime+" | "+(result.exchange||"בורסה לא ידועה")+" | אזור זמן: "+(result.exchangeTimezone||"לא ידוע")+" | מקור Twelve Data"+(result.cached?" (מטמון)":"")+' | '+(result.coverage||'כיסוי לא הוצהר')+(Number.isFinite(result.delayMinutes)?" | עיכוב מוצהר: "+result.delayMinutes+" דקות":"; נתונים עשויים להיות מעוכבים.");
   status.textContent="הגרף המקורי והצ'אט מציגים כעת את אותם "+bars.length+" נרות. אפשר לצלם ולבקש ניתוח.";
   say("bot","📡 קיבלתי "+bars.length+" נרות מאושרים של "+symbol+" בטווח "+interval+". נר אחרון: "+result.latestBarTime+". כל התשובות מכאן מבוססות על נתוני הספק שנקלטו, לא על צילום חלון TradingView.");
   document.querySelector('[data-tab="charts"]').click();
 }catch(error){
   marketStatus.textContent="לא התחבר: "+error.message+". לא הופעלו שירותי OpenAI.";
 }finally{
   marketButton.disabled=false;
 }
});
setInterval(()=>{if($('marketAutoRefresh')?.checked&&!document.hidden&&authState.authenticated&&!marketButton.disabled)marketButton.click()},61000);
window.addEventListener('asaf:logout',()=>{if($('marketAutoRefresh'))$('marketAutoRefresh').checked=false});
$("marketForgetCode").addEventListener("click",()=>{
 sessionStorage.removeItem(privateAccessKey);
 marketStatus.textContent="קוד הגישה הזמני נשכח מהמכשיר.";
});
const captureButton=$("captureChart"),preview=$("chartCapturePreview"),capturePanel=$("chartCapturePanel");
captureButton.addEventListener("click",()=>{
 try{
   const context=currentContext();
   if(!context)throw Error("צריך לטעון נתוני CSV או ספק שמתאימים לסימול הנוכחי");
   const image=localChart.snapshot();
   preview.src=image;
   capturePanel.hidden=false;
   document.querySelector('[data-tab="chat"]').click();
   ask("תנתח את התמונה ואת נתוני הגרף. זיהוי תבניות, פריצות, מחזורים, תמיכות וסיכונים — עם חוסר הוודאות והרמות המחושבות.",{image});
 }catch(error){marketStatus.textContent="אי אפשר לצלם ולנתח: "+error.message}
});
$("downloadChart").addEventListener("click",()=>{
 try{
   if(!currentContext())throw Error("אין נתוני גרף לסימול הנוכחי");
   const dataUrl=localChart.snapshot();
   const link=document.createElement("a");
   link.href=dataUrl;link.download="asaf-chart-"+normSymbol().replace(/[^A-Z0-9_-]/g,"_")+".png";
   link.click();
 }catch(error){marketStatus.textContent="הצילום נכשל: "+error.message}
});

form.addEventListener("submit",event=>{
 event.preventDefault();
 const q=message.value.trim();
 if(!q||chatBusy)return;
 message.value="";
 ask(q);
});
$("chatClearData").addEventListener("click",()=>{
 resetRequest();loaded=null;window.dispatchEvent(new Event("asaf:dataset-cleared"));
 localChart.clear();
 try{sessionStorage.removeItem(key)}catch{}
 renderStatus();
 status.textContent="נתוני הגרף הזמניים נמחקו מהמכשיר.";
});
document.querySelectorAll("[data-market-question]").forEach(button=>{
 button.addEventListener("click",()=>ask(button.getAttribute("data-market-question")));
});
const shortcut=$("chartChat");
if(shortcut)shortcut.addEventListener("click",()=>{
 document.querySelector('[data-tab="chat"]').click();
 ask("תנתח את הגרף הנוכחי");
});
chartSymbol.addEventListener("input",()=>{rememberSymbol();$("chart").replaceChildren();resetRequest();renderStatus();window.dispatchEvent(new Event("asaf:dataset-cleared"));if(loaded&&normSymbol()===loaded.symbol){localChart.setData(loaded.symbol,loaded.bars);datasetReady()}else localChart.clear()});
document.querySelector('[data-tab="charts"]').addEventListener("click",()=>requestAnimationFrame(()=>localChart.redraw()));
window.addEventListener('asaf:layout',()=>requestAnimationFrame(()=>localChart.redraw()));
restore();
say("bot","אני ASAF AI. שאל אותי על המניה והגרף הפתוחים — מגמה, מחזורים, רמות מחיר וסיכונים. כשיש נתונים תואמים הם יצורפו אוטומטית לשאלה, ללא העלאת צילום ידנית. עדכניות הניתוח תלויה במקור ובזמן הנתונים שמוצגים לצד הגרף.");
if(loaded&&normSymbol()===loaded.symbol)say("bot","נתוני "+loaded.symbol+" נטענו מחדש מהלשונית הנוכחית, עד "+loaded.context.date+".");
window.addEventListener('asaf:request-dataset',datasetReady);
queueMicrotask(datasetReady);
if(new URLSearchParams(location.search).get("tab")==="chat"){
 document.querySelector('[data-tab="chat"]').click();
}


message.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(message.value.trim()&&!chatBusy)form.requestSubmit()}});
message.addEventListener('input',()=>{message.style.height='auto';message.style.height=Math.min(180,message.scrollHeight)+'px'});

// Preserve only the chart the user actually saw before opening full-page chat.
document.querySelector('[data-tab="chat"]').addEventListener('click',()=>{if(!loaded||loaded.symbol!==normSymbol()||!$('chatAutoChart').checked||$('localChartCanvas').getBoundingClientRect().width<1)return;try{lastVisibleChart={symbol:loaded.symbol,bars:loaded.bars,image:localChart.snapshot()}}catch{lastVisibleChart=null}},{capture:true});

window.addEventListener('asaf:ask-news',event=>{const id=event.detail?.id;if(typeof id!=='string'||id.length>1000)return;if(chatBusy){status.textContent='עצור או המתן לתשובה הקיימת לפני פתיחת שאלה על כותרת.';return}document.querySelector('[data-tab="chat"]').click();ask('הסבר בעברית את משמעות הכותרת המצורפת, מה עשוי להיות רלוונטי למשקיע ומה עדיין צריך לאמת. אל תטען שקראת את הכתבה המלאה.',{newsArticleId:id})});
