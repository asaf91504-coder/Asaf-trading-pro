import {marketSnapshotMetadata} from './market-quality.mjs';
import {dataFreshness,quoteSummary} from './data-freshness.mjs';
import {analysisReceipt} from './chart-analysis-context.mjs';
import {shouldSendOnEnter,isChatNearBottom} from './chat-interaction.mjs';
import {chartAttachment} from './chart-attachment.mjs';
import {mountConversationArchive} from './conversation-archive-ui.mjs';
import {recentAIBars,CHART_HISTORY_LIMIT} from "./chart-data.mjs";
import {authState,refreshAuth} from "./auth-ui.mjs";
import {stockContext,answerStockQuestion} from "./market-chat.mjs";
import {initLocalChart} from "./local-chart.mjs";
import {parseChartCommand,requestsChartControl} from './chat-chart-actions.mjs';
import {executeChartActions} from './chart-command-controller.mjs';
import {requestsChartAnalysis,hasAnalysisCandles} from './chart-analysis-request.mjs';

const $=id=>document.getElementById(id);
const log=$("chatLog"),message=$("chatInput"),badge=$("chatDataStatus");
const status=$("chatStatus"),form=$("chatForm"),chartSymbol=$("symbol");
const key="asaf_market_candles_v1";
const privateAccessKey="asaf_market_access_v1";
const marketStatus=$("marketFetchStatus");
const marketButton=$("marketFetch");
const localChart=initLocalChart();
let loaded=null,lastVisibleChart=null,chartRevision=0;
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
const cryptoIntervals=new Set(['1day']);
function cryptoResearchSymbol(value){
 const symbol=String(value||'').toUpperCase();
 if(symbol.startsWith('COINLORE:'))return symbol;
 if(/^(?:BTC|ETH)-?USD$/.test(symbol))return 'COINLORE:'+symbol.replace('-','');
 return null;
}
function datasetContext(symbol,bars,meta){
 return {...stockContext(symbol,bars,meta),...marketSnapshotMetadata(meta),source:meta.source,...(meta.source==='CoinLore'?{internalResearchOnly:true,coverage:meta.coverage||'CoinLore aggregated crypto data',quote:meta.quote,latestBarMayBePartial:meta.latestBarMayBePartial===true}:{} )};
}
function currentContext(){
 if(!loaded) return null;
 const now=normSymbol();
 if(now!==loaded.symbol) {
   badge.textContent="⚠️ נתוני "+loaded.symbol+" אינם תואמים לגרף "+now+". בקש בצ׳אט לפתוח את המניה הרצויה.";
   return null;
 }
 return loaded.context;
}
function renderStatus(){
 const attribution=$("marketAttribution");
 if($('marketCoverage'))$('marketCoverage').textContent=loaded?.source==='CoinLore'?'CoinLore בלבד · קריפטו · ניסוי מחקר פנימי · רענון REST ידני, לא זרם עסקאות':loaded?.coverage||'כיסוי הנתונים לא אומת; יש לרענן את הגרף';
 if(attribution)attribution.hidden=!(loaded&&loaded.source==="Twelve Data"&&normSymbol()===loaded.symbol);
 if(!loaded){badge.textContent="אין נתוני גרף מחוברים. כשהפיד יחובר, הנרות יוצגו בגרף וישמשו לניתוח אוטומטי בעת שליחת שאלה.";return;}
 const now=normSymbol();
 badge.textContent=now===loaded.symbol?
 "✓ "+(loaded.source==="CoinLore"?"CoinLore בלבד · ניסוי מחקר פנימי · רענון REST לכל היותר פעם בדקה, לא פיד עסקאות":loaded.source==="Twelve Data"?"ספק Twelve Data (ייתכן עיכוב)":loaded.source==="Intrinio"?"Intrinio · נרות יומיים · ניסיון פנימי":"מקור לא מאומת")+" | "+loaded.symbol+" | "+loaded.interval+" | נר אחרון: "+loaded.context.date+" | "+loaded.context.bars+" נרות"+(loaded.source==="CoinLore"?" | סגירת הנר: $"+loaded.context.close+" | "+quoteSummary(loaded)+" | "+dataFreshness(loaded)+" | הנר האחרון עשוי להיות חלקי":" | "+dataFreshness(loaded)):
 "⚠️ הנתונים שייכים לסימול "+loaded.symbol+" שהוזן, אבל הגרף הנבחר הוא "+now+". הנתונים לא ישמשו לניתוח הסימול האחר.";
}
// Update receipt age even when automatic provider refresh is disabled.
setInterval(()=>{if(!document.hidden)renderStatus()},15000);
function restore(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)||"null");
  if(saved&&(saved.source==="Twelve Data"||saved.source==='CoinLore'&&saved.internalResearchOnly===true&&cryptoResearchSymbol(saved.symbol)===saved.symbol&&cryptoIntervals.has(saved.interval))&&Array.isArray(saved.bars)&&typeof saved.symbol==="string"&&/^[A-Z0-9:._-]{1,30}$/.test(saved.symbol)){
    saved.bars=saved.bars.slice(-CHART_HISTORY_LIMIT);if(!new URLSearchParams(location.search).has("symbol"))chartSymbol.value=saved.symbol;
    chartRevision++;const meta={source:saved.source,interval:saved.interval||"1day",receivedAt:saved.receivedAt||null,...marketSnapshotMetadata(saved),...(saved.source==='CoinLore'?{internalResearchOnly:true,coverage:saved.coverage||'CoinLore aggregated crypto data',quote:saved.quote,latestBarMayBePartial:saved.latestBarMayBePartial===true}:{})};loaded={symbol:saved.symbol,bars:saved.bars,...meta,context:datasetContext(saved.symbol,saved.bars,meta)};
    if(normSymbol()===saved.symbol){
      const selector=$('marketInterval');
      if(Array.from(selector.options||[]).some(option=>option.value===loaded.interval))selector.value=loaded.interval;
      localChart.setData(saved.symbol,saved.bars);
    }
  }
 }catch{}
 renderStatus();
}
// The free AI endpoint is a real LLM. The old keyword-based responder is now
// available only after an explicit click on "local mathematical analysis".
const freeAiAccessKey="asaf_free_ai_code_v1";
const aiStatus=$("freeAiStatus"),imageStatus=$("chatImageStatus");
const imageInput=null; // Graph uploads are no longer part of the product.
let pendingImage=null,chatBusy=false,requestController=null,requestInvalidated=null,conversationEpoch=0;
let conversation=[];
mountConversationArchive({readCurrent:()=>({symbol:normSymbol(),messages:conversation}),isBusy:()=>chatBusy});
function rememberSymbol(){const symbol=normSymbol();if(symbol){const url=new URL(location.href);url.searchParams.set("symbol",symbol);history.replaceState(null,"",url)}}
function datasetReady(){rememberSymbol();if(loaded)window.dispatchEvent(new CustomEvent('asaf:dataset-ready',{detail:{symbol:loaded.symbol,bars:loaded.bars,source:loaded.source,interval:loaded.interval,receivedAt:loaded.receivedAt,...marketSnapshotMetadata(loaded),...(loaded.source==='CoinLore'?{internalResearchOnly:true,coverage:loaded.coverage,quote:loaded.quote,latestBarMayBePartial:loaded.latestBarMayBePartial}:{})}}))}
// Changing the chart invalidates pending analysis, not the conversation itself.
// Previous messages retain their own chartContext and are historical references.
function resetRequest({clearHistory=false}={}){
 const invalidate=requestInvalidated;requestInvalidated=null;
 lastVisibleChart=null;conversationEpoch++;requestController?.abort();requestController=null;chatBusy=false;
 if(clearHistory)conversation=[];
 invalidate?.({clearHistory});
 pendingImage=null;form.querySelector('button').disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(imageInput)imageInput.value='';if($('chatRequestState'))$('chatRequestState').textContent='';if($('chartCapturePanel'))$('chartCapturePanel').hidden=true;
}
$('cancelChat')?.addEventListener('click',()=>requestController?.abort());
window.addEventListener('asaf:logout',()=>{resetRequest({clearHistory:true});log.replaceChildren();sessionStorage.removeItem(freeAiAccessKey);});
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
async function runChatActions(actions,{signal,epoch}={}){
 const result=await executeChartActions(actions,{
  signal,isCurrent:()=>epoch===conversationEpoch,
  getSymbol:normSymbol,
  getData:()=>loaded?.symbol===normSymbol()?loaded:null,
  selectSymbol(symbol){chartRevision++;lastVisibleChart=null;loaded=null;chartSymbol.value=symbol;$('activeSymbol').textContent=symbol;localChart.clear();rememberSymbol();try{sessionStorage.removeItem(key)}catch{}renderStatus();window.dispatchEvent(new Event('asaf:dataset-cleared'));},
  fetchData:()=>loadMarketData({fromChat:true,signal,isCurrent:()=>epoch===conversationEpoch}),
  applyRender:actions=>localChart.applyActions(actions)
 });
 if(result.changed){chartRevision++;renderStatus();if(loaded?.symbol===normSymbol())datasetReady();window.dispatchEvent(new Event('asaf:chart-actions'));}
 return result;
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
 if(requestState)requestState.textContent='מכין את החיבור ונתוני הגרף…';
 const activeController=new AbortController();requestController=activeController;
 let preparedPayload=extra.retryPayload||null,localReceipt=extra.retryPayload?.chartToolReceipt||'',commandLoadAttempted=false;
 let timedOut=false;
 let requestTimeout=setTimeout(()=>{timedOut=true;activeController.abort()},30000);
 let slowNotice=null;
 say("user",question);
 const waiting=say("bot","כותב תשובה…");
 requestInvalidated=({clearHistory})=>{
  clearTimeout(requestTimeout);clearTimeout(slowNotice);
  if(clearHistory)return;
  waiting.textContent=(localReceipt?localReceipt+'\n\n':'')+'הבקשה נעצרה כי בחירת הגרף או הנתונים השתנתה. השיחה הקודמת נשמרה; אפשר לשלוח שוב על הבחירה החדשה.';
  if(!message.value.trim()){message.value=question;message.dispatchEvent(new Event('input'))}
 };
 try{
  await refreshAuth();
  if(epoch!==conversationEpoch)return;
  if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(authState.checkAvailable===false)throw Error("לא ניתן לבדוק את החיבור לחשבון כרגע. השאלה נשמרה; נסה שוב כשהחיבור חוזר.");
  const command=!extra.retryPayload&&!extra.newsArticleId?parseChartCommand(question,{currentSymbol:normSymbol()}):null;
  if(command?.recognized){
   const result=command.actions.length?await runChatActions(command.actions,{signal:activeController.signal,epoch}):{messages:[]};
   commandLoadAttempted=result.dataLoadAttempted===true;
   if(epoch!==conversationEpoch)return;
   const answer=[command.message,...result.messages].filter(Boolean).join('\n');
   localReceipt=answer||'לא זוהתה פעולה לביצוע. נסה לציין סימול וכלי גרף.';
   waiting.textContent=localReceipt;
   const wantsAnalysis=/(?:תנתח|נתח|ניתוח|תסביר|הסבר|למה|מדוע|האם|מה דעתך|analy[sz]e|analysis|explain|why)/iu.test(question);
   // Conceptual explanations can proceed without candles. Actual chart
   // analysis below must have matching data before contacting the model.
   if(!wantsAnalysis){
    conversation.push({role:'user',content:question,chartContext:{symbol:normSymbol(),interval:loaded?.interval,receivedAt:loaded?.receivedAt}},{role:'assistant',content:waiting.textContent,chartContext:{symbol:normSymbol(),interval:loaded?.interval,receivedAt:loaded?.receivedAt}});conversation=conversation.slice(-24);
    setAiStatus(result.changed?'תוצאת כלי הגרף מוצגת בשיחה.':'לא בוצע שינוי בגרף; הפרטים מופיעים בשיחה.');
    return;
   }
   waiting.textContent+='\n\nמכין תשובה לשאלה שלך…';
  }
  if(authState.enabled&&!authState.authenticated)throw Error("יש להיכנס לחשבון באזור הכניסה מעל הצ׳אט.");
  const analyzeChart=!extra.retryPayload&&!extra.newsArticleId&&requestsChartAnalysis(question,{command});
  if(analyzeChart){
   if(!hasAnalysisCandles(loaded,normSymbol(),$('marketInterval').value)){
    if(commandLoadAttempted)throw Error('אין עדיין נרות תואמים לניתוח. טעינת הנתונים לא הצליחה; לא נשלחה בקשה למודל.');
    waiting.textContent=(localReceipt?localReceipt+'\n\n':'')+'טוען את נרות הגרף לפני הניתוח…';
    await loadMarketData({fromChat:true,signal:activeController.signal,isCurrent:()=>epoch===conversationEpoch});
   }
   if(epoch!==conversationEpoch)return;
   if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(!hasAnalysisCandles(loaded,normSymbol(),$('marketInterval').value))throw Error('לא התקבלו נרות תואמים לגרף הנבחר; לא נשלחה בקשה למודל.');
   localReceipt=[localReceipt,'הגרף של '+loaded.symbol+' מוכן: '+loaded.bars.length+' נרות · '+loaded.source+' · '+loaded.interval+' · נר אחרון: '+loaded.bars.at(-1).date+'.'].filter(Boolean).join('\n');
  }
  const context=currentContext();
  const activeData=context&&loaded?.symbol===normSymbol()?loaded:null;
  // The server independently enforces this gate. Check before screenshots or
  // payload preparation so an unavailable analysis has a useful local result.
  if(activeData?.source==='Intrinio'||preparedPayload?.source==='Intrinio'||preparedPayload?.useServerIntrinio===true){
   const policy=await intrinioFeed;
   if(epoch!==conversationEpoch)return;
   if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(policy.aiAnalysisEnabled!==true){
    waiting.textContent=(localReceipt?localReceipt+'\n\n':'')+'ניתוח AI של נתוני Intrinio עדיין אינו פעיל: ממתינים לאישור הספק להעברת הנתונים למודל חיצוני. לא נשלחה בקשה למודל.\n\nאפשר לצפות בגרף, להוסיף ממוצעים ולסמן תמיכות והתנגדויות באמצעות הכלים המקומיים. אלה נתוני סוף יום, לא מחיר חי.';
    if(activeData){const open=document.createElement('button');open.type='button';open.textContent='הצג את הגרף שנטען';open.addEventListener('click',()=>window.dispatchEvent(new Event('asaf:chart-actions')));waiting.append(open)}
    setAiStatus('נתוני הגרף זמינים; ניתוח AI של Intrinio ממתין לאישור הספק.');
    return;
   }
  }
  if(analyzeChart)window.dispatchEvent(new Event('asaf:chart-actions'));
  let code=authState.enabled?"":sessionStorage.getItem(freeAiAccessKey)||"";
  if(!authState.enabled&&!code){
   code=prompt("הכנס קוד גישה פרטי ל-AI החינמי (לא API key):")||"";
   if(!code)throw Error("כדי לקבל תשובות AI אמיתיות, יש להפעיל חיבור OpenRouter החינמי ב-Netlify ולהכניס קוד גישה.");
  }
  if(!authState.enabled&&code.length<24)throw Error("קוד הגישה הפרטי ל-AI חייב לכלול לפחות 24 תווים");
  let image=null;
  const candidate=chartAttachment({manual:extra.image||null,auto:$('chatAutoChart')?.checked===true&&/(?:תמונה|צילום|מה רואים|\b(?:image|screenshot|visual)\b)/iu.test(question),hasMatchingData:!!activeData,snapshot:()=>{if($('localChartCanvas').getBoundingClientRect().width<1)return lastVisibleChart?.symbol===activeData.symbol&&lastVisibleChart?.bars===activeData.bars?lastVisibleChart.image:null;return localChart.snapshot()}});
  if(candidate)image=await shrinkImage(candidate);
  if(epoch!==conversationEpoch)return;
  if(activeController.signal.aborted)throw new DOMException('Cancelled','AbortError');
  preparedPayload=preparedPayload||{
    message:question,
    chartControl:!extra.newsArticleId&&!localReceipt&&requestsChartControl(question),
    chartRevision,
    chartToolReceipt:localReceipt,
    symbol:activeData?.symbol||normSymbol(),
    source:activeData?.source||"none",
    interval:activeData?.interval||$('marketInterval').value||"1day",
    receivedAt:activeData?.receivedAt||null,
    useServerMarket:activeData?.source==="Twelve Data",
    useServerCrypto:activeData?.source==="CoinLore",
    useServerIntrinio:activeData?.source==="Intrinio",
    includeNews:extra.newsArticleId?true:$("chatIncludeNews")?.checked===true,
    newsArticleId:extra.newsArticleId||null,
    bars:recentAIBars(activeData?.bars),
    chartSettings:activeData?localChart.settings():null,
    image,
    history:conversation.slice(-24)
  };
  // Model time starts only after authentication and chart preparation finish.
  clearTimeout(requestTimeout);
  requestTimeout=setTimeout(()=>{timedOut=true;activeController.abort()},65000);
  if(requestState)requestState.textContent='הנתונים נשלחו — ממתין לניתוח…';
  slowNotice=setTimeout(()=>{if(epoch===conversationEpoch&&!activeController.signal.aborted&&requestState)requestState.textContent='המודל עדיין מעבד את הבקשה. אפשר להמתין או לבטל; אין צורך לשלוח שוב.'},20000);
  const response=await fetch("/.netlify/functions/free-chat",{method:"POST",signal:activeController.signal,headers:{"Content-Type":"application/json",...(!authState.enabled?{"x-asaf-free-ai-code":code}:{})},body:JSON.stringify(preparedPayload)});
  let data;try{data=await response.json()}catch{throw Error("פונקציית AI לא נפרסה ל-Netlify. צריך לחבר את GitHub ולפרוס את האתר.")}
  if(!response.ok){
   if(response.status===401)sessionStorage.removeItem(freeAiAccessKey);
   throw Error(data.error||"חיבור ה-AI נכשל (HTTP "+response.status+")");
  }
  if(epoch!==conversationEpoch)return;
  if(!data.answer)throw Error("לא התקבלה תשובה מהמודל");
  if(!authState.enabled)sessionStorage.setItem(freeAiAccessKey,code);
  const followAnswer=isChatNearBottom(log);
  waiting.textContent=(localReceipt?localReceipt+'\n\n':'')+data.answer;
  if(preparedPayload.symbol!==normSymbol()||preparedPayload.chartRevision!==chartRevision)waiting.textContent+='\n\nשים לב: זו תשובה על צילום הנתונים שנשלח. הגרף השתנה בזמן ההמתנה; הניתוח אינו מתייחס לתצוגה החדשה.';
  if(Array.isArray(data.actions)&&data.actions.length){
   if(preparedPayload.symbol!==normSymbol()||preparedPayload.chartRevision!==chartRevision)waiting.textContent+='\nלא בוצעו כלים: המניה או נתוני הגרף השתנו מאז שליחת הבקשה. שלח בקשה חדשה על הגרף הנוכחי.';
   else{try{const execution=await runChatActions(data.actions,{signal:activeController.signal,epoch});if(epoch!==conversationEpoch)return;waiting.textContent+='\n\nתוצאת הביצוע בפועל:\n'+execution.messages.join('\n');}catch(error){if(error.name==='AbortError')throw error;waiting.textContent+='\nלא בוצעו כלים מהתשובה: '+error.message;}}
  }

  if(data.newsArticle){const article=data.newsArticle;try{const url=new URL(article.url);if(url.protocol==='https:'&&!url.username&&!url.password){const card=document.createElement('p'),link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(article.title||'כותרת המקור');card.append(link);const meta=document.createElement('small');meta.textContent=' · '+String(article.source||'')+' · '+String(article.publishedAt||'');card.append(meta);waiting.append(card)}}catch{}}

  conversation.push({role:"user",content:question,chartContext:{symbol:preparedPayload.symbol,interval:preparedPayload.interval,receivedAt:preparedPayload.receivedAt}},{role:"assistant",content:waiting.textContent,chartContext:{symbol:preparedPayload.symbol,interval:preparedPayload.interval,receivedAt:preparedPayload.receivedAt}});
  conversation=conversation.slice(-24);
  if(data.analysisContext){const receipt=document.createElement('p');receipt.className='chat-analysis-receipt';receipt.dir='auto';receipt.textContent=analysisReceipt(data.analysisContext);waiting.append(receipt)}
  if(followAnswer)log.scrollTop=log.scrollHeight;
  pendingImage=null;
  if(imageInput)imageInput.value="";
  if(imageStatus)imageStatus.textContent=image?"התמונה נשלחה עם ההודעה. התמיכה החזותית תלויה במודל שנבחר.":"נתוני הגרף הפתוח מצורפים אוטומטית כשיש נתונים תואמים.";
  setAiStatus("✓ AI שיחתי מחובר · openrouter/free · ללא חיוב טוקנים · נתוני שוק לפי מקור/תאריך");
 }catch(e){
  if(epoch!==conversationEpoch)return;
  waiting.textContent=(localReceipt?localReceipt+"\n\n":"")+"⚠️ "+(e.name==="AbortError"?(timedOut?"הזמן להמתנה לתשובה הסתיים.":"הבקשה בוטלה."):e.message);
  // Recover text locally, without making another request or spending quota.
  // The next send is an explicit new request using the then-visible context.
  if(!message.value.trim()){message.value=question;message.dispatchEvent(new Event('input'))}
  const recovery=document.createElement('p');
  recovery.textContent=(extra.newsArticleId?'כדי לנסות שוב עם אותה כותרת, פתח אותה מחדש בלשונית החדשות. ':'')+'השאלה נשמרה כאן. לפני שליחה מחדש, בדוק את המניה, הגרף והנתונים המצורפים; ההודעה הבאה תשתמש בבחירה הנוכחית.';
  waiting.append(recovery);
  const edit=document.createElement('button');edit.type='button';edit.textContent='העתק את השאלה לעריכה';
  edit.addEventListener('click',()=>{if(message.value.trim()&&message.value.trim()!==question){if(!window.confirm('להחליף את הטיוטה הנוכחית בשאלה הזו?'))return}message.value=question;message.dispatchEvent(new Event('input'));message.focus()});
  waiting.append(edit);
  const retry=document.createElement('button');retry.type='button';
  retry.textContent=preparedPayload?'נסה שוב עם אותם נתונים':'נסה שוב בבחירה הנוכחית';
  retry.addEventListener('click',()=>{if(chatBusy)return;ask(question,preparedPayload?{...extra,retryPayload:preparedPayload}:extra)});
  waiting.append(retry);
  setAiStatus("החיבור ל-AI אינו פעיל או נחסם — התשובה לא הוחלפה בטקסט מוכן.");
 }finally{
  clearTimeout(requestTimeout);
  clearTimeout(slowNotice);
  if(epoch===conversationEpoch){chatBusy=false;requestController=null;requestInvalidated=null;submitButton.disabled=false;if($('cancelChat'))$('cancelChat').disabled=true;if(requestState)requestState.textContent='';}
 }
}
$('clearConversation')?.addEventListener('click',()=>{
 resetRequest({clearHistory:true});log.replaceChildren();if(imageStatus)imageStatus.textContent='נתוני הגרף הזמינים מצורפים אוטומטית.';say('bot','שיחה חדשה. נתוני הגרף שנבחרו נשארו זמינים.');
});
$('exportConversation')?.addEventListener('click',()=>{
 const text=[...log.querySelectorAll('.bubble')].map(el=>(el.classList.contains('user')?'אתה: ':'ASAF AI: ')+el.textContent).join('\n\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='asaf-conversation.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('asaf:load-dataset',event=>{
 const data=event.detail;if(!data||!['Twelve Data','CoinLore'].includes(data.source)||data.source==='CoinLore'&&data.internalResearchOnly!==true||!Array.isArray(data.bars))return;
 const symbol=String(data.symbol||'').toUpperCase().replace(/[^A-Z0-9:._-]/g,'').slice(0,30);
 try{const bars=data.bars.slice(-CHART_HISTORY_LIMIT);if(data.source==='CoinLore'&&(cryptoResearchSymbol(symbol)!==symbol||!cryptoIntervals.has(data.interval)))throw Error('סימול הקריפטו או טווח הזמן אינם נתמכים.');
 const interval=['intraday','1min','5min','15min','30min','1h','1day','1week','1month'].includes(data.interval)?data.interval:'1day',meta={source:data.source,interval,receivedAt:data.receivedAt||null,...marketSnapshotMetadata(data),...(data.source==='CoinLore'?{internalResearchOnly:true,coverage:data.coverage||'CoinLore aggregated crypto data',quote:data.quote,latestBarMayBePartial:data.latestBarMayBePartial===true}:{})},context=datasetContext(symbol,bars,meta);
 chartRevision++;resetRequest();chartSymbol.value=symbol;$('activeSymbol').textContent=symbol;$("chart").replaceChildren();loaded={symbol,bars,context,...meta};if(Array.from($('marketInterval').options||[]).some(option=>option.value===interval))$('marketInterval').value=interval;localChart.setData(symbol,bars);try{if(data.source==='Intrinio')sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify({symbol,bars,...meta}))}catch{}
 renderStatus();datasetReady();status.textContent='נתוני '+symbol+' נטענו לגרף ולצ׳אט.';
 }catch(e){status.textContent=e.message}
});
$("forgetFreeAiCode")?.addEventListener("click",()=>{
 sessionStorage.removeItem(freeAiAccessKey);
 resetRequest({clearHistory:true});
 setAiStatus("קוד הגישה הפרטי נשכח; יידרש בכניסה הבאה.");
});
$("offlineAnalysis")?.addEventListener("click",()=>{
 const context=currentContext();
 say("bot","🧮 ניתוח מתמטי מקומי (ללא AI):\\n"+answerStockQuestion("תנתח את הגרף ואת המגמה",context));
});
const lastFetchBySymbol=new Map();
const intrinioFeed=fetch('/.netlify/functions/intrinio-research',{cache:'no-store'}).then(async r=>r.ok?await r.json():{enabled:false}).catch(()=>({enabled:false}));
const publicFeed=fetch('/.netlify/functions/public-market',{cache:'no-store'}).then(async r=>r.ok?await r.json():{enabled:false}).catch(()=>({enabled:false}));
publicFeed.then(c=>{const option=$('marketAutoRefresh');if(option)option.disabled=!c.enabled;if(authState.enabled)$('marketForgetCode').hidden=true});
Promise.all([intrinioFeed,publicFeed]).then(([intrinio,publicMarket])=>{
 if(intrinio.enabled){
  $('marketProviderTitle').textContent='Intrinio · ניסיון פנימי למנהל';
  $('marketProviderDescription').textContent='נרות יומיים קודמים של מניות ארה״ב, מותאמים לפיצולים ולדיבידנדים. הטעינה ידנית ובחשבון בעל הפרויקט בלבד; אלה נתוני סוף יום, לא מחיר חי.';
  $('marketProviderScope').textContent=intrinio.aiAnalysisEnabled?'ניתוח AI של נתוני Intrinio מופעל למנהל, בכפוף לזמינות השירות.':'הגרף והאינדיקטורים המקומיים זמינים לאחר טעינה. העברת נתוני Intrinio למודל AI חיצוני עדיין כבויה.';
 }else if(publicMarket.enabled){
  $('marketProviderTitle').textContent='חיבור נתוני שוק · הספק מוגדר';
  $('marketProviderScope').textContent='היכנס לחשבון וטען נתונים. מקור הנתונים ומועד הנר האחרון יוצגו לאחר טעינה מוצלחת.';
 }
 if(marketStatus.textContent==='בודק את הגדרת ספק הנתונים…')marketStatus.textContent=intrinio.enabled?'Intrinio מוגדר · היכנס כמנהל ובחר מניה בטווח יומי. זמינות הנתונים תיבדק בטעינה.':publicMarket.enabled?'ספק הנתונים מוגדר · טען גרף לאימות.':'נתוני מניות טרם הופעלו. ממתינים להגדרת ספק מורשה.';
});
async function loadMarketData({fromChat=false,signal,isCurrent=()=>true}={}){
 const requested=normSymbol(),crypto=cryptoResearchSymbol(requested),symbol=crypto||requested;
 if(!symbol)throw Error("נא להזין סימול מניה תחילה.");
 const interval=$("marketInterval").value,fetchKey=symbol+"|"+interval;
 if(crypto&&!cryptoIntervals.has(interval))throw Error('בניסוי הקריפטו זמין טווח 1day בלבד. בחר טווח נתמך; הטווח לא שונה אוטומטית.');
 const memberMode=authState.enabled,intrinio=!crypto&&memberMode&&(await intrinioFeed).enabled===true;
 if(intrinio&&interval!=='1day')throw Error('ניסיון Intrinio תומך כרגע בנרות יומיים בלבד. בחר 1day.');
 if(crypto){
  if(!authState.authenticated)throw Error('יש להיכנס לחשבון בעל הפרויקט לפני טעינת נתוני ניסוי הקריפטו.');
 }else{
  const feed=await publicFeed;
  if((memberMode||fromChat)&&!feed.enabled&&!intrinio)throw Error('נתוני השוק טרם חוברו. ממתינים לספק ולאישור רישוי; לא ניתן להציג גרף או לסמן רמות ללא נרות.');
  if(memberMode&&!authState.authenticated)throw Error('יש להיכנס לחשבון לפני טעינת נתונים.');
  if(fromChat&&!memberMode)throw Error('טעינה בצ׳אט זמינה רק דרך חיבור הנתונים של האתר.');
 }
 if(!isCurrent()||signal?.aborted)throw new DOMException('Cancelled','AbortError');
 if(crypto&&symbol!==requested){chartSymbol.value=symbol;$('activeSymbol').textContent=symbol;rememberSymbol();}
 if(Date.now()-(lastFetchBySymbol.get(fetchKey)||0)<(crypto||memberMode?60000:300000))throw Error('הרענון עדיין בהמתנה למכסה. אפשר לרענן בחיבור חשבון לכל היותר פעם בדקה; בחיבור פרטי פעם ב־5 דקות.');
 let passcode=crypto||memberMode?'':sessionStorage.getItem(privateAccessKey);
 if(!crypto&&!memberMode&&!passcode){
  passcode=window.prompt('קוד הגישה הפרטי לנתוני השוק (לא מפתח API):')||'';
  if(!passcode)throw Error('לא הוזן קוד גישה לנתונים.');
 }
 if(!crypto&&!memberMode&&passcode.length<20)throw Error('קוד הגישה חייב להכיל לפחות 20 תווים.');
 marketButton.disabled=true;
 marketStatus.textContent=crypto?'טוען נרות מ־CoinLore לניסוי מחקר פנימי של בעל הפרויקט…':'מתחבר לספק הנתונים (בקשה מפורשת בלבד)…';
 try{
  const response=await fetch(crypto?'/.netlify/functions/crypto-research':intrinio?'/.netlify/functions/intrinio-research':memberMode?'/.netlify/functions/public-market':'/.netlify/functions/market',{
   method:'POST',signal,credentials:'same-origin',headers:{'Content-Type':'application/json',...(!crypto&&!memberMode?{'x-asaf-market-access':passcode}:{})},body:JSON.stringify({symbol,interval})
  });
  let result;try{result=await response.json()}catch{throw Error('פונקציית הנתונים החזירה תשובה לא תקינה.');}
  if(!response.ok){if(response.status===401&&!crypto)sessionStorage.removeItem(privateAccessKey);throw Error(result.error||'קריאת נתונים נכשלה');}
  if(!Array.isArray(result.bars)||result.bars.length<21)throw Error('התקבלו פחות מ־21 נרות.');
  if(!isCurrent()||signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(normSymbol()!==symbol||$('marketInterval').value!==interval)throw Error('הסימול או טווח הזמן השתנו בזמן הטעינה. שלח בקשה חדשה.');
  if(result.symbol!==(crypto?symbol:symbol.split(':').at(-1)))throw Error('הספק החזיר סימול שונה מהנבחר.');
  if(result.interval!==interval)throw Error('הספק החזיר טווח נרות שונה מהנבחר.');
  if(crypto&&(!Number.isFinite(result.quote?.price)||result.quote.price<=0||result.quote.quoteTime!==null||result.quote.receivedAt!==result.receivedAt))throw Error('ציטוט הקריפטו אינו תקין.');
  if(crypto&&(result.source!=='CoinLore'||result.interval!==interval||result.internalResearchOnly!==true))throw Error('מקור הקריפטו או תחום הניסוי לא אומתו.');
  if(intrinio&&(result.source!=='Intrinio'||result.internalResearchOnly!==true))throw Error('מקור Intrinio לא אומת.');
  const bars=result.bars.slice(-CHART_HISTORY_LIMIT),meta={source:crypto?'CoinLore':intrinio?'Intrinio':'Twelve Data',...(intrinio?{internalResearchOnly:true}:{} ),interval,receivedAt:result.receivedAt,...marketSnapshotMetadata(result),...(crypto?{internalResearchOnly:true,coverage:result.coverage||'CoinLore aggregated crypto data',quote:result.quote,latestBarMayBePartial:result.latestBarMayBePartial===true}:{})};
  const context=datasetContext(symbol,bars,meta);
  chartRevision++;lastVisibleChart=null;loaded={symbol,bars,context,...meta};localChart.setData(symbol,bars);
  if(!crypto&&!memberMode)sessionStorage.setItem(privateAccessKey,passcode);
  try{if(intrinio)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify({symbol,bars,...meta}))}catch{}
  lastFetchBySymbol.set(fetchKey,Date.now());renderStatus();datasetReady();
  marketStatus.textContent=crypto?'✓ CoinLore בלבד · ניסוי מחקר פנימי · '+symbol+' · '+interval+' · נר אחרון: '+result.latestBarTime+' · התקבלו: '+result.receivedAt+' · ציטוט נפרד: $'+result.quote.price+' (זמן עסקה אינו ידוע) · רענון REST לכל היותר פעם בדקה, ללא זרם עסקאות; הנר האחרון עשוי להיות חלקי.':
   '✓ נר אחרון: '+result.latestBarTime+' | '+(result.exchange||'בורסה לא ידועה')+' | אזור זמן: '+(result.exchangeTimezone||'לא ידוע')+' | מקור '+(intrinio?'Intrinio':'Twelve Data')+(result.cached?' (מטמון)':'')+' | '+(result.coverage||'כיסוי לא הוצהר')+(Number.isFinite(result.delayMinutes)?' | עיכוב מוצהר: '+result.delayMinutes+' דקות':intrinio?' | נתוני סוף יום, לא מחיר חי':'; נתונים עשויים להיות מעוכבים.');
  status.textContent='הגרף המקורי והצ׳אט מציגים כעת את אותם '+bars.length+' נרות. אפשר לבקש בצ׳אט ניתוח וסימונים.';
  if(!fromChat)say('bot',crypto?'נטענו '+bars.length+' נרות של '+symbol+' מ־CoinLore בלבד לניסוי מחקר פנימי. נר אחרון: '+result.latestBarTime+'. זהו צילום מצב REST ולא פיד עסקאות רציף; הנר האחרון עשוי להיות חלקי.':'📡 קיבלתי '+bars.length+' נרות של '+symbol+' בטווח '+interval+'. נר אחרון: '+result.latestBarTime+'.');
  if(!fromChat)document.querySelector('[data-tab="charts"]').click();
  return loaded;
 }catch(error){marketStatus.textContent='לא התחבר: '+error.message;throw error;}
 finally{marketButton.disabled=false;}
}
marketButton.addEventListener("click",()=>loadMarketData().catch(error=>{marketStatus.textContent=error.message}));
setInterval(()=>{if($('marketAutoRefresh')?.checked&&!document.hidden&&authState.authenticated&&!marketButton.disabled)marketButton.click()},61000);
window.addEventListener('asaf:logout',()=>{if($('marketAutoRefresh'))$('marketAutoRefresh').checked=false;if(['CoinLore','Intrinio'].includes(loaded?.source)){chartRevision++;loaded=null;localChart.clear();try{sessionStorage.removeItem(key)}catch{}renderStatus();window.dispatchEvent(new Event('asaf:dataset-cleared'))}});
$("marketForgetCode").addEventListener("click",()=>{
 sessionStorage.removeItem(privateAccessKey);
 marketStatus.textContent="קוד הגישה הזמני נשכח מהמכשיר.";
});
const captureButton=$("captureChart"),preview=$("chartCapturePreview"),capturePanel=$("chartCapturePanel");
captureButton.addEventListener("click",()=>{
 try{
   const context=currentContext();
   if(!context)throw Error("נדרשים נתוני ספק שמתאימים לסימול הנוכחי");
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
 chartRevision++;resetRequest();loaded=null;window.dispatchEvent(new Event("asaf:dataset-cleared"));
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
// A newly selected interval must never reuse old candles, even for the same symbol.
$("marketInterval").addEventListener("change",()=>{
 chartRevision++;resetRequest();loaded=null;localChart.clear();
 try{sessionStorage.removeItem(key)}catch{}
 renderStatus();window.dispatchEvent(new Event("asaf:dataset-cleared"));
});
chartSymbol.addEventListener("input",()=>{chartRevision++;rememberSymbol();$("chart").replaceChildren();resetRequest();renderStatus();window.dispatchEvent(new Event("asaf:dataset-cleared"));if(loaded&&normSymbol()===loaded.symbol){localChart.setData(loaded.symbol,loaded.bars);datasetReady()}else localChart.clear()});
document.querySelector('[data-tab="charts"]').addEventListener("click",()=>requestAnimationFrame(()=>localChart.redraw()));
window.addEventListener('asaf:layout',()=>requestAnimationFrame(()=>localChart.redraw()));
restore();
say("bot","אני ASAF AI. כתוב למשל: פתח AAPL, הוסף ממוצע 20 וסמן תמיכות והתנגדויות; או: בדוק ספל וידית וראש וכתפיים הפוך. אבצע את כלי המחקר על נרות זמינים ואדווח מה בוצע ומה לא נמצא. פתיחת גרפים תלויה בחיבור ספק הנתונים; אין צורך להעלות קבצים.");
if(loaded&&normSymbol()===loaded.symbol)say("bot","נתוני "+loaded.symbol+" נטענו מחדש מהלשונית הנוכחית, עד "+loaded.context.date+".");
window.addEventListener('asaf:request-dataset',datasetReady);
queueMicrotask(datasetReady);
if(new URLSearchParams(location.search).get("tab")==="chat"){
 document.querySelector('[data-tab="chat"]').click();
}


message.addEventListener('keydown',event=>{if(shouldSendOnEnter(event,window.matchMedia('(pointer: coarse)').matches)){event.preventDefault();if(message.value.trim()&&!chatBusy)form.requestSubmit()}});
message.addEventListener('input',()=>{message.style.height='auto';message.style.height=Math.min(180,message.scrollHeight)+'px'});

// Preserve only the chart the user actually saw before opening full-page chat.
document.querySelector('[data-tab="chat"]').addEventListener('click',()=>{if(!loaded||loaded.symbol!==normSymbol()||!$('chatAutoChart').checked||$('localChartCanvas').getBoundingClientRect().width<1)return;try{lastVisibleChart={symbol:loaded.symbol,bars:loaded.bars,image:localChart.snapshot()}}catch{lastVisibleChart=null}},{capture:true});

window.addEventListener('asaf:ask-news',event=>{const id=event.detail?.id;if(typeof id!=='string'||id.length>1000)return;if(chatBusy){status.textContent='עצור או המתן לתשובה הקיימת לפני פתיחת שאלה על כותרת.';return}document.querySelector('[data-tab="chat"]').click();ask('הסבר בעברית את משמעות הכותרת המצורפת, מה עשוי להיות רלוונטי למשקיע ומה עדיין צריך לאמת. אל תטען שקראת את הכתבה המלאה.',{newsArticleId:id})});

// Invalidate pending tool plans if a user changes chart settings while AI waits.
document.querySelectorAll('#localChartPanel input,#localChartPanel select').forEach(control=>control.addEventListener('change',()=>{chartRevision++}));
