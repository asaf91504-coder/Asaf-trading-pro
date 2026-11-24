import {chatPresentationCopy} from './chat-presentation-copy.mjs';
import {methodologyTranslations} from './methodology-translations.mjs';
import {qaI18nTranslations} from "./qa-i18n-translations.mjs";
import {accessibilityStatementTranslations} from './accessibility-statement-translations.mjs';
import {catalogAuditTranslations} from './catalog-audit-translations.mjs';
import {remainingTranslations} from './remaining-translations.mjs';
import {extraTranslations} from './extra-translations.mjs';
import {scannerTranslations} from './scanner-translations.mjs';
import {polishTranslations} from './launch-polish-translations.mjs';
import {setupReviewTranslations} from './setup-review-locales.mjs';
import {subscriptionTranslations} from './subscription-translations.mjs';
const source=[
'טיוטה ליומן המסחר',
'בדוק את פרטי העסקה לפני השמירה. מחיר יציאה ריק פירושו עסקה פתוחה. אין ביצוע מסחר.',
'שמור ביומן ובחשבון','שמור ביומן במכשיר','העסקה נשמרה ביומן ובחשבון.','העסקה נשמרה ביומן במכשיר בלבד.',
'פתח יומן מסחר','עסקה פתוחה','הוסף עסקה',
'הביצועים מחושבים מעסקאות סגורות בלבד. מחיר יציאה ריק מסמן עסקה פתוחה.',
'נסה לשמור שוב בחשבון','העותק נשמר במכשיר. ',
'חיפוש באינטרנט עדיין אינו פעיל','חיפוש באינטרנט פעיל',
'החשבון השתנה או שלא ניתן לאמת כניסה. שלח את הבקשה מחדש.'
];
const rows={
en:['Trading journal draft','Check the trade details before saving. Leave exit price empty for an open trade. No trades are executed.','Save to journal and account','Save journal on this device','Trade saved to your journal and account.','Trade saved to the journal on this device only.','Open trading journal','Open trade','Add trade','Performance includes closed trades only. An empty exit price marks an open trade.','Retry account save','Copy saved on this device. ','Web search is not active yet','Web search is active','The account changed or sign-in could not be verified. Send the request again.'],
es:['Borrador del diario de operaciones','Revisa los datos antes de guardar. Deja vacío el precio de salida para una operación abierta. No se ejecutan operaciones.','Guardar en diario y cuenta','Guardar diario en este dispositivo','Operación guardada en el diario y la cuenta.','Operación guardada solo en este dispositivo.','Abrir diario de operaciones','Operación abierta','Añadir operación','El rendimiento solo incluye operaciones cerradas. Un precio de salida vacío indica una operación abierta.','Reintentar guardado en cuenta','Copia guardada en este dispositivo. ','La búsqueda web aún no está activa','La búsqueda web está activa','La cuenta cambió o no se pudo verificar la sesión. Envía la solicitud de nuevo.'],
fr:['Brouillon du journal de trading','Vérifiez les détails avant de sauvegarder. Laissez le prix de sortie vide pour une position ouverte. Aucun ordre ne sera exécuté.','Enregistrer dans le journal et le compte','Enregistrer sur cet appareil','Opération enregistrée dans le journal et le compte.','Opération enregistrée uniquement sur cet appareil.','Ouvrir le journal de trading','Position ouverte','Ajouter une opération','Les performances incluent uniquement les positions clôturées. Un prix de sortie vide indique une position ouverte.','Réessayer la sauvegarde du compte','Copie enregistrée sur cet appareil. ','La recherche web est encore inactive','La recherche web est active','Le compte a changé ou la connexion ne peut être vérifiée. Renvoyez la demande.'],
de:['Entwurf für das Trading-Journal','Prüfe die Angaben vor dem Speichern. Ein leerer Ausstiegspreis kennzeichnet eine offene Position. Es werden keine Orders ausgeführt.','Im Journal und Konto speichern','Auf diesem Gerät speichern','Trade im Journal und Konto gespeichert.','Trade nur auf diesem Gerät gespeichert.','Trading-Journal öffnen','Offene Position','Trade hinzufügen','Die Auswertung umfasst nur geschlossene Positionen. Ein leerer Ausstiegspreis kennzeichnet eine offene Position.','Kontospeicherung erneut versuchen','Kopie auf diesem Gerät gespeichert. ','Die Websuche ist noch nicht aktiv','Die Websuche ist aktiv','Das Konto wurde gewechselt oder die Anmeldung konnte nicht geprüft werden. Sende die Anfrage erneut.'],
pt:['Rascunho do diário de operações','Confira os dados antes de salvar. Deixe o preço de saída vazio para uma operação aberta. Nenhuma ordem será executada.','Salvar no diário e na conta','Salvar neste dispositivo','Operação salva no diário e na conta.','Operação salva apenas neste dispositivo.','Abrir diário de operações','Operação aberta','Adicionar operação','O desempenho inclui apenas operações encerradas. Preço de saída vazio indica operação aberta.','Tentar salvar na conta novamente','Cópia salva neste dispositivo. ','A pesquisa na web ainda não está ativa','A pesquisa na web está ativa','A conta mudou ou não foi possível verificar o acesso. Envie a solicitação novamente.'],
ru:['Черновик торгового журнала','Проверьте данные перед сохранением. Оставьте цену выхода пустой для открытой сделки. Торговые заявки не исполняются.','Сохранить в журнал и аккаунт','Сохранить на этом устройстве','Сделка сохранена в журнале и аккаунте.','Сделка сохранена только на этом устройстве.','Открыть торговый журнал','Открытая сделка','Добавить сделку','Статистика учитывает только закрытые сделки. Пустая цена выхода означает открытую сделку.','Повторить сохранение в аккаунт','Копия сохранена на этом устройстве. ','Веб-поиск пока не активен','Веб-поиск активен','Аккаунт изменился или не удалось проверить вход. Отправьте запрос снова.'],
ar:['مسودة سجل التداول','راجع تفاصيل الصفقة قبل الحفظ. اترك سعر الخروج فارغًا للصفقة المفتوحة. لا يتم تنفيذ أي تداول.','حفظ في السجل والحساب','حفظ على هذا الجهاز','تم حفظ الصفقة في السجل والحساب.','تم حفظ الصفقة على هذا الجهاز فقط.','فتح سجل التداول','صفقة مفتوحة','إضافة صفقة','يشمل الأداء الصفقات المغلقة فقط. سعر خروج فارغ يعني صفقة مفتوحة.','إعادة محاولة الحفظ في الحساب','تم حفظ نسخة على هذا الجهاز. ','البحث على الإنترنت غير مفعّل بعد','البحث على الإنترنت مفعّل','تغيّر الحساب أو تعذّر التحقق من الدخول. أرسل الطلب مجددًا.'],
zh:['交易日志草稿','保存前请核对交易信息。未平仓交易请留空退出价格。此操作不会执行交易。','保存到日志和账户','保存到此设备','交易已保存到日志和账户。','交易仅保存到此设备。','打开交易日志','未平仓交易','添加交易','绩效仅统计已平仓交易。退出价格为空表示尚未平仓。','重试保存到账户','副本已保存到此设备。','网络搜索尚未启用','网络搜索已启用','账户已更改或无法验证登录。请重新发送请求。'],
ja:['取引日誌の下書き','保存前に取引内容を確認してください。未決済の取引は決済価格を空欄にします。注文は実行されません。','日誌とアカウントに保存','この端末に保存','日誌とアカウントに取引を保存しました。','この端末にのみ取引を保存しました。','取引日誌を開く','未決済の取引','取引を追加','成績は決済済みの取引のみで計算します。決済価格が空欄の場合は未決済です。','アカウントへの保存を再試行','この端末に保存しました。','ウェブ検索はまだ有効ではありません','ウェブ検索は有効です','アカウントが変更されたか、ログインを確認できませんでした。もう一度送信してください。']
};
export const launchTranslations=Object.fromEntries(Object.entries(rows).map(([code,values])=>[code,{...Object.fromEntries(source.map((key,i)=>[key,values[i]])),...subscriptionTranslations[code],...polishTranslations[code],...catalogAuditTranslations[code],...scannerTranslations[code],...extraTranslations[code],...remainingTranslations[code],...accessibilityStatementTranslations[code],...qaI18nTranslations[code],...setupReviewTranslations[code]}]));
// Configuration is distinct from the authenticated chart's source and entitlement.
const marketConfigurationLabels={en:'Data provider configured · Load a chart to verify',es:'Proveedor de datos configurado · Carga un gráfico para verificar',ar:'تم إعداد مزود البيانات · حمّل رسمًا بيانيًا للتحقق',fr:'Fournisseur de données configuré · Chargez un graphique pour vérifier',de:'Datenanbieter eingerichtet · Zur Prüfung einen Chart laden',pt:'Provedor de dados configurado · Carregue um gráfico para verificar',ru:'Поставщик данных настроен · Загрузите график для проверки',zh:'数据提供商已配置 · 请加载图表进行验证',ja:'データプロバイダー設定済み · チャートを読み込んで確認'};
for(const [code,label] of Object.entries(marketConfigurationLabels))launchTranslations[code]['ספק נתונים מוגדר · טען גרף לאימות']=label;

