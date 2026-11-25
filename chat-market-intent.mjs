// Deliberately match standalone broad-market questions only. A selected ticker
// is not user intent. Do not swallow chart commands or specific stock questions.
const localizedStarter=new Set([
 'Que penses-tu du marché aujourd’hui','Wie schätzt du den Aktienmarkt heute ein',
 'O que você acha do mercado hoje','Что думаешь о рынке сегодня',
 'ما رأيك في سوق الأسهم اليوم','你怎么看今天的股市','今日の株式市場をどう見ていますか',
].map(normalizeMarketQuestion));
function normalizeMarketQuestion(value){
 return value.normalize('NFKC').trim().replace(/^[¿¡]+/u,'').replace(/\s*[?!؟？！.]+$/u,'').replace(/[‘’]/gu,"'").replace(/\s+/gu,' ');
}
const broadMarketPatterns=[
 /^(?:מה (?:קורה|המצב) בשוק(?: האמריקאי)?|מה מצב (?:השוק|שוק המניות)(?: האמריקאי)?|סקירת (?:השוק|שוק המניות))(?: (?:היום|עכשיו|כרגע))?(?:[,،]? (?:כולל|עם) (?:עליות וירידות|תמיכות והתנגדויות|שינוי באחוזים)(?: (?:וגם|ו) ?(?:תמיכות והתנגדויות|שינוי באחוזים))?)?$/u,
 /^(?:what(?:'s| is) happening (?:in|with) (?:the )?(?:us )?(?:stock )?market|(?:give me )?(?:a )?(?:us )?market (?:overview|update))(?: (?:today|now|right now))?(?: (?:with|including) (?:moves|support and resistance)(?: and (?:support and resistance|percentage changes))?)?$/iu,
 /^(?:(?:מה (?:אתה חושב|דעתך) על|איך מתנהג|מה קורה (?:עם|ב)) (?:שוק המניות(?: האמריקאי)?|השוק(?: האמריקאי)?)|(?:מה קורה|מה המצב|איך המצב|איך המסחר) בשוק(?: האמריקאי)?) (?:של )?(?:היום|עכשיו|כרגע)$/u,
 /^(?:(?:תן לי |תעשה לי )?סקיר(?:ה (?:של|על)|ת) (?:השוק|שוק המניות)(?: האמריקאי)? (?:היום|עכשיו|כרגע)|איך (?:השוק|שוק המניות)(?: האמריקאי)? (?:היום|עכשיו|כרגע))$/u,
 /^(?:what do you think (?:of|about) (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market|how is (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market(?: doing)?|what(?:'s| is) happening (?:in|with) (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market|(?:give me )?(?:a )?(?:(?:u\.s\.|us) )?(?:stock )?market (?:overview|update|recap))(?: for)? (?:today|right now)$/iu,
 /^(?:qué opinas (?:del|sobre el) mercado(?: estadounidense)? hoy|cómo (?:va|está) el mercado(?: estadounidense)? hoy)$/iu,
];
export function currentUSMarketIntent(value){
 if(typeof value!=='string'||value.length>220)return false;
 const q=normalizeMarketQuestion(value);
 return localizedStarter.has(q)||broadMarketPatterns.some(pattern=>pattern.test(q));
}
