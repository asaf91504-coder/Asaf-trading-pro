// A question is the explicit send action. Loading a chart never invokes an LLM.
export function chartAttachment({manual=null,auto=false,hasMatchingData=false,snapshot=()=>null}={}){
 if(manual)return manual;
 if(!auto||!hasMatchingData)return null;
 try{return snapshot()||null}catch{return null}
}
