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
export function requestsDetailedAnswer(value){
 const text=String(value||'');
 if(/(?:אל\s+תפרט|בלי\s+פירוט|ללא\s+פירוט|בקצרה|תשובה\s+קצרה)|\b(?:briefly|keep\s+it\s+short|short\s+(?:answer|reply)|without\s+detail|do\s+not\s+elaborate)\b/iu.test(text))return false;
 return /(?:תפרט|פרט\s+(?:לי|את)|בהרחבה|מעמיק|מעמיקה|מפורט|מפורטת|לעומק|צעד\s+אחר\s+צעד)|\b(?:in\s+detail|detailed|in[- ]depth|elaborate|step[- ]by[- ]step|exhaustive|en\s+détail|ausführlich|en\s+detalle|detalhadamente|подробно)\b|بالتفصيل|详细|詳しく/iu.test(text);
}
export const CONCISE_CHAT_POLICY=`\nRESPONSE STYLE: Default to a short, concrete answer in the user's language, normally at most60 words, 2–4 sentences or at most3 short bullets. A requested technical review may use up to80 words and a broad market overview up to120 words so that the requested moves and levels remain clear. Lead with the answer; no introduction, repeated question, generic lecture, automatic follow-up offer or repeated disclaimer. For a default chart review include the signed move with its comparison period, trend, candidate support/resistance and a brief confirmation or invalidation condition. Use provided server numbers only; keep the timeframe and bar date clear. The verified card already supplies entry, stop and target; do not repeat them. Do not repeat the price card or append a curriculum/checklist. Include numeric changes when assessing the market or a chart; omit historical anecdotes unless asked. Explain the practical consequence of missing or stale data in one short clause when material. Do not narrate graph provenance, provider plumbing, licensing, server algorithms, rendering, annotation counts or tool execution; attribution and timestamps remain in the chart/UI details. Do not show source names, source lists, links or numbered citation markers in the customer answer. Retain evidence separately in metadata. Preserve material risk limits. Keep verified server prices and source gates unchanged. Never invent levels, claim a chart was drawn before a confirming receipt or shorten by removing a condition that changes the meaning. Expand only when the current user request explicitly asks for depth.\n`;
export function responseDepthPolicy(query){
 return requestsDetailedAnswer(query)?'\nRESPONSE DEPTH: The current user explicitly requested detail. Give a structured, focused explanation with relevant reasoning or calculations. The default word and bullet limits do not apply; existing output and cost limits still apply. Keep factual uncertainty precise, and explain provenance or architecture only if asked.\n':'\nRESPONSE DEPTH: BRIEF. The current request does not ask for depth. Use the short default even if previous messages were long or the retrieved notes contain lengthy checklists.\n';
}
