import {validCandleTime} from './candle-time.mjs';
import {patternResearch} from './pattern-research.mjs';

const kinds=new Set(['supportResistance','trendlines','headShoulders','inverseHeadShoulders','doubleTop','doubleBottom','cupHandle','patterns']);
const labels={headShoulders:'ראש וכתפיים',inverseHeadShoulders:'ראש וכתפיים הפוך',doubleTop:'דאבל טופ',doubleBottom:'דאבל בוטום',cupHandle:'ספל וידית'};
const limitations=['סימון מחקרי לפי כללים גאומטריים; אינו ודאות, תחזית או הוראת מסחר.','מבוסס על עד 200 הנרות האחרונים שנטענו. ייתכן שהנר האחרון טרם הושלם; אין הבטחה לנתונים חיים.','תבניות נבדקות על נרות יומיים בלבד. מחזורי מסחר ואירועי חברה אינם מאשרים את התבנית.'];
function validBars(input){
 if(!Array.isArray(input)||!input.length||input.length>2000)throw Error('נדרשת סדרת נרות תקינה של עד 2000 נרות.');
 for(let i=0;i<input.length;i++){const b=input[i];if(!validCandleTime(b?.date)||![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0&&v<=1e12)||b.high<b.low||b.close<b.low||b.close>b.high||(i&&b.date<=input[i-1].date))throw Error('נדרשים נרות תקינים בסדר כרונולוגי וללא כפילויות.');}
 return input.slice(-200);
}
function pivots(bars,field){
 const compare=field==='high'?((a,b)=>a>b):((a,b)=>a<b),result=[];
 // The last candle cannot confirm a pivot: there must be two observations after
 // the pivot and before the newest, potentially incomplete, candle.
 for(let i=2;i<bars.length-3;i++)if([i-2,i-1,i+1,i+2].every(j=>compare(bars[i][field],bars[j][field])))result.push(i);
 return result;
}
const point=(bars,index,price)=>({date:bars[index].date,price});
function annotation(bars,kind,label,anchors){return {kind,label,candidate:true,points:anchors.map(([index,price])=>point(bars,index,price))};}
function extremaIndex(bars,start,end,field){let best=start;for(let i=start+1;i<end;i++)if(field==='high'?bars[i].high>bars[best].high:bars[i].low<bars[best].low)best=i;return best;}

function supportResistance(bars){
 if(bars.length<3)return [];
 const prior=bars.slice(Math.max(0,bars.length-21),-1),support=Math.min(...prior.map(b=>b.low)),resistance=Math.max(...prior.map(b=>b.high)),start=bars.length-prior.length-1,end=bars.length-1;
 return [annotation(bars,'support','תמיכה משוערת · שפל '+prior.length+' נרות קודמים',[[start,support],[end,support]]),annotation(bars,'resistance','התנגדות משוערת · שיא '+prior.length+' נרות קודמים',[[start,resistance],[end,resistance]])];
}
function trendlines(bars){
 const result=[];
 for(const field of ['low','high']){
  const indices=pivots(bars,field);if(indices.length<3)continue;
  const [a,b,c]=indices.slice(-3),pa=bars[a][field],pb=bars[b][field],pc=bars[c][field],slope=(pc-pa)/(c-a),expected=pa+slope*(b-a);
  if(c-a<8||bars.length-1-c>30||Math.abs(pb-expected)/expected>.02)continue;
  // Only monotonic, supported pivot lines, not arbitrary fitted predictions.
  if(field==='low'?!(pa<pb&&pb<pc):!(pa>pb&&pb>pc))continue;
  const broken=bars.slice(a+1).some((bar,j)=>field==='low'?bar.low<(pa+slope*(j+1))*.98:bar.high>(pa+slope*(j+1))*1.02);
  if(broken)continue;
  result.push(annotation(bars,'trendline',field==='low'?'קו מגמה עולה משוער · 3 שפלים מאושרים':'קו מגמה יורד משוער · 3 שיאים מאושרים',[[a,pa],[c,pc]]));
 }
 return result;
}

