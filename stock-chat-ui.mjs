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
let loaded=null;
const normSymbol=()=>String(chartSymbol.value||"").trim().toUpperCase().replace(/[^A-Z0-9:._-]/g,"").slice(0,30);
function say(role,content){
 const item=document.createElement("div");
 item.className="bubble "+role;
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
 if(attribution)attribution.hidden=!(loaded&&loaded.source==="Twelve Data"&&normSymbol()===loaded.symbol);
 if(!loaded){badge.textContent="לא נטען עדיין קובץ נתוני גרף. ניתן לשוחח על מושגים ולצרף צילום. רמות מחיר עדכניות דורשות נתונים מתאימים.";return;}
 const now=normSymbol();
 badge.textContent=now===loaded.symbol?
 "✓ "+(loaded.source==="Twelve Data"?"ספק Twelve Data (ייתכן עיכוב)":"CSV מקומי")+" | "+loaded.symbol+" | "+loaded.interval+" | נר אחרון: "+loaded.context.date+" | "+loaded.context.bars+" נרות":
 "⚠️ הקובץ שייך לסימול "+loaded.symbol+" שהוזן, אבל הגרף הנבחר הוא "+now+". הנתונים לא ישמשו לניתוח הסימול האחר.";
}
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||"null");
  if(saved&&Array.isArray(saved.bars)&&typeof saved.symbol==="string"){
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
function datasetReady(){if(loaded)window.dispatchEvent(new CustomEvent('asaf:dataset-ready',{detail:{symbol:loaded.symbol,bars:loaded.bars}}))}
function resetRequest(){conversationEpoch++;requestController?.abort();requestController=null;chatBusy=false;conversation=[];pendingImage=null;form.querySelector('button').disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(imageInput)imageInput.value='';if($('chatRequestState'))$('chatRequestState').textContent='';if($('chartCapturePanel'))$('chartCapturePanel').hidden=true}
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
 const requestTimeout=setTimeout(()=>activeController.abort(),26000);
 say("user",(normSymbol()?"["+normSymbol()+"] ":"")+question);
 const waiting=say("bot","מנתח עם AI...");
 try{
  await refreshAuth();
  if(epoch!==conversationEpoch||activeController.signal.aborted)return;
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
  const candidate=extra.image||pendingImage;
  if(candidate)image=await shrinkImage(candidate);
  if(epoch!==conversationEpoch||activeController.signal.aborted)return;
  const response=await fetch("/.netlify/functions/free-chat",{
   method:"POST",signal:activeController.signal,
   headers:{"Content-Type":"application/json",...(!authState.enabled?{"x-asaf-free-ai-code":code}:{})},
   body:JSON.stringify({
    message:question,
    symbol:activeData?.symbol||normSymbol(),
    source:activeData?.source||"none",
    interval:activeData?.interval||"1day",
    receivedAt:activeData?.receivedAt||null,
    bars:activeData?.bars||null,
    image,
    history:conversation.slice(-8)
   })
  });
  let data;try{data=await response.json()}catch{throw Error("פונקציית AI לא נפרסה ל-Netlify. צריך לחבר את GitHub ולפרוס את האתר.")}
  if(!response.ok){
   if(response.status===401)sessionStorage.removeItem(freeAiAccessKey);
   throw Error(data.error||"חיבור ה-AI נכשל (HTTP "+response.status+")");
  }
  if(epoch!==conversationEpoch)return;
  if(!data.answer)throw Error("לא התקבלה תשובה מהמודל");
  if(!authState.enabled)sessionStorage.setItem(freeAiAccessKey,code);
  waiting.textContent=data.answer;
  conversation.push({role:"user",content:question},{role:"assistant",content:data.answer});
  conversation=conversation.slice(-8);
  pendingImage=null;
  if(imageInput)imageInput.value="";
  if(imageStatus)imageStatus.textContent=image?"התמונה נשלחה עם ההודעה. התמיכה החזותית תלויה במודל שנבחר.":"אפשר לצרף צילום גרף להודעה הבאה.";
  setAiStatus("✓ AI שיחתי מחובר · openrouter/free · ללא חיוב טוקנים · נתוני שוק לפי מקור/תאריך");
 }catch(e){
  if(epoch!==conversationEpoch)return;
  waiting.textContent="⚠️ "+(e.name==="AbortError"?"הבקשה ארכה יותר מדי או בוטלה. אפשר לנסות שוב.":e.message);
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
 try{const bars=data.bars.slice(-200),interval=data.interval==='intraday'?'intraday':'1day',context=stockContext(symbol,bars,{source:'CSV',interval});
 resetRequest();chartSymbol.value=symbol;loaded={symbol,bars,context,source:'CSV',interval,receivedAt:null};localChart.setData(symbol,bars);try{sessionStorage.setItem(key,JSON.stringify({symbol,bars,source:'CSV',interval}))}catch{}
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
   const data=await uploaded.text(),bars=parseCSV(data).slice(-200);
   const symbol=normSymbol();
   if(!symbol)throw Error("יש לבחור סימול מניה בשדה הגרף קודם");
   const symbols=[...new Set(bars.map(b=>b.ticker).filter(Boolean))];
   if(symbols.length>1)throw Error("בקובץ מופיעות כמה מניות; יש לבחור קובץ של מניה אחת");
   if(symbols.length===1&&symbols[0].split(":").at(-1)!==symbol.split(":").at(-1))throw Error("הסימול בקובץ ("+symbols[0]+") שונה מהגרף ("+symbol+")");
   const interval=bars.some(b=>b.date.includes(" "))?"intraday":"1day";
   const context=stockContext(symbol,bars,{source:"CSV",interval});
   resetRequest();loaded={symbol,bars,source:"CSV",interval,receivedAt:null,context};
   localChart.setData(symbol,bars);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars:bars.slice(-200),source:"CSV",interval}))}catch{report("חושב, אך אין מספיק מקום לשמירה זמנית.")}
   renderStatus();datasetReady();
   report("✓ "+bars.length+" נרות חושבו במכשיר בלבד עבור "+symbol+". מקור CSV. ודא שהנתונים שייכים לסימול שבחרת.");
   say("bot","קיבלתי "+context.bars+" נרות עבור הסימול "+symbol+" שבחרת, עד "+context.date+". אפשר לשאול אותי: 'תנתח את הגרף', 'מה התמיכות?', 'האם יש פריצה?', 'איך המחזורים?'");
 }catch(err){report("לא ניתן לנתח את הקובץ: "+err.message)}
}
file.addEventListener("change",async()=>{await loadCsv(file.files?.[0]);file.value=""});
const chartCsv=$("chartCsv");
chartCsv?.addEventListener("change",async()=>{await loadCsv(chartCsv.files?.[0]);chartCsv.value=""});

