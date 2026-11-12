import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
const issuer='https://appleid.apple.com';
export function appleProviderConfigured(env){
 try{
  const uri=new URL(env.APPLE_REDIRECT_URI);
  const key=createPrivateKey((env.APPLE_PRIVATE_KEY||'').replaceAll('\\n','\n'));
  return /^[A-Za-z0-9.-]{3,200}$/.test(env.APPLE_CLIENT_ID||'')&&/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID||'')&&/^[A-Z0-9]{10}$/.test(env.APPLE_KEY_ID||'')&&uri.protocol==='https:'&&!uri.hash&&!uri.username&&!uri.password&&key.asymmetricKeyType==='ec'&&key.asymmetricKeyDetails?.namedCurve==='prime256v1';
 }catch{return false;}
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
export function appleClientSecret(env,now=Date.now()){
 const iat=Math.floor(now/1000);
 const payload=encode({alg:'ES256',kid:env.APPLE_KEY_ID})+'.'+encode({iss:env.APPLE_TEAM_ID,iat,exp:iat+300,aud:issuer,sub:env.APPLE_CLIENT_ID});
 return payload+'.'+sign('sha256',Buffer.from(payload),{key:(env.APPLE_PRIVATE_KEY||'').replaceAll('\\n','\n'),dsaEncoding:'ieee-p1363'}).toString('base64url');
}
export async function verifyAppleCode(code,{env=process.env,fetchImpl=fetch,now=Date.now()}={}){
 const response=await fetchImpl(issuer+'/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.APPLE_CLIENT_ID,client_secret:appleClientSecret(env,now),code,grant_type:'authorization_code',redirect_uri:env.APPLE_REDIRECT_URI}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Apple rejected code');
 const tokens=await response.json();
 if(typeof tokens.id_token!=='string'||tokens.id_token.length>16000)throw Error('Missing token');
 const parts=tokens.id_token.split('.');if(parts.length!==3)throw Error('Invalid token');
 const header=JSON.parse(Buffer.from(parts[0],'base64url'));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Unsupported token');
 const keyResponse=await fetchImpl(issuer+'/auth/keys',{signal:AbortSignal.timeout(10000)});
 if(!keyResponse.ok)throw Error('Apple keys unavailable');
 const {keys}=await keyResponse.json();
 const jwk=keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
 if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('Invalid signature');
 const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(claims.iss!==issuer||claims.aud!==env.APPLE_CLIENT_ID||!Number.isFinite(claims.exp)||claims.exp*1000<=now||!Number.isFinite(claims.iat)||claims.iat*1000>now+60000)throw Error('Invalid claims');
 // Tokens remain in memory only; no access or refresh tokens are persisted or returned.
 return claims;
}