// Conservative cup/handle geometry, not a trained or certified classifier.
// Requires a prior rise, a broad rounded basin, similar confirmed rims and an
// upper-half handle that has started to recover. Never assigns a probability.
export function cupHandleCandidate(input){
 const bars=validBars(input),n=bars.length;if(n<38||bars.some(b=>b.date.length!==10))return null;
 const highs=pivots(bars,'high');
 for(let ri=highs.length-1;ri>=1;ri--){
  const right=highs[ri],handleBars=n-1-right;if(handleBars<4||handleBars>20)continue;
  for(let li=ri-1;li>=0;li--){
   const left=highs[li],width=right-left;if(left<8||width<24||width>100)continue;
   const leftPrice=bars[left].high,rightPrice=bars[right].high,rim=(leftPrice+rightPrice)/2;
   if(Math.abs(leftPrice-rightPrice)/rim>.05)continue;
   const bottom=extremaIndex(bars,left+1,right,'low'),floor=bars[bottom].low,depth=rim-floor,depthRatio=depth/rim;
   if(depthRatio<.12||depthRatio>.40||(bottom-left)/width<.25||(bottom-left)/width>.75)continue;
   const priorLow=Math.min(...bars.slice(left-8,left).map(b=>b.close));if(leftPrice/priorLow<1.10)continue;
   // A narrow V is rejected: lower-third closes must span both sides and occupy
   // at least a quarter of the cup, with no intervening breakout above the rims.
   const basin=bars.slice(left+1,right).map((bar,j)=>({index:left+1+j,close:bar.close})).filter(p=>p.close<=floor+depth/3);
   if(basin.length<Math.ceil(width*.25)||!basin.some(p=>p.index<bottom)||!basin.some(p=>p.index>bottom)||bars.slice(left+1,right).some(b=>b.high>Math.max(leftPrice,rightPrice)*1.02))continue;
   const handleLow=extremaIndex(bars,right+1,n,'low'),handleFloor=bars[handleLow].low,pullback=(rightPrice-handleFloor)/rightPrice;
   if(handleLow>n-3||pullback<.03||pullback>.15||rightPrice-handleFloor>depth*.5||handleFloor<floor+depth*.5)continue;
   if(bars.at(-1).close<=bars[handleLow].close||bars.at(-1).close<bars.at(-2).close||bars.slice(right+1).some(b=>b.high>rim*1.08))continue;
   return {kind:'cupHandle',label:'מועמד לספל וידית',stage:bars.at(-1).close>Math.max(leftPrice,rightPrice)?'above':'waiting',left,right,bottom,handleLow,rim,depth,points:[left,Math.round((left+bottom)/2),bottom,Math.round((bottom+right)/2),right,handleLow,n-1].map(index=>point(bars,index,index===left||index===right?bars[index].high:index===bottom||index===handleLow?bars[index].low:bars[index].close))};
  }
 }
 return null;
}

function researchAnnotations(bars,kind){
 const research=patternResearch(bars),result=[];
 if(research.available)for(const candidate of research.candidates){
  if(!Object.hasOwn(labels,candidate.kind)||kind!=='patterns'&&kind!==candidate.kind)continue;
  const find=date=>bars.findIndex(b=>b.date===date),top=candidate.kind==='headShoulders'||candidate.kind==='doubleTop';
  if(candidate.pivotDates){
   const [a,b,c]=candidate.pivotDates.map(find),[u,v]=candidate.necklineDates.map(find),field=top?'high':'low',neck=top?'low':'high';
   result.push(annotation(bars,candidate.kind,'מועמד ל'+labels[candidate.kind]+' · '+(candidate.stage==='waiting'?'ממתין לחצייה':'חצייה נצפתה'),[[a,bars[a][field]],[u,bars[u][neck]],[b,bars[b][field]],[v,bars[v][neck]],[c,bars[c][field]]]));
   result.push(annotation(bars,'neckline','קו צוואר משוער · '+labels[candidate.kind],[[u,bars[u][neck]],[v,bars[v][neck]]]));
  }else{
   const a=find(top?candidate.firstHighDate:candidate.firstLowDate),b=find(top?candidate.secondHighDate:candidate.secondLowDate),middle=extremaIndex(bars,a+1,b,top?'low':'high'),field=top?'high':'low';
   result.push(annotation(bars,candidate.kind,'מועמד ל'+labels[candidate.kind],[[a,bars[a][field]],[middle,top?bars[middle].low:bars[middle].high],[b,bars[b][field]]]));
  }
 }
 if(kind==='patterns'||kind==='cupHandle'){const cup=cupHandleCandidate(bars);if(cup)result.push({kind:'cupHandle',label:cup.label+' · '+(cup.stage==='waiting'?'ממתין לחצייה':'מעל שפת הספל'),candidate:true,points:cup.points});}
 return result;
}

export function analyzeChartTools({bars:input,kind}={}){
 if(!kinds.has(kind))throw Error('כלי ניתוח הגרף אינו נתמך.');
 const bars=validBars(input),daily=bars.every(b=>b.date.length===10);let annotations=[];
 if(kind==='supportResistance')annotations=supportResistance(bars);
 else if(kind==='trendlines')annotations=trendlines(bars);
 else if(daily)annotations=researchAnnotations(bars,kind);
 annotations=annotations.slice(0,12);
 const summary=annotations.length?'נוספו '+annotations.length+' סימוני מחקר לפי הנרות שנטענו. יש לבחון את הגאומטריה וההקשר; לא מדובר באישור לתבנית או בהמלצת מסחר.':!daily&&!['supportResistance','trendlines'].includes(kind)?'זיהוי התבניות דורש נרות יומיים; לא נוספו סימונים לנתונים תוך־יומיים.':'לא נמצאה גאומטריה שעומדת בכללי הכלי בנתונים שנטענו. לא הומצאו סימונים.';
 return {annotations,summary,limitations:[...limitations]};
}
