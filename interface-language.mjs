export const languageNames={he:'עברית',en:'English',es:'Español',ar:'العربية',fr:'Français',de:'Deutsch',pt:'Português',ru:'Русский',zh:'中文',ja:'日本語'};
export const responseLanguages={he:'Hebrew',en:'English',es:'Spanish',ar:'Arabic',fr:'French',de:'German',pt:'Portuguese',ru:'Russian',zh:'Simplified Chinese',ja:'Japanese'};
export function languageCode(value){const code=String(value||'he').toLowerCase().split(/[-_]/)[0];return Object.hasOwn(languageNames,code)?code:'he'}
export function languageDirection(value){return ['he','ar'].includes(languageCode(value))?'rtl':'ltr'}
export function responseLanguageInstruction(value){return '\nResponse language: '+responseLanguages[languageCode(value)]+'. Use this interface language for the conversational answer, including headings, analysis, explanations and chart-action labels. Use the selected language even when the question, source data or earlier conversation uses another language. A user request to answer in a different language does not change the interface language. Never copy the language of an earlier assistant answer. Before returning, check that all conversational prose uses the required language. Keep ticker symbols, numbers, source names, tool action keys and JSON schema unchanged. This language setting overrides earlier instructions to answer in Hebrew; all other safety, evidence and licensing requirements still apply.'}
export function savedLanguage(storage){try{return languageCode(storage?.getItem('asaf_interface_language_v1'))}catch{return 'he'}}
export function saveLanguage(storage,code){try{storage?.setItem('asaf_interface_language_v1',languageCode(code))}catch{}}
export function createTranslator(catalog={}){
 const entries=Object.entries(catalog).filter(([key,value])=>typeof value==='string'&&key!==value&&key.length>=3).sort((a,b)=>b[0].length-a[0].length);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const fragments=entries.filter(([key])=>/[\u0590-\u05ff]/u.test(key)&&!/{[a-zA-Z]+}/.test(key));
 const pattern=fragments.length?new RegExp(fragments.map(([key])=>escape(key)).join('|'),'gu'):null;
 const templates=entries.filter(([key])=>/\{[a-zA-Z]+\}/.test(key)).map(([key,value])=>{
  const names=[];let cursor=0,source='^';for(const match of key.matchAll(/\{([a-zA-Z]+)\}/g)){source+=escape(key.slice(cursor,match.index))+'(.*?)';names.push(match[1]);cursor=match.index+match[0].length}source+=escape(key.slice(cursor))+'$';return {pattern:new RegExp(source,'u'),names,value};
 });
 const translate=text=>{if(typeof text!=='string')return text;if(Object.hasOwn(catalog,text))return catalog[text];
  const trimmed=text.trim();if(Object.hasOwn(catalog,trimmed))return text.replace(trimmed,()=>catalog[trimmed]);
  // Tool receipts join independent complete messages with newlines.
  if(/[\r\n]/.test(text))return text.split(/(\r\n|\r|\n)/).map(part=>/^[\r\n]+$/.test(part)?part:translate(part)).join('');
  for(const template of templates){const match=trimmed.match(template.pattern);if(match)return text.replace(trimmed,()=>template.value.replace(/\{([a-zA-Z]+)\}/g,(token,name)=>{const value=match[template.names.indexOf(name)+1];return ['label','stage'].includes(name)&&Object.hasOwn(catalog,value)?catalog[value]:value??token}))}
  return pattern?text.replace(pattern,(key,offset,whole)=>{const letter=/[\p{L}\p{N}\p{M}_]/u;const before=whole[offset-1]||'',after=whole[offset+key.length]||'';if((letter.test(key[0])&&letter.test(before))||(letter.test(key.at(-1))&&letter.test(after)))return key;return catalog[key]}):text};
 return translate;
}
