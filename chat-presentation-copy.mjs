const keys=["target", "details", "tools", "waiting", "crossed", "caveat", "date", "rr", "unknown"];
const rows={
 "he": [
  "יעד מדוד",
  "פרטי החישוב",
  "פעולות שבוצעו בגרף",
  "כניסה מותנית בסגירה ובדיקה חוזרת מעבר לרמה.",
  "הרמה כבר נחצתה; להמתין לבדיקה חוזרת.",
  "תרחיש למחקר; היעד אינו תחזית והסטופ אינו מבטיח מחיר ביצוע.",
  "נר בסיס",
  "יחס סיכוי/סיכון",
  "לא זמין"
 ],
 "en": [
  "Measured target",
  "Calculation details",
  "Chart actions performed",
  "Entry requires a close and retest beyond the level.",
  "Level already crossed; wait for a retest.",
  "Research scenario; target is not a forecast and stop execution price is not guaranteed.",
  "Reference candle",
  "Reward/risk",
  "Unavailable"
 ],
 "es": [
  "Objetivo medido",
  "Detalles del cálculo",
  "Acciones realizadas en el gráfico",
  "La entrada requiere cierre y prueba posterior del nivel.",
  "Nivel ya cruzado; esperar una nueva prueba.",
  "Escenario de estudio; objetivo no predictivo y precio del stop no garantizado.",
  "Vela de referencia",
  "Beneficio/riesgo",
  "No disponible"
 ],
 "ar": [
  "الهدف المقاس",
  "تفاصيل الحساب",
  "إجراءات الرسم المنفذة",
  "الدخول مشروط بإغلاق وإعادة اختبار بعد المستوى.",
  "تم تجاوز المستوى؛ انتظر إعادة الاختبار.",
  "سيناريو بحث؛ الهدف ليس توقعًا وسعر تنفيذ الوقف غير مضمون.",
  "شمعة مرجعية",
  "العائد/المخاطرة",
  "غير متاح"
 ],
 "fr": [
  "Objectif mesuré",
  "Détails du calcul",
  "Actions effectuées sur le graphique",
  "Entrée sous condition de clôture et de nouveau test du niveau.",
  "Niveau déjà franchi ; attendre un nouveau test.",
  "Scénario de recherche ; objectif non prédictif et prix du stop non garanti.",
  "Bougie de référence",
  "Gain/risque",
  "Indisponible"
 ],
 "de": [
  "Gemessenes Ziel",
  "Berechnungsdetails",
  "Ausgeführte Chart-Aktionen",
  "Einstieg erst nach Schlusskurs und erneutem Test jenseits des Niveaus.",
  "Niveau bereits gekreuzt; erneuten Test abwarten.",
  "Forschungsszenario; Ziel ist keine Prognose, Stop-Ausführungskurs nicht garantiert.",
  "Referenzkerze",
  "Chance/Risiko",
  "Nicht verfügbar"
 ],
 "pt": [
  "Alvo medido",
  "Detalhes do cálculo",
  "Ações realizadas no gráfico",
  "Entrada condicionada a fechamento e novo teste além do nível.",
  "Nível já cruzado; aguarde novo teste.",
  "Cenário de pesquisa; alvo não é previsão e preço de execução do stop não é garantido.",
  "Vela de referência",
  "Retorno/risco",
  "Indisponível"
 ],
 "ru": [
  "Измеренная цель",
  "Подробности расчета",
  "Выполненные действия на графике",
  "Вход после закрытия и повторного теста за уровнем.",
  "Уровень уже пройден; дождитесь повторного теста.",
  "Исследовательский сценарий; цель не прогноз, цена исполнения стопа не гарантирована.",
  "Опорная свеча",
  "Прибыль/риск",
  "Недоступно"
 ],
 "zh": [
  "测算目标",
  "计算详情",
  "已执行的图表操作",
  "需收盘突破并回测该水平后才考虑入场。",
  "已突破该水平；等待回测。",
  "研究情景；目标不是预测，止损成交价不受保证。",
  "参考K线",
  "收益/风险",
  "不可用"
 ],
 "ja": [
  "測定目標",
  "計算の詳細",
  "実行されたチャート操作",
  "水準を超えた終値と再テストが条件です。",
  "すでに突破済み。再テストを待ちます。",
  "研究用シナリオ。目標は予測ではなく、ストップ約定価格は保証されません。",
  "基準足",
  "利益/リスク",
  "利用不可"
 ]
};
export const chatPresentationCopy=Object.fromEntries(Object.entries(rows).map(([code,values])=>[code,Object.fromEntries(keys.map((key,i)=>[key,values[i]]))]));

const tradeMessages={
 he:['סומנו טריגר כניסה, סטופ ויעד מדוד כשזמין. הרמות מותנות ואינן הבטחת ביצוע.','רמות כניסה וסטופ לא סומנו: אין תרחיש שרת מאומת.'],
 en:['Entry trigger, stop and available measured target were marked. Levels are conditional and do not guarantee execution.','Entry and stop were not marked: no verified server scenario.'],
 es:['Se marcaron entrada, stop y objetivo medido disponible. Son niveles condicionales sin garantía de ejecución.','No se marcaron entrada ni stop: falta un escenario verificado del servidor.'],
 ar:['تم تحديد الدخول والوقف والهدف المقاس المتاح. المستويات مشروطة ولا تضمن التنفيذ.','لم تُحدد مستويات الدخول والوقف: لا يوجد سيناريو خادم موثق.'],
 fr:['Entrée, stop et objectif mesuré disponible ont été tracés. Niveaux conditionnels sans garantie d’exécution.','Entrée et stop non tracés : aucun scénario serveur vérifié.'],
 de:['Einstieg, Stop und verfügbares gemessenes Ziel wurden markiert. Bedingte Niveaus ohne Ausführungsgarantie.','Einstieg und Stop nicht markiert: kein bestätigtes Serverszenario.'],
 pt:['Entrada, stop e alvo medido disponível foram marcados. Níveis condicionais sem garantia de execução.','Entrada e stop não marcados: falta cenário verificado do servidor.'],
 ru:['Отмечены вход, стоп и доступная измеренная цель. Условные уровни без гарантии исполнения.','Вход и стоп не отмечены: нет подтвержденного серверного сценария.'],
 zh:['已标记入场触发位、止损和可用的测算目标。均为条件水平，不保证成交。','未标记入场与止损：没有经服务器核实的情景。'],
 ja:['入口、ストップ、利用可能な測定目標を表示しました。条件付き水準で約定は保証されません。','入口とストップは未表示です。確認済みサーバーシナリオがありません。']
};
for(const [code,[drawn,noScenario]] of Object.entries(tradeMessages))Object.assign(chatPresentationCopy[code],{drawn,noScenario});
