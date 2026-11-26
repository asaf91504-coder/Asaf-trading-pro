import {validTranslationJob,translationJobKey,newsTranslationSecret} from '../../server/news-translation-job.mjs';
import {readPublicNews} from '../../server/public-news-service.mjs';
import {translateNews} from '../../server/news-language.mjs';
import {command} from '../../server/storage.mjs';
export default async function handler(request){
 if(request.method!=='POST')return;
 const body=await request.text();if(body.length>1000||!validTranslationJob(body,request.headers.get('X-ASAF-Job-Signature'),newsTranslationSecret()))return;
 const {language}=JSON.parse(body),key=translationJobKey(language);
 let failure='unavailable';
 try{const snapshot=await readPublicNews();for(let i=0;i<7;i++){
  const result=await translateNews(snapshot.articles,language,{timeoutMs:90000});
  if(result.translation==='translated'){await command(['DEL',key]);return}
  if(result.translationReason||!['partial','pending'].includes(result.translation)){failure=result.translationReason||'unavailable';console.warn('News translation failed',JSON.stringify({reason:failure,detail:result.translationDetail||null}));break;}
  if(result.translation==='pending')break;
 }}catch{}
 await command(['SET',key,'failed:'+failure,'EX','90']);
}