const lastFetchBySymbol=new Map();
marketButton.addEventListener("click",async()=>{
 const symbol=normSymbol();
 if(!symbol){marketStatus.textContent="נא להזין סימול מניה תחילה.";return;}
 const interval=$("marketInterval").value;
 const fetchKey=symbol+"|"+interval;
 if(Date.now()-(lastFetchBySymbol.get(fetchKey)||0)<300000){
   marketStatus.textContent="כדי לחסוך במכסת החינם, אפשר לרענן את אותו סימול רק אחרי 5 דקות.";
   return;
 }
 let passcode=sessionStorage.getItem(privateAccessKey);
 if(!passcode){
   passcode=window.prompt("קוד הגישה הפרטי לנתוני השוק (לא מפתח API):")||"";
   if(!passcode)return;
 }
 if(passcode.length<20){marketStatus.textContent="קוד הגישה חייב להכיל לפחות 20 תווים.";return;}
 marketButton.disabled=true;
 marketStatus.textContent="מתחבר לספק הנתונים (לחיצה ידנית בלבד)...";
 try{
   const response=await fetch("/.netlify/functions/market",{
     method:"POST",
     credentials:"same-origin",
     headers:{"Content-Type":"application/json","x-asaf-market-access":passcode},
     body:JSON.stringify({symbol,interval})
   });
   let result;try{result=await response.json()}catch{throw Error("פונקציית Netlify לא נפרסה או החזירה תשובה לא תקינה (ייתכן 404)")};
   if(!response.ok){
     if(response.status===401)sessionStorage.removeItem(privateAccessKey);
     throw Error(result.error||"קריאת נתונים נכשלה");
   }
   if(!Array.isArray(result.bars)||result.bars.length<21)throw Error("התקבלו פחות מ-21 נרות");
   if(normSymbol()!==symbol)throw Error("הסימול בגרף השתנה בזמן הטעינה, נסה שוב");
   if(result.symbol!==symbol.split(":").at(-1))throw Error("הספק החזיר סימול שונה מהנבחר");
   const bars=result.bars.slice(-200);
   const meta={source:"Twelve Data",interval,receivedAt:result.receivedAt,exchangeTimezone:result.exchangeTimezone};
   const context=stockContext(symbol,bars,meta);
   resetRequest();loaded={symbol,bars,context,source:"Twelve Data",interval,receivedAt:result.receivedAt};
   localChart.setData(symbol,bars);
   sessionStorage.setItem(privateAccessKey,passcode);
   try{sessionStorage.setItem(key,JSON.stringify({symbol,bars,...meta}))}catch{}
   lastFetchBySymbol.set(fetchKey,Date.now());
   renderStatus();datasetReady();
   marketStatus.textContent="✓ נר אחרון: "+result.latestBarTime+" | "+(result.exchange||"בורסה לא ידועה")+" | אזור זמן: "+(result.exchangeTimezone||"לא ידוע")+" | מקור Twelve Data"+(result.cached?" (מטמון)":"")+"; נתונים עשויים להיות מעוכבים.";
   status.textContent="הגרף המקורי והצ'אט מציגים כעת את אותם "+bars.length+" נרות. אפשר לצלם ולבקש ניתוח.";
   say("bot","📡 קיבלתי "+bars.length+" נרות מאושרים של "+symbol+" בטווח "+interval+". נר אחרון: "+result.latestBarTime+". כל התשובות מכאן מבוססות על נתוני הספק שנקלטו, לא על צילום חלון TradingView.");
   document.querySelector('[data-tab="charts"]').click();
 }catch(error){
   marketStatus.textContent="לא התחבר: "+error.message+". לא הופעלו שירותי OpenAI.";
 }finally{
   marketButton.disabled=false;
 }
});
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
 if(!q)return;
 message.value="";
 ask(q);
});
$("chatClearData").addEventListener("click",()=>{
 resetRequest();loaded=null;
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
chartSymbol.addEventListener("input",()=>{resetRequest();renderStatus();if(loaded&&normSymbol()===loaded.symbol){localChart.setData(loaded.symbol,loaded.bars);datasetReady()}else localChart.clear()});
document.querySelector('[data-tab="charts"]').addEventListener("click",()=>requestAnimationFrame(()=>localChart.redraw()));
restore();
say("bot","שלום! אני ASAF MARKET AI. אם חיברת את מסלול ה-AI החינמי, אפשר לדבר איתי בחופשיות על כל מה שקשור לשוק ההון, כולל תמונת גרף. בחר מניה, צרף צילום או טען נרות, ושאל כל שאלה. בלי חיבור פעיל אציג שגיאת הגדרה, לא תשובה מוכנה.");
if(loaded&&normSymbol()===loaded.symbol)say("bot","נתוני "+loaded.symbol+" נטענו מחדש מהלשונית הנוכחית, עד "+loaded.context.date+".");
queueMicrotask(datasetReady);
if(new URLSearchParams(location.search).get("tab")==="chat"){
 document.querySelector('[data-tab="chat"]').click();
}