// A depleted trial reports its actual entitlement, including grandfathered grants.
const trialExhaustedKey='{limit} הקרדיטים החינמיים נוצלו. הם אינם מתחדשים. אפשר לשדרג למנוי.';
const trialExhaustedCopy={
 en:'You have used all {limit} free credits. They do not renew. You can upgrade to a subscription.',
 es:'Has usado los {limit} créditos gratuitos. No se renuevan. Puedes contratar una suscripción.',
 ar:'استخدمت كامل رصيدك المجاني البالغ {limit}. لا يتجدد هذا الرصيد. يمكنك الترقية إلى اشتراك.',
 fr:'Vous avez utilisé vos {limit} crédits gratuits. Ils ne se renouvellent pas. Vous pouvez passer à un abonnement.',
 de:'Du hast alle {limit} kostenlosen Credits verbraucht. Sie werden nicht erneuert. Du kannst ein Abo abschließen.',
 pt:'Você usou todos os {limit} créditos gratuitos. Eles não são renovados. Você pode assinar um plano.',
 ru:'Вы использовали все {limit} бесплатных кредитов. Они не обновляются. Можно оформить подписку.',
 zh:'{limit} 个免费积分已全部用完，不会补充。你可以升级为付费订阅。',
 ja:'無料クレジット{limit}分を使い切りました。補充はされません。有料プランに変更できます。'
};
for(const [code,label] of Object.entries(trialExhaustedCopy))launchTranslations[code][trialExhaustedKey]=label;

