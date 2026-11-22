// Treat ASCII separators that can denote either decimals or thousands as
// ambiguous. Do not guess based on interface locale: users paste across locales.
export function parseSetupPrice(input){
 if(typeof input!=='string'||input.length>32)return null;
 const raw=input.trim().replace(/[٠-٩۰-۹]/g,char=>String(char.charCodeAt(0)&15));
 // 0.001 and .001 cannot be grouped amounts. 1.234 and 1,234 can.
 if(/^[1-9][0-9]{0,2}[.,][0-9]{3}$/.test(raw))return null;
 // The Arabic decimal separator is distinct from its thousands separator (٬).
 // Complete input only: no embedded spacing, grouping, currency or exponents.
 if(!/^(?:(?:0|[1-9][0-9]*)(?:[.,٫][0-9]+)?|[.,٫][0-9]+)$/.test(raw))return null;
 const price=Number(raw.replace(/[,٫]/g,'.'));
 return Number.isFinite(price)&&price>0&&price<=1e12?price:null;
}
