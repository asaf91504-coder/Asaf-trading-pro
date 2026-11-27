import {languageCode} from './interface-language.mjs';
const messages={
 he:['טוען סטאפים…','טעינת הסטאפים ארכה יותר מדי זמן. אפשר ללחוץ על ״רענן תוצאות״ ולנסות שוב.','לא ניתן להתחבר כרגע. בדוק את החיבור ונסה לרענן.','התקבלה תשובה לא תקינה מהשרת. אפשר לנסות לרענן.','לא התקבל אישור בזמן. רענן כדי לבדוק את מצב הפעולה לפני שליחה נוספת.','הרענון לא הושלם. מוצגות תוצאות קודמות שעדיין בתוקף.','תור האישור נטען חלקית; הסטאפים המאושרים מוצגים בנפרד.'],
 en:['Loading setups…','Loading took too long. Select Refresh results to try again.','Cannot connect right now. Check your connection and refresh.','The server returned an invalid response. Try refreshing.','No confirmation arrived in time. Refresh to check the action before submitting again.','Refresh did not finish. Previously loaded, unexpired results are shown.','The review queue is partly loaded; approved setups are shown separately.'],
 es:['Cargando setups…','La carga tardó demasiado. Pulsa Actualizar resultados para reintentar.','No se puede conectar. Revisa la conexión y actualiza.','Respuesta del servidor no válida. Prueba a actualizar.','No llegó confirmación a tiempo. Actualiza para comprobar la acción antes de reenviarla.','La actualización no terminó. Se muestran resultados anteriores aún vigentes.','La cola de revisión está parcialmente cargada; los setups aprobados se muestran aparte.'],
 ar:['جارٍ تحميل الإعدادات…','استغرق التحميل وقتًا طويلًا. حدّث النتائج للمحاولة مجددًا.','تعذر الاتصال حاليًا. تحقق من الاتصال وحدّث الصفحة.','استجابة الخادم غير صالحة. حاول التحديث.','لم يصل التأكيد في الوقت المحدد. حدّث للتحقق من العملية قبل إرسالها مجددًا.','لم يكتمل التحديث. تُعرض نتائج سابقة لم تنته صلاحيتها.','تم تحميل جزء من قائمة المراجعة؛ تُعرض الإعدادات المعتمدة منفصلة.'],
 fr:['Chargement des configurations…','Le chargement a pris trop de temps. Actualisez les résultats pour réessayer.','Connexion impossible. Vérifiez votre connexion puis actualisez.','Réponse du serveur invalide. Essayez d’actualiser.','Confirmation non reçue à temps. Actualisez pour vérifier l’action avant de la renvoyer.','Actualisation inachevée. Les résultats précédents encore valides sont affichés.','La file de validation est partiellement chargée ; les configurations approuvées sont affichées séparément.'],
 de:['Setups werden geladen…','Das Laden dauerte zu lange. Aktualisieren Sie die Ergebnisse.','Verbindung nicht möglich. Prüfen Sie die Verbindung und aktualisieren Sie.','Ungültige Serverantwort. Bitte aktualisieren.','Keine rechtzeitige Bestätigung. Vor erneutem Senden aktualisieren und die Aktion prüfen.','Aktualisierung unvollständig. Frühere, noch gültige Ergebnisse werden angezeigt.','Die Prüfliste ist teilweise geladen; freigegebene Setups werden separat angezeigt.'],
 pt:['Carregando setups…','O carregamento demorou demais. Atualize os resultados para tentar novamente.','Não foi possível conectar. Verifique a conexão e atualize.','Resposta inválida do servidor. Tente atualizar.','A confirmação não chegou a tempo. Atualize para verificar a ação antes de reenviar.','A atualização não terminou. Resultados anteriores ainda válidos são exibidos.','A fila de revisão foi parcialmente carregada; setups aprovados são exibidos separadamente.'],
 ru:['Загрузка сетапов…','Загрузка заняла слишком много времени. Обновите результаты.','Не удаётся подключиться. Проверьте соединение и обновите страницу.','Некорректный ответ сервера. Попробуйте обновить страницу.','Подтверждение не пришло вовремя. Обновите страницу и проверьте действие перед повторной отправкой.','Обновление не завершено. Показаны ранее загруженные результаты с действующим сроком.','Очередь проверки загружена частично; одобренные сетапы показаны отдельно.'],
 zh:['正在加载交易形态…','加载超时。请刷新结果重试。','暂时无法连接。请检查网络后刷新。','服务器响应无效。请尝试刷新。','未及时收到确认。再次提交前请刷新并检查操作状态。','刷新未完成。显示的是此前加载且仍有效的结果。','审核队列仅加载了一部分；已批准的形态单独显示。'],
 ja:['セットアップを読み込み中…','読み込みがタイムアウトしました。結果を更新して再試行してください。','接続できません。通信を確認して更新してください。','サーバー応答が無効です。更新を試してください。','時間内に確認できませんでした。再送信の前に更新して操作状態を確認してください。','更新は完了していません。以前に読み込んだ有効期限内の結果を表示しています。','審査待ちリストの一部を読み込みました。承認済みセットアップは別に表示されます。']
};
const keys=['loading','timeout','network','invalid','uncertain','previous','queue'];
export const setupLoadingMessage=(key,language)=>messages[languageCode(language)][keys.indexOf(key)];
// A local controller works on Safari versions without AbortSignal.timeout().
// Always release the timer, including non-JSON gateway errors and mutations.
export async function requestSetups(fetcher,{body,language='he',timeoutMs=30000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher('/.netlify/functions/setups',{cache:'no-store',signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json()}catch(error){if(controller.signal.aborted||['AbortError','TimeoutError'].includes(error?.name))throw error;throw Error(setupLoadingMessage('invalid',language));}
  if(!response.ok){const error=Error(typeof result?.error==='string'?result.error:setupLoadingMessage('invalid',language));error.status=response.status;throw error;}
  if(!result||typeof result!=='object'||Array.isArray(result)||!body&&(!Array.isArray(result.published)||typeof result.reviewer!=='boolean'))throw Error(setupLoadingMessage('invalid',language));
  return result;
 }catch(error){
  if(controller.signal.aborted||['AbortError','TimeoutError'].includes(error?.name))throw Error(setupLoadingMessage(body?'uncertain':'timeout',language));
  if(error instanceof TypeError)throw Error(setupLoadingMessage('network',language));
  throw error;
 }finally{clearTimeout(timer)}
}
