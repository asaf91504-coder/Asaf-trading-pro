import {languageCode} from '../interface-language.mjs';

const replyCopy={
 he:[
  'לא בוצעה פעולת גרף מתשובת המודל. אפשר לנסח בקשה ממוקדת לכלי הגרף.',
  'התשובה נקטעה; לא הופעלו כלים.',
  'תכנון הכלים לא עבר בדיקה.',
  'התשובה נקטעה במגבלת האורך. אפשר לבקש המשך; לא נשלחת בקשה נוספת אוטומטית.'
 ],
 en:[
  'No chart action was performed. Try asking for a specific chart change.',
  'The reply was cut short, so no chart tools ran.',
  'The proposed chart actions did not pass validation.',
  'The reply reached the length limit. You can ask to continue; no new request was sent automatically.'
 ],
 es:[
  'No se realizó ninguna acción en el gráfico. Prueba a pedir un cambio concreto.',
  'La respuesta se cortó y no se ejecutó ninguna herramienta del gráfico.',
  'Las acciones propuestas para el gráfico no pasaron la validación.',
  'La respuesta alcanzó el límite de longitud. Puedes pedir que continúe; no se envió otra solicitud automáticamente.'
 ],
 ar:[
  'لم يُنفَّذ أي إجراء على الرسم البياني. جرّب طلب تغيير محدد.',
  'توقّف الرد قبل اكتماله، لذلك لم تُشغَّل أدوات الرسم البياني.',
  'لم تجتز الإجراءات المقترحة للرسم البياني التحقق.',
  'بلغ الرد الحد الأقصى للطول. يمكنك طلب المتابعة؛ لم يُرسَل طلب آخر تلقائيًا.'
 ],
 fr:[
  'Aucune action n’a été effectuée sur le graphique. Essayez de demander une modification précise.',
  'La réponse a été interrompue, aucun outil graphique n’a donc été utilisé.',
  'Les actions proposées pour le graphique n’ont pas été validées.',
  'La réponse a atteint la limite de longueur. Vous pouvez demander la suite ; aucune nouvelle requête n’a été envoyée automatiquement.'
 ],
 de:[
  'Am Chart wurde nichts geändert. Bitte beschreibe eine konkrete Änderung.',
  'Die Antwort wurde abgeschnitten. Es wurden keine Chart-Werkzeuge ausgeführt.',
  'Die vorgeschlagenen Chart-Aktionen haben die Prüfung nicht bestanden.',
  'Die Antwort hat die maximale Länge erreicht. Du kannst um eine Fortsetzung bitten. Es wurde keine weitere Anfrage automatisch gesendet.'
 ],
 pt:[
  'Nenhuma ação foi realizada no gráfico. Tente pedir uma alteração específica.',
  'A resposta foi interrompida, por isso nenhuma ferramenta do gráfico foi executada.',
  'As ações propostas para o gráfico não passaram na validação.',
  'A resposta atingiu o limite de tamanho. Você pode pedir para continuar; nenhuma outra solicitação foi enviada automaticamente.'
 ],
 ru:[
  'Действия на графике не выполнены. Попробуйте указать, что именно нужно изменить.',
  'Ответ был обрезан, поэтому инструменты графика не запускались.',
  'Предложенные действия на графике не прошли проверку.',
  'Ответ достиг ограничения по длине. Можно попросить продолжить; новый запрос не был отправлен автоматически.'
 ],
 zh:[
  '未对图表执行任何操作。请尝试说明要进行的具体修改。',
  '回复被截断，未运行任何图表工具。',
  '建议的图表操作未通过验证。',
  '回复已达到长度上限。你可以要求继续；系统没有自动发送新请求。'
 ],
 ja:[
  'チャートへの操作は行われませんでした。変更したい内容を具体的に指定してください。',
  '回答が途中で切れたため、チャートツールは実行されませんでした。',
  '提案されたチャート操作は検証に通りませんでした。',
  '回答が長さの上限に達しました。続きを求めることができます。新しいリクエストは自動送信されていません。'
 ],
};

export function assistantReplyCopy(language){
 const [noAction,toolTruncated,invalidActions,textTruncated]=replyCopy[languageCode(language)];
 return {noAction,toolTruncated,invalidActions,textTruncated};
}
