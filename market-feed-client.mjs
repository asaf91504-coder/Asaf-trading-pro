// Provider availability is account-specific during the private Twelve Data trial.
export function createMarketFeedClient({fetcher=fetch,onChange=()=>{}}={}){
 let identity,revision=0,pending;
 const read=async path=>{try{const response=await fetcher(path,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(6000)});return response.ok?await response.json():{enabled:false}}catch{return {enabled:false}}};
 function refresh(account){
  if(identity===account&&pending)return pending;
  identity=account;const current=++revision;
  pending=Promise.all([read('/.netlify/functions/intrinio-research'),read('/.netlify/functions/public-market')]).then(([intrinio,publicMarket])=>{
   const result={intrinio,publicMarket};if(current===revision)onChange(result);return result;
  });return pending;
 }
 async function get(){let request,result;do{request=pending;result=await request}while(request!==pending);return result}
 return {refresh,get};
}
