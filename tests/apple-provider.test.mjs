import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {appleProviderConfigured,appleClientSecret,verifyAppleCode} from '../server/apple-provider.mjs';
const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),rsa=generateKeyPairSync('rsa',{modulusLength:2048});
const env={APPLE_CLIENT_ID:'com.asaf.web',APPLE_TEAM_ID:'AAAAAAAAAA',APPLE_KEY_ID:'BBBBBBBBBB',APPLE_REDIRECT_URI:'https://example.test/subscription.html',APPLE_PRIVATE_KEY:ec.privateKey.export({type:'pkcs8',format:'pem'})};
const now=Date.now(),jwk={...rsa.publicKey.export({format:'jwk'}),alg:'RS256',use:'sig',kid:'test'};
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(extra={},key=rsa.privateKey,header={alg:'RS256',kid:'test'}){const input=enc(header)+'.'+enc({iss:'https://appleid.apple.com',aud:env.APPLE_CLIENT_ID,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+300,nonce:'nonce',sub:'001.apple-subject',...extra});return input+'.'+sign('RSA-SHA256',Buffer.from(input),key).toString('base64url');}
test('Apple client secret is short-lived ES256 and configuration fails closed',()=>{
 assert.equal(appleProviderConfigured(env),true);assert.equal(appleProviderConfigured({...env,APPLE_PRIVATE_KEY:''}),false);
 assert.equal(appleProviderConfigured({...env,APPLE_REDIRECT_URI:'http://localhost'}),false);
 const [h,p,s]=appleClientSecret(env,now).split('.');const claims=JSON.parse(Buffer.from(p,'base64url'));assert.equal(claims.exp-claims.iat,300);assert.equal(claims.aud,'https://appleid.apple.com');assert.ok(verify('sha256',Buffer.from(h+'.'+p),{key:ec.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
});
test('Apple code exchange validates actual RSA signature and claims using fixed endpoints',async()=>{
 for(const [name,idToken,ok] of [['valid',token(),true],['audience',token({aud:'foreign'}),false],['issuer',token({iss:'https://evil.test'}),false],['expired',token({exp:1}),false],['future',token({iat:Math.floor(now/1000)+1000}),false],['algorithm',token({},rsa.privateKey,{alg:'none',kid:'test'}),false],['signature',token({},generateKeyPairSync('rsa',{modulusLength:2048}).privateKey),false]]){
  const urls=[];const fetchImpl=async(url,options)=>{urls.push(url);if(url.endsWith('/token')){assert.equal(options.body.get('grant_type'),'authorization_code');assert.equal(options.body.get('redirect_uri'),env.APPLE_REDIRECT_URI);return Response.json({id_token:idToken,access_token:'never-return',refresh_token:'never-return'});}return Response.json({keys:[jwk]});};
  const promise=verifyAppleCode('code',{env,fetchImpl,now});
  if(ok){const claims=await promise;assert.equal(claims.sub,'001.apple-subject');assert.equal(JSON.stringify(claims).includes('never-return'),false);}else await assert.rejects(promise,undefined,name);
  assert.ok(urls.every(u=>['https://appleid.apple.com/auth/token','https://appleid.apple.com/auth/keys'].includes(u)));
 }
});
