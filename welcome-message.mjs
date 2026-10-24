// Names are display text only, never identity, permissions or HTML.
export function googleDisplayName(claims){
 for(const value of [claims?.given_name,claims?.name]){
  if(typeof value!=='string')continue;
  const name=value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();
  if(name)return Array.from(name).slice(0,80).join('');
 }
 return '';
}
export function welcomeMessage(name,created){
 const safe=googleDisplayName({given_name:name});
 return (created?'Welcome':'Welcome back')+(safe?', '+safe:'')+'!';
}
