// A learning exercise is not a request to operate on the currently open chart.
// This classification never relaxes server source, attachment or licence gates.
export function isLearningQuestion(value){
 const text=String(value||'');
 const exercise=/היפותטי|היפותטיים|תרגיל|דוגמה לימודית|אתגר לימודי|\b(?:hypothetical|learning exercise|educational example)\b/iu.test(text);
 const actualChart=/(?:נתח|תנתח|פתח|טען|סמן).{0,25}(?:הגרף (?:הפתוח|הנוכחי|המצורף)|גרף אמיתי)|\b(?:analy[sz]e|open|load|draw).{0,25}(?:current|attached|live) chart\b/iu.test(text);
 return exercise&&!actualChart;
}
export function wantsTradeReview(value){
 const text=String(value||'');
 return !isLearningQuestion(text)&&/(?:תנתח|נתח|ניתוח|מתי\s+(?:ל?הי?כנס|להיכנס|לצאת)|נקודת כניסה|\b(?:analy[sz]e|entry|exit)\b)/iu.test(text);
}
export function analysisChartActions(actions,side='long'){
 const out=actions.slice();
 for(const action of [{type:'levels',kind:'both'},{type:'trendlines'},{type:'tradelevels',side}])if(!out.some(a=>a.type===action.type))out.push(action);
 return out;
}
export function mergeResearchActions(existing,added){
 let out=existing.slice();
 for(const action of added){
  if(action.type==='clear_annotations')out=out.filter(a=>!['levels','trendlines','pattern','tradelevels','clear_annotations'].includes(a.type));
  const key=a=>a.type+(a.type==='indicator'?':'+a.indicator:a.type==='pattern'?':'+a.pattern:'');
  out=out.filter(a=>key(a)!==key(action));out.push(action);
 }
 return out.slice(-12);
}
export const CONCISE_CHAT_POLICY=`\nRESPONSE STYLE: Default to a short, concrete answer in the user's language, normally at most90 words. Expand only if the user explicitly asks for detail. For chart review, give exactly3 short bullets and at most50 words total, with no introductory paragraph: trend and trendline status, entry condition, exit condition. State the actual trading conditions in plain language; do not describe the site's architecture, source licensing, algorithms, curriculum, annotations count or tool execution. Source and timestamp are available in the UI details. If no valid trendline was found, say that briefly rather than giving a disclaimer. Keep each bullet to roughly12 words; prioritize the missing confirmation and any structural-stop conflict. Do not repeat market metrics already visible on the chart or price card. The UI displays the verified entry, stop and measured target separately; do not duplicate their full calculation or recite the curriculum/checklist. If data is missing state one precise blocker. No long introduction, generic lecture or repeated disclaimers. Never claim a chart was drawn before the supplied tool receipt confirms it; never invent levels or weaken source rules to make the answer shorter.\n`;
