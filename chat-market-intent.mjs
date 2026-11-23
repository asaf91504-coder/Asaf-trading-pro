// Deliberately match standalone broad-market questions only. A selected ticker
// is not user intent. Do not swallow chart commands or specific stock questions.
const broadMarketPatterns=[
 /^(?:(?:מה (?:אתה חושב|דעתך) על|איך מתנהג|מה קורה (?:עם|ב)) (?:שוק המניות(?: האמריקאי)?|השוק(?: האמריקאי)?)|(?:מה קורה|מה המצב|איך המצב|איך המסחר) בשוק(?: האמריקאי)?) (?:של )?(?:היום|עכשיו|כרגע)$/u,
 /^(?:(?:תן לי |תעשה לי )?סקיר(?:ה (?:של|על)|ת) (?:השוק|שוק המניות)(?: האמריקאי)? (?:היום|עכשיו|כרגע)|איך (?:השוק|שוק המניות)(?: האמריקאי)? (?:היום|עכשיו|כרגע))$/u,
 /^(?:what do you think (?:of|about) (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market|how is (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market(?: doing)?|what(?:'s| is) happening (?:in|with) (?:the )?(?:(?:us|u\.s\.|american) )?(?:stock )?market|(?:give me )?(?:a )?(?:(?:u\.s\.|us) )?(?:stock )?market (?:overview|update|recap))(?: for)? (?:today|right now)$/iu,
 /^(?:qué opinas (?:del|sobre el) mercado(?: estadounidense)? hoy|cómo (?:va|está) el mercado(?: estadounidense)? hoy)$/iu,
];
export function currentUSMarketIntent(value){
 if(typeof value!=='string'||value.length>220)return false;
 const q=value.normalize('NFKC').trim().replace(/^[¿¡]+/u,'').replace(/[?!؟？！.]+$/u,'').replace(/[‘’]/gu,"'").replace(/\s+/gu,' ');
 return broadMarketPatterns.some(pattern=>pattern.test(q));
}
