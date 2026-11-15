import {validTranslationJob} from '../../server/news-translation-job.mjs';
import {readPublicNews} from '../../server/public-news-service.mjs';
import {translateNews} from '../../server/news-language.mjs';
import {command,storageKey} from '../../server/storage.mjs';
export default async function handler(request){
 if(request.method!=='POST')return;
 const body=await request.text();if(body.length>1000||!validTranslationJob(body,request.headers.get('X-ASAF-Job-Signature'),process.env.OPENROUTER_API_KEY))return;
 const {language}=JSON.parse(body),key=storageKey('news:translation:job:'+language);
 let failure='unavailable';
 try{const snapshot=await readPublicNews();for(let i=0;i<7;i++){
  const result=await translateNews(snapshot.articles,language,{timeoutMs:90000});
  if(result.translation==='translated'){await command(['DEL',key]);return}
  if(result.translationReason||!['partial','pending'].includes(result.translation)){failure=result.translationReason||'unavailable';break;}
  if(result.translation==='pending')break;
 }}catch{}
 await command(['SET',key,'failed:'+failure,'EX','90']);
}
