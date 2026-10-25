// Explicit geometry over confirmed pivots; heuristic candidates, no success probability.
export function shoulderCandidates(bars){
 const result=[],n=bars.length;if(n<30)return result;
 for(const side of ['short','long']){
  const peak=b=>side==='short'?b.high:-b.low,base=b=>side==='short'?b.low:-b.high;
  const pivots=[];for(let i=Math.max(2,n-100);i<n-3;i++)if([i-2,i-1,i+1,i+2].every(j=>peak(bars[i])>peak(bars[j])))pivots.push(i);
  if(pivots.length<3)continue;const [a,b,c]=pivots.slice(-3),pa=peak(bars[a]),pb=peak(bars[b]),pc=peak(bars[c]),shoulder=(Math.abs(pa)+Math.abs(pc))/2;
  if(a<8||b-a<5||c-b<5||c-a>60||n-1-c>20||!shoulder||Math.abs(pa-pc)/shoulder>.03||pb-Math.max(pa,pc)<shoulder*.05)continue;
  if(pa-Math.min(...bars.slice(a-8,a).map(x=>side==='short'?x.close:-x.close))<Math.abs(pa)*.05)continue;
  const trough=(start,end)=>{let index=start;for(let i=start+1;i<end;i++)if(base(bars[i])<base(bars[index]))index=i;return index};
  const u=trough(a+1,b),v=trough(b+1,c),y=i=>side==='short'?bars[i].low:bars[i].high;
  const slope=(y(v)-y(u))/(v-u),line=i=>y(u)+slope*(i-u),trigger=line(n-1),previous=line(n-2),head=side==='short'?bars[b].high:bars[b].low,height=Math.abs(head-line(b));
  if(!(trigger>0&&previous>0&&height>0)||Math.abs(y(u)-y(v))/((y(u)+y(v))/2)>.10)continue;
  if(bars.slice(c+1).some(x=>side==='short'?x.high>bars[b].high:x.low<bars[b].low))continue;
  const crossed=side==='short'?bars.at(-1).close<trigger:bars.at(-1).close>trigger,priorCrossed=side==='short'?bars.at(-2).close<previous:bars.at(-2).close>previous;
  const stage=crossed?(priorCrossed?(side==='short'?'below':'above'):'crossed'):'waiting',target=side==='short'?trigger-height:trigger+height;
  if(target<=0)continue;
  result.push({kind:side==='short'?'headShoulders':'inverseHeadShoulders',stage,side,trigger,target,stopReference:side==='short'?bars[c].high:bars[c].low,pivotDates:[a,b,c].map(i=>bars[i].date),necklineDates:[u,v].map(i=>bars[i].date),slopePerBar:slope,headPrice:head});
 }
 return result;
}
