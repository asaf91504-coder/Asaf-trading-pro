import {languageCode} from '../interface-language.mjs';

// An outage summary is calculated from this request's authorized server data.
// It is never a substitute model, a browser snapshot or a replay of old prose.
const copy={
 he:['ניתוח ה־AI לא הושלם. אלה הנתונים המאומתים שזמינים לבקשה:','סגירה','שינוי בין הנרות','תמיכה אפשרית','התנגדות אפשרית','מעל MA20','מתחת MA20','לונג','שורט','מועמדת למעקב; אין אישור לכניסה','עומדת במסננים','סיכום נתונים בלבד, ללא ניתוח AI. הנתונים מתייחסים לתאריך ולטווח המצוינים, ולא למחיר חי.'],
 en:['AI analysis did not finish. Verified data available for this request:','Close','Change between bars','Candidate support','Candidate resistance','Above MA20','Below MA20','Long','Short','Watch candidate; entry unconfirmed','Meets filters','Data summary only, without AI analysis. Values refer to the stated date and interval, not a live quote.'],
 es:['El análisis de IA no terminó. Datos verificados disponibles:','Cierre','Cambio entre velas','Soporte posible','Resistencia posible','Sobre MA20','Bajo MA20','Largo','Corto','Candidata a seguimiento; entrada sin confirmar','Cumple filtros','Solo un resumen de datos, sin análisis de IA. Valores de la fecha e intervalo indicados, no una cotización en vivo.'],
 ar:['لم يكتمل تحليل الذكاء الاصطناعي. البيانات المتحقق منها المتاحة:','الإغلاق','التغير بين الشموع','دعم محتمل','مقاومة محتملة','فوق MA20','تحت MA20','شراء','بيع على المكشوف','مرشحة للمراقبة؛ الدخول غير مؤكد','تستوفي المرشحات','ملخص بيانات فقط، دون تحليل ذكاء اصطناعي. القيم للتاريخ والفترة المذكورين وليست أسعارًا حية.'],
 fr:['L’analyse IA n’a pas abouti. Données vérifiées disponibles :','Clôture','Variation entre bougies','Support possible','Résistance possible','Au-dessus de MA20','Sous MA20','Long','Short','À surveiller ; entrée non confirmée','Respecte les filtres','Résumé de données sans analyse IA. Valeurs de la date et de l’intervalle indiqués, pas une cotation en direct.'],
 de:['Die KI-Analyse wurde nicht abgeschlossen. Verifizierte Daten:','Schlusskurs','Änderung zwischen Kerzen','Mögliche Unterstützung','Möglicher Widerstand','Über MA20','Unter MA20','Long','Short','Beobachtungskandidat; Einstieg unbestätigt','Erfüllt Filter','Datenübersicht ohne KI-Analyse. Werte gelten für Datum und Intervall, nicht als Live-Kurs.'],
 pt:['A análise de IA não terminou. Dados verificados disponíveis:','Fechamento','Variação entre velas','Suporte possível','Resistência possível','Acima da MA20','Abaixo da MA20','Long','Short','Candidata a acompanhamento; entrada não confirmada','Cumpre filtros','Resumo de dados sem análise de IA. Valores da data e do intervalo indicados, não uma cotação ao vivo.'],
 ru:['Анализ ИИ не завершён. Доступные проверенные данные:','Закрытие','Изменение между свечами','Возможная поддержка','Возможное сопротивление','Выше MA20','Ниже MA20','Лонг','Шорт','Для наблюдения; вход не подтверждён','Соответствует фильтрам','Сводка данных без анализа ИИ. Значения относятся к указанным дате и интервалу, а не к текущей котировке.'],
 zh:['AI 分析未完成。以下是本次请求可用的已验证数据：','收盘价','蜡烛间涨跌','可能支撑','可能阻力','高于 MA20','低于 MA20','做多','做空','观察候选，入场未确认','符合筛选条件','仅为数据摘要，并非 AI 分析。数值对应所示日期和周期，不是实时行情。'],
 ja:['AI分析は完了しませんでした。今回の依頼で利用できる検証済みデータ：','終値','足間の変化','支持線候補','抵抗線候補','MA20より上','MA20より下','ロング','ショート','監視候補・エントリー未確認','条件を満たす','AI分析ではなくデータの要約です。表示の日付と時間足の値であり、ライブ価格ではありません。']
};
const positive=n=>Number.isFinite(n)&&n>0;
const number=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
function priceRow(c,labels){
 if(typeof c.symbol!=='string'||!positive(c.close)||typeof c.asOf!=='string'||!c.interval)return null;
 const parts=[c.symbol+' · '+c.asOf+' · '+c.interval,labels[1]+' $'+number(c.close)];
 if(Number.isFinite(c.changePercent))parts.push(labels[2]+' '+(c.changePercent>0?'+':'')+number(c.changePercent)+'%');
 if(positive(c.sma20))parts.push((c.close===c.sma20?'MA20':c.close>c.sma20?labels[5]:labels[6])+' $'+number(c.sma20));
 const support=c.priceLevels?.support?.find(n=>positive(n)&&n<c.close),resistance=c.priceLevels?.resistance?.find(n=>positive(n)&&n>c.close);
 if(support)parts.push(labels[3]+' $'+number(support));
 if(resistance)parts.push(labels[4]+' $'+number(resistance));
 if(['long','short'].includes(c.side))parts.push(labels[c.side==='long'?7:8],labels[c.status==='match'?10:9]);
 return parts.join(' · ');
}
export function verifiedChatFallback({discovery,context,language='he'}={}){
 const labels=copy[languageCode(language)];
 let candidates=[];
 if(discovery?.status==='available')candidates=discovery.candidates?.slice(0,12)||[];
 else if(['server-provider-cache','server-intrinio-cache','server-crypto-cache'].includes(context?.provenance)){
  const previous=context.last30Candles?.at(-2)?.[4];
  candidates=[{...context,asOf:context.lastCandleTime,changePercent:positive(previous)?(context.close/previous-1)*100:null}];
 }
 const lines=candidates.map(c=>priceRow(c,labels)).filter(Boolean);
 return lines.length?{answer:[labels[0],...lines.map(line=>'• '+line),labels[11]].join('\n'),answerMode:'verified-data',modelUnavailable:true,recoveryStatus:labels[0]}:null;
}
