// Complete messages keep new chat routing states out of fragment substitution.
const source=[
 'טוען נתונים של {symbol} לשאלה הנוכחית…',
 'לא התקבלו נתונים למניה שהתבקשה; לא ייעשה שימוש בנתוני המניה הקודמת.',
 'המניה בשאלה שונה מנתוני הגרף המצורפים. טען את המניה שהתבקשה ונסה שוב.',
 'תוצאות הסורק אינן זמינות כרגע. נסה שוב לאחר העדכון הבא.',
 'ניתוח הסורק אינו פעיל לחשבון זה.',
 'יש לבחור כיוון לונג או שורט.',
 'הבקשה מתייחסת ליותר מנכס אחד. ציין נכס אחד לניתוח או בקש השוואה מפורשת.'
];
const messages={
 en:[
  'Loading data for {symbol} for your current question…',
  'Data for the requested stock could not be loaded; data from the previous stock will not be used.',
  'The stock in your question differs from the attached chart data. Load the requested stock and try again.',
  'Screener results are currently unavailable. Try again after the next update.',
  'Screener analysis is not enabled for this account.',
  'Choose a long or short direction.',
  'The request refers to more than one asset. Specify one asset to analyze or explicitly request a comparison.'
 ],
 es:[
  'Cargando los datos de {symbol} para tu pregunta actual…',
  'No se pudieron cargar los datos de la acción solicitada; no se usarán los de la acción anterior.',
  'La acción de tu pregunta no coincide con los datos del gráfico adjunto. Carga la acción solicitada e inténtalo de nuevo.',
  'Los resultados del escáner no están disponibles en este momento. Inténtalo de nuevo después de la próxima actualización.',
  'El análisis del escáner no está habilitado para esta cuenta.',
  'Elige una posición larga o corta.',
  'La solicitud se refiere a más de un activo. Indica un activo para analizar o solicita expresamente una comparación.'
 ],
 ar:[
  'جارٍ تحميل بيانات {symbol} لسؤالك الحالي…',
  'تعذّر تحميل بيانات السهم المطلوب؛ لن تُستخدم بيانات السهم السابق.',
  'السهم المذكور في سؤالك لا يطابق بيانات الرسم البياني المرفق. حمّل السهم المطلوب وحاول مجددًا.',
  'نتائج أداة الفرز غير متاحة حاليًا. حاول مجددًا بعد التحديث القادم.',
  'تحليل أداة الفرز غير مفعّل لهذا الحساب.',
  'اختر اتجاه شراء أو بيع على المكشوف.',
  'يشير الطلب إلى أكثر من أصل واحد. حدّد أصلًا واحدًا للتحليل أو اطلب مقارنة بشكل صريح.'
 ],
 fr:[
  'Chargement des données de {symbol} pour votre question actuelle…',
  'Les données de l’action demandée n’ont pas pu être chargées ; celles de l’action précédente ne seront pas utilisées.',
  'L’action mentionnée dans votre question ne correspond pas aux données du graphique joint. Chargez l’action demandée et réessayez.',
  'Les résultats du filtre sont actuellement indisponibles. Réessayez après la prochaine mise à jour.',
  'L’analyse du filtre n’est pas activée pour ce compte.',
  'Choisissez une position longue ou courte.',
  'La demande concerne plusieurs actifs. Précisez un seul actif à analyser ou demandez explicitement une comparaison.'
 ],
 de:[
  'Daten für {symbol} werden für deine aktuelle Frage geladen…',
  'Die Daten der angefragten Aktie konnten nicht geladen werden; Daten der vorherigen Aktie werden nicht verwendet.',
  'Die Aktie in deiner Frage stimmt nicht mit den angehängten Chartdaten überein. Lade die angefragte Aktie und versuche es erneut.',
  'Die Screener-Ergebnisse sind derzeit nicht verfügbar. Versuche es nach der nächsten Aktualisierung erneut.',
  'Die Screener-Analyse ist für dieses Konto nicht aktiviert.',
  'Wähle eine Long- oder Short-Richtung.',
  'Die Anfrage bezieht sich auf mehrere Vermögenswerte. Nenne einen einzelnen Wert zur Analyse oder bitte ausdrücklich um einen Vergleich.'
 ],
 pt:[
  'Carregando os dados de {symbol} para sua pergunta atual…',
  'Não foi possível carregar os dados da ação solicitada; os dados da ação anterior não serão usados.',
  'A ação mencionada na pergunta não corresponde aos dados do gráfico anexado. Carregue a ação solicitada e tente novamente.',
  'Os resultados do filtro estão indisponíveis no momento. Tente novamente após a próxima atualização.',
  'A análise do filtro não está ativada para esta conta.',
  'Escolha uma posição comprada ou vendida.',
  'A solicitação se refere a mais de um ativo. Indique um único ativo para análise ou peça explicitamente uma comparação.'
 ],
 ru:[
  'Загружаются данные {symbol} для вашего текущего вопроса…',
  'Не удалось загрузить данные запрошенной акции; данные предыдущей акции использоваться не будут.',
  'Акция в вашем вопросе не соответствует данным прикреплённого графика. Загрузите нужную акцию и повторите попытку.',
  'Результаты скринера сейчас недоступны. Повторите попытку после следующего обновления.',
  'Анализ скринера не включён для этой учётной записи.',
  'Выберите длинную или короткую позицию.',
  'Запрос относится к нескольким активам. Укажите один актив для анализа или явно запросите сравнение.'
 ],
 zh:[
  '正在加载 {symbol} 的数据，以回答你当前的问题…',
  '未能加载所请求股票的数据；不会使用上一只股票的数据。',
  '问题中提到的股票与所附图表数据不一致。请加载所请求的股票后重试。',
  '目前无法获取筛选结果。请在下次更新后重试。',
  '此账户尚未启用筛选分析。',
  '请选择做多或做空方向。',
  '请求涉及多个资产。请指定一个待分析资产，或明确要求进行比较。'
 ],
 ja:[
  '現在の質問に答えるため、{symbol} のデータを読み込んでいます…',
  '指定された銘柄のデータを読み込めませんでした。前の銘柄のデータは使用しません。',
  '質問の銘柄と添付チャートのデータが一致しません。指定された銘柄を読み込み、もう一度お試しください。',
  '現在、スクリーナーの結果を取得できません。次回の更新後にもう一度お試しください。',
  'このアカウントではスクリーナー分析が有効になっていません。',
  'ロングまたはショートの方向を選んでください。',
  'リクエストに複数の資産が含まれています。分析する資産を1つ指定するか、比較を明示的に依頼してください。'
 ]
};
const unsupportedFilterKey='הבקשה כוללת מסננים שעדיין אינם נתמכים בצ׳אט. אפשר להגדיר אותם בסורק המניות.';
const unsupportedFilters={
 en:'The request includes filters that are not yet supported in chat. You can configure them in the stock screener.',
 es:'La solicitud incluye filtros que aún no se admiten en el chat. Puedes configurarlos en el escáner de acciones.',
 ar:'يتضمن الطلب عوامل تصفية غير مدعومة في الدردشة بعد. يمكنك إعدادها في أداة فرز الأسهم.',
 fr:'La demande comprend des filtres qui ne sont pas encore pris en charge dans le chat. Vous pouvez les configurer dans le filtre d’actions.',
 de:'Die Anfrage enthält Filter, die im Chat noch nicht unterstützt werden. Du kannst sie im Aktien-Screener einstellen.',
 pt:'A solicitação inclui filtros que ainda não são compatíveis com o chat. Você pode configurá-los no filtro de ações.',
 ru:'Запрос содержит фильтры, которые пока не поддерживаются в чате. Их можно настроить в скринере акций.',
 zh:'请求包含聊天中尚不支持的筛选条件。你可以在股票筛选器中设置这些条件。',
 ja:'リクエストには、チャットでまだ対応していないフィルターが含まれています。株式スクリーナーで設定できます。'
};
source.push(unsupportedFilterKey);
for(const [code,copy] of Object.entries(unsupportedFilters))messages[code].push(copy);
// Exact source variants also translate when the UI prepends a warning icon.
const providerApprovalCopy={
 en:'Provider approval is pending for analysis of {source} data in OpenAI. You can ask a question without chart data.',
 es:'El análisis de datos de {source} en OpenAI está pendiente de la autorización del proveedor. Puedes hacer una pregunta sin datos del gráfico.',
 ar:'تحليل بيانات {source} في OpenAI بانتظار موافقة مزود البيانات. يمكنك طرح سؤال من دون بيانات الرسم البياني.',
 fr:'L’analyse des données de {source} dans OpenAI attend l’autorisation du fournisseur. Vous pouvez poser une question sans données de graphique.',
 de:'Die Analyse von {source}-Daten in OpenAI wartet auf die Freigabe des Anbieters. Du kannst eine Frage ohne Chartdaten stellen.',
 pt:'A análise dos dados de {source} no OpenAI aguarda a aprovação do provedor. Você pode fazer uma pergunta sem dados do gráfico.',
 ru:'Для анализа данных {source} в OpenAI ожидается разрешение поставщика. Вы можете задать вопрос без данных графика.',
 zh:'通过 OpenAI 分析 {source} 数据尚待数据提供商批准。你可以提出不附带图表数据的问题。',
 ja:'OpenAI による {source} データの分析は、データ提供元の承認待ちです。チャートデータなしで質問できます。'
};
for(const provider of ['CoinLore','Twelve Data','Intrinio']){
 source.push('ניתוח נתוני '+provider+' ב-OpenAI ממתין לאישור הספק. אפשר לשלוח שאלה ללא נתוני גרף.');
 for(const [code,copy] of Object.entries(providerApprovalCopy))messages[code].push(copy.replace('{source}',provider));
}
export const chatRoutingTranslations=Object.fromEntries(Object.entries(messages).map(([code,values])=>[code,Object.fromEntries(source.map((key,i)=>[key,values[i]]))]));
