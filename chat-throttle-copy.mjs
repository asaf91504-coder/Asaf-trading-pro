import {languageCode} from './interface-language.mjs';

// These messages describe the throttle without exposing infrastructure or assuming
// which of the service's shared counters reached its limit.
const codes=['chat_rate_limited','chat_shared_quota_exhausted','provider_rate_limited','provider_credits_exhausted','chat_quota_unavailable'];
const copy={
 he:['יותר מדי בקשות בדקה. נסה שוב בעוד רגע.','מכסת בקשות הצ׳אט המשותפת נוצלה. נסה שוב מאוחר יותר.','שירות ה־AI מגביל כרגע את כמות הבקשות. נסה שוב מאוחר יותר.','יתרת הקרדיטים של שירות ה־AI אינה זמינה. לא בוצעה טעינה או שליחה חוזרת.','לא ניתן לבדוק את מכסת השימוש כרגע. הבקשה לא נשלחה למודל.'],
 en:['Too many requests in one minute. Try again in a moment.','The shared chat request limit has been reached. Try again later.','The AI service is limiting requests. Try again later.','The AI service has no credits available. No top-up or retry was made.','The usage limit could not be checked. The request was not sent to the model.'],
 es:['Demasiadas solicitudes en un minuto. Inténtalo de nuevo en un momento.','Se alcanzó el límite compartido de solicitudes del chat. Inténtalo más tarde.','El servicio de IA está limitando las solicitudes. Inténtalo más tarde.','El servicio de IA no tiene créditos disponibles. No se recargó el saldo ni se reintentó la solicitud.','No se pudo comprobar el límite de uso. La solicitud no se envió al modelo.'],
 ar:['طلبات كثيرة خلال دقيقة واحدة. حاول مجددًا بعد لحظات.','تم بلوغ الحد المشترك لطلبات الدردشة. حاول مرة أخرى لاحقًا.','تحدّ خدمة الذكاء الاصطناعي حاليًا من عدد الطلبات. حاول لاحقًا.','لا يتوفر رصيد لدى خدمة الذكاء الاصطناعي. لم يُضف رصيد ولم يُعد إرسال الطلب.','تَعذَّر التحقق من حدّ الاستخدام. لم يُرسل الطلب إلى النموذج.'],
 fr:['Trop de demandes en une minute. Réessayez dans un instant.','La limite de requêtes partagée du chat est atteinte. Réessayez plus tard.','Le service d’IA limite actuellement les requêtes. Réessayez plus tard.','Le service d’IA n’a plus de crédits disponibles. Aucun rechargement ni nouvel essai n’a été effectué.','Impossible de vérifier la limite d’utilisation. La requête n’a pas été envoyée au modèle.'],
 de:['Zu viele Anfragen in einer Minute. Versuche es in Kürze erneut.','Das gemeinsame Anfragelimit des Chats wurde erreicht. Versuche es später erneut.','Der KI-Dienst begrenzt gerade die Anzahl der Anfragen. Versuche es später erneut.','Beim KI-Dienst sind keine Guthabenpunkte verfügbar. Es wurde nichts aufgeladen und keine erneute Anfrage gesendet.','Das Nutzungslimit konnte nicht geprüft werden. Die Anfrage wurde nicht an das Modell gesendet.'],
 pt:['Muitas solicitações em um minuto. Tente novamente em instantes.','O limite compartilhado de solicitações do chat foi atingido. Tente novamente mais tarde.','O serviço de IA está limitando as solicitações. Tente novamente mais tarde.','O serviço de IA não tem créditos disponíveis. Não houve recarga nem nova tentativa.','Não foi possível verificar o limite de uso. A solicitação não foi enviada ao modelo.'],
 ru:['Слишком много запросов за минуту. Повторите попытку чуть позже.','Достигнут общий лимит запросов чата. Повторите попытку позже.','Сервис ИИ ограничил число запросов. Повторите попытку позже.','У сервиса ИИ нет доступных кредитов. Баланс не пополнялся, запрос не отправлялся повторно.','Не удалось проверить лимит использования. Запрос не был отправлен модели.'],
 zh:['一分钟内的请求过多。请稍后重试。','聊天的共享请求额度已用完。请稍后重试。','AI 服务正在限制请求数量。请稍后重试。','AI 服务的额度不可用。系统未充值，也未重试。','暂时无法检查使用额度。请求未发送给模型。'],
 ja:['1分間のリクエストが多すぎます。少し待ってからお試しください。','チャットの共有リクエスト上限に達しました。時間をおいてお試しください。','AIサービスがリクエスト数を制限しています。時間をおいてお試しください。','AIサービスで利用できるクレジットがありません。追加購入や再送信は行っていません。','利用上限を確認できませんでした。リクエストはモデルに送信されていません。'],
};