const marketTermsKey="אין להשתמש בכלים אוטומטיים כדי לגרד או לאסוף נתוני שוק או תוצאות סריקה מהשירות. אין לשתף או להפיץ הלאה נתוני שוק או תוצאות סריקה שמקורן בספקי נתונים, גם אם התוצאות נגזרות, ללא הרשאה מתאימה.";
const marketTermsCopy={
 "en": "Do not scrape or automatically collect market data or screener results from the service. Do not share or redistribute third-party market data or screener results derived from that data without the applicable permission.",
 "es": "No extraigas ni recopiles automáticamente datos de mercado ni resultados del escáner del servicio. No compartas ni redistribuyas datos de mercado de terceros ni resultados del escáner derivados de esos datos sin la autorización correspondiente.",
 "ar": "يُمنع استخراج بيانات السوق أو نتائج أداة الفرز من الخدمة أو جمعها آليًا. ويُمنع مشاركة بيانات السوق الخاصة بجهات خارجية أو نتائج الفرز المشتقة منها أو إعادة توزيعها من دون الإذن اللازم.",
 "fr": "Il est interdit d’extraire ou de collecter automatiquement des données de marché ou des résultats du filtre depuis le service. Ne partagez ni ne redistribuez les données de marché tierces ou les résultats de filtrage qui en découlent sans l’autorisation requise.",
 "de": "Marktdaten und Screener-Ergebnisse dürfen nicht aus dem Dienst ausgelesen oder automatisiert erfasst werden. Marktdaten Dritter und daraus abgeleitete Screener-Ergebnisse dürfen ohne entsprechende Genehmigung nicht weitergegeben oder weiterverbreitet werden.",
 "pt": "Não extraia nem colete automaticamente dados de mercado ou resultados do filtro a partir do serviço. Não compartilhe nem redistribua dados de mercado de terceiros ou resultados de filtros derivados desses dados sem a devida autorização.",
 "ru": "Запрещено извлекать или автоматически собирать рыночные данные и результаты скринера из сервиса. Не передавайте и не распространяйте рыночные данные сторонних поставщиков и полученные на их основе результаты скринера без соответствующего разрешения.",
 "zh": "请勿抓取或自动收集本服务中的市场数据或筛选结果。未经相应许可，不得分享或再分发第三方市场数据或基于该数据得出的筛选结果。",
 "ja": "本サービスから市場データやスクリーナーの結果をスクレイピングしたり、自動収集したりしないでください。適切な許可なく、第三者の市場データやそのデータから得たスクリーナーの結果を共有または再配布しないでください。"
};
for(const [code,label] of Object.entries(marketTermsCopy))launchTranslations[code][marketTermsKey]=label;

for(const [code,copy] of Object.entries(methodologyTranslations))Object.assign(launchTranslations[code],copy);

for(const [code,copy] of Object.entries(chatPresentationCopy))if(code!=="he")for(const key of ["drawn","noScenario"])launchTranslations[code][chatPresentationCopy.he[key]]=copy[key];
