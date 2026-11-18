// Arrow keys follow the displayed order, including after an interface language change.
// Return null for unrelated keys so ordinary browser shortcuts are not consumed.
export function nextTabIndex(index, count, key, direction='ltr') {
 if (!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count) return null;
 if(key==='Home')return 0;
 if(key==='End')return count-1;
 if(key!=='ArrowRight'&&key!=='ArrowLeft')return null;
 const step=(key==='ArrowRight'?1:-1)*(direction==='rtl'?-1:1);
 return (index+step+count)%count;
}

// Help can live inside another disclosure on compact layouts. Opening only the
// inner details leaves it invisible; reveal the full chain before moving focus.
export function toggleKeyboardHelp(help) {
 if(!help)return;
 help.open=!help.open;
 if(help.open){
  for(let parent=help.parentElement?.closest('details');parent;parent=parent.parentElement?.closest('details'))parent.open=true;
 }
 help.querySelector('summary')?.focus();
 if(help.open)help.scrollIntoView({block:'nearest',behavior:'instant'});
}