const additionalCodes=['chat_market_rate_limited','chat_web_search_quota_exhausted','chat_throttle_unknown'];
const additionalCopy={
 he:['נתוני השוק אינם זמינים כרגע בגלל הגבלת בקשות. נסה שוב בעוד רגע.','מכסת החיפוש החודשית נוצלה. אפשר להמשיך בצ׳אט בלי חיפוש.','הבקשה הוגבלה זמנית. נסה שוב מאוחר יותר.'],
 en:['Market data is temporarily rate-limited. Try again in a moment.','The monthly web search limit has been reached. You can continue chatting without web search.','The request was temporarily limited. Try again later.'],
 es:['Los datos de mercado tienen un límite temporal de solicitudes. Inténtalo de nuevo en un momento.','Se alcanzó el límite mensual de búsquedas web. Puedes seguir en el chat sin buscar en la web.','La solicitud se limitó temporalmente. Inténtalo más tarde.'],
 ar:['بيانات السوق خاضعة مؤقتًا لحدّ الطلبات. حاول مجددًا بعد لحظات.','تم بلوغ الحد الشهري للبحث على الويب. يمكنك مواصلة الدردشة دون بحث.','تم تقييد الطلب مؤقتًا. حاول مرة أخرى لاحقًا.'],
 fr:['Les requêtes de données de marché sont temporairement limitées. Réessayez dans un instant.','La limite mensuelle de recherche web est atteinte. Vous pouvez poursuivre la discussion sans recherche web.','La requête a été temporairement limitée. Réessayez plus tard.'],
 de:['Marktdatenanfragen sind vorübergehend begrenzt. Versuche es in Kürze erneut.','Das monatliche Limit für Websuchen ist erreicht. Du kannst ohne Websuche weiterchatten.','Die Anfrage wurde vorübergehend begrenzt. Versuche es später erneut.'],
 pt:['As solicitações de dados de mercado estão temporariamente limitadas. Tente novamente em instantes.','O limite mensal de buscas na web foi atingido. Você pode continuar no chat sem usar a busca.','A solicitação foi temporariamente limitada. Tente novamente mais tarde.'],
 ru:['Запросы рыночных данных временно ограничены. Повторите попытку чуть позже.','Достигнут месячный лимит поиска в интернете. Можно продолжить чат без поиска.','Запрос временно ограничен. Повторите попытку позже.'],
 zh:['市场数据请求暂时受到限制。请稍后重试。','已达到每月网页搜索上限。你可以关闭搜索并继续聊天。','请求暂时受到限制。请稍后重试。'],
 ja:['市場データのリクエストは一時的に制限されています。少し待ってからお試しください。','ウェブ検索の月間上限に達しました。ウェブ検索なしでチャットを続けられます。','リクエストは一時的に制限されています。時間をおいてお試しください。'],
};

const ownerCopy={
 he:['יותר מדי בקשות ברצף. נסה שוב בעוד כמה שניות.','לא ניתן לבדוק את קצב הבקשות. הבקשה לא נשלחה למודל.'],
 en:['Too many requests in quick succession. Try again in a few seconds.','The request rate could not be checked. The request was not sent to the model.'],
 es:['Demasiadas solicitudes seguidas. Inténtalo en unos segundos.','No se pudo comprobar la frecuencia de las solicitudes. La solicitud no se envió al modelo.'],
 ar:['طلبات كثيرة متتالية. حاول مجددًا بعد بضع ثوانٍ.','تعذّر التحقق من معدل الطلبات. لم يُرسل الطلب إلى النموذج.'],
 fr:['Trop de requêtes à la suite. Réessayez dans quelques secondes.','La fréquence des requêtes n’a pas pu être vérifiée. La requête n’a pas été envoyée au modèle.'],
 de:['Zu viele Anfragen kurz hintereinander. Versuche es in ein paar Sekunden erneut.','Die Anfragerate konnte nicht geprüft werden. Die Anfrage wurde nicht an das Modell gesendet.'],
 pt:['Muitas solicitações em sequência. Tente novamente em alguns segundos.','Não foi possível verificar a frequência das solicitações. A solicitação não foi enviada ao modelo.'],
 ru:['Слишком много запросов подряд. Повторите попытку через несколько секунд.','Не удалось проверить частоту запросов. Запрос не был отправлен модели.'],
 zh:['短时间内请求过多。请在几秒后重试。','暂时无法检查请求频率。请求未发送给模型。'],
 ja:['短時間にリクエストが集中しています。数秒待ってからお試しください。','リクエスト頻度を確認できませんでした。リクエストはモデルに送信されていません。'],
};
const availabilityCodes=['chat_quota_unavailable','owner_chat_burst_unavailable'];

export function chatThrottleCopy(code,language){
 const locale=languageCode(language),additional=additionalCodes.indexOf(code);
 if(code==='owner_chat_burst_limited')return ownerCopy[locale][0];
 if(code==='owner_chat_burst_unavailable')return ownerCopy[locale][1];
 if(additional>=0)return additionalCopy[locale][additional];
 const index=codes.indexOf(code);
 return index<0?null:copy[locale][index];
}

export function chatThrottleDisplay(status,code,language){
 if(status===429)return (!availabilityCodes.includes(code)&&chatThrottleCopy(code,language))||chatThrottleCopy('chat_throttle_unknown',language);
 return status===503&&availabilityCodes.includes(code)?chatThrottleCopy(code,language):null;
}
