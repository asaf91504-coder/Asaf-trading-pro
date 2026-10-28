import {validateChartActions} from './chat-chart-actions.mjs';
import {analyzeChartTools} from './chart-analysis-tools.mjs';

const kinds={cup_handle:'cupHandle',inverse_head_shoulders:'inverseHeadShoulders',head_shoulders:'headShoulders',double_bottom:'doubleBottom',double_top:'doubleTop',all:'patterns'};
// Executes only declarative research/display tools. No trading, code, URLs or
// model-supplied price coordinates can enter this boundary.
export async function executeChartActions(input,tools){
 const actions=validateChartActions(input),messages=[];
 let changed=false,annotations=[];
 const check=()=>{if(tools.signal?.aborted||tools.isCurrent?.()===false)throw new DOMException('Cancelled','AbortError')};
 check();
 const symbols=actions.filter(a=>a.type==='symbol');
 if(new Set(symbols.map(a=>a.symbol)).size>1)return {changed:false,messages:['אפשר לפתוח מניה אחת בכל בקשה. ציין איזו מניה לפתוח.']};
 const selected=symbols[0];
 if(selected){
  const current=tools.getSymbol(),same=selected.symbol===current||(!selected.symbol.includes(':')||!current.includes(':'))&&selected.symbol.split(':').at(-1)===current.split(':').at(-1);
  if(!same){tools.selectSymbol(selected.symbol);changed=true;messages.push('נבחרה המניה '+selected.symbol+'.');}
  else messages.push('המניה הפעילה: '+current+'.');
 }
 // Fetch exactly once, only when explicitly requested actions need missing data.
 const needsData=selected||actions.some(a=>['levels','trendlines','pattern'].includes(a.type));
 if(needsData&&!tools.getData()){
  try{await tools.fetchData();check();messages.push('נתוני הספק נטענו לגרף.');changed=true;}
  catch(error){check();messages.push('לא נטענו נתוני מניה: '+error.message);}
 }
 for(const action of actions){
  check();
  if(action.type==='symbol')continue;
  if(['indicator','style','clear_annotations'].includes(action.type)){
   if(action.type==='clear_annotations')annotations=[];
   tools.applyRender([action]);changed=true;
   messages.push(action.type==='indicator'?(action.enabled?'הופעל ':'הוסתר ')+action.indicator+'.':action.type==='style'?'סגנון הגרף עודכן ל־'+action.style+'.':'סימוני ה־AI נוקו; השרטוטים הידניים נשמרו.');
   continue;
  }
  const data=tools.getData();
  if(!data?.bars?.length){messages.push('לא בוצע סימון: אין נרות תואמים למניה שנבחרה.');continue;}
  const result=analyzeChartTools({bars:data.bars,kind:action.type==='levels'?'supportResistance':action.type==='trendlines'?'trendlines':kinds[action.pattern]});
  let items=result.annotations;
  if(action.type==='levels'&&action.kind!=='both')items=items.filter(item=>item.kind===action.kind);
  annotations.push(...items);
  messages.push(result.summary);
  if(result.limitations)messages.push(Array.isArray(result.limitations)?result.limitations.join(' '):result.limitations);
 }
 check();
 if(annotations.length){
  // Preserve useful patterns before repetitive level lines, bounded renderer.
  annotations=[...new Map(annotations.map(a=>[JSON.stringify(a),a])).values()].slice(0,30);
  tools.applyRender([{type:'annotations',items:annotations}]);changed=true;
  messages.push('סומנו '+annotations.length+' סימוני מחקר על הגרף. תבניות הן מועמדות לבדיקה, לא אישור לפריצה או תחזית.');
 }
 return {changed,messages:[...new Set(messages)].filter(Boolean)};
}
