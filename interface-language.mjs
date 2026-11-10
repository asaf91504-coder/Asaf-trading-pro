export const languageNames={he:'עברית',en:'English',es:'Español',ar:'العربية',fr:'Français',de:'Deutsch',pt:'Português',ru:'Русский',zh:'中文',ja:'日本語'};
export const responseLanguages={he:'Hebrew',en:'English',es:'Spanish',ar:'Arabic',fr:'French',de:'German',pt:'Portuguese',ru:'Russian',zh:'Simplified Chinese',ja:'Japanese'};
export function languageCode(value){const code=String(value||'he').toLowerCase().split(/[-_]/)[0];return Object.hasOwn(languageNames,code)?code:'he'}
export function languageDirection(value){return ['he','ar'].includes(languageCode(value))?'rtl':'ltr'}
export function responseLanguageInstruction(value){return '\nResponse language: '+responseLanguages[languageCode(value)]+'. Use this language for the conversational answer, including any explanation. Keep ticker symbols, numbers, source names, tool action keys and JSON schema unchanged. This language setting overrides earlier instructions to answer in Hebrew; all other safety, evidence and licensing requirements still apply.'}
export function savedLanguage(storage){try{return languageCode(storage?.getItem('asaf_interface_language_v1'))}catch{return 'he'}}
export function saveLanguage(storage,code){try{storage?.setItem('asaf_interface_language_v1',languageCode(code))}catch{}}
export function createTranslator(catalog={}){
 const entries=Object.entries(catalog).filter(([key,value])=>typeof value==='string'&&key!==value&&key.length>=3).sort((a,b)=>b[0].length-a[0].length);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=entries.length?new RegExp(entries.map(([key])=>escape(key)).join('|'),'gu'):null;
 return text=>{if(typeof text!=='string')return text;if(Object.hasOwn(catalog,text))return catalog[text];return pattern?text.replace(pattern,key=>catalog[key]):text};
}
