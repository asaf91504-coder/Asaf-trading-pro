import test from 'node:test';import assert from 'node:assert/strict';
import {approvedChartSymbols,approvedMarketSymbols,marketSelection,readMarketSnapshot} from '../server/market-feed.mjs';
import {searchAssets,resolveAssetQuery} from '../asset-search.mjs';
import {env as authEnv,fixture,seed} from './identity-fixture.mjs';
const env={...authEnv,ASAF_MARKET_ALLOWED_SYMBOLS:'AAPL,MSFT',ASAF_MARKET_CHART_SYMBOLS:'CRWV'};
test('manual chart extensions do not expand the background scanner',()=>{assert.deepEqual(approvedMarketSymbols(env),['AAPL','MSFT']);assert.ok(approvedChartSymbols(env).includes('CRWV'));assert.equal(marketSelection('NASDAQ:CRWV','1day',env).symbol,'CRWV');assert.throws(()=>marketSelection('NOPE','1day',env),/NOPE/);assert.ok(!approvedChartSymbols({...env,ASAF_MARKET_CHART_SYMBOLS:'<bad>'}).includes('<bad>'))});
test('search resolves CoreWeave and filters suggestions to configured chart coverage',()=>{assert.equal(resolveAssetQuery('CoreWeave'),'NASDAQ:CRWV');assert.equal(resolveAssetQuery('crwv'),'NASDAQ:CRWV');assert.equal(searchAssets('CRWV','stock',['AAPL']).length,0);assert.equal(searchAssets('CRWV','stock',['CRWV'])[0].symbol,'NASDAQ:CRWV');assert.equal(searchAssets('CCK','stock',['CCK'])[0].symbol,'CCK')});
test('extra symbols cannot bypass the private trial owner check',async()=>{const f=fixture(),u=seed(f);let calls=0;const trial={...env,ASAF_MARKET_ENABLED:'true',ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED:'true',ASAF_MARKET_DELAY_MINUTES:'0',TWELVE_DATA_API_KEY:'test-only',ASAF_TWELVE_PRIVATE_TRIAL:'true',ASAF_TWELVE_TRIAL_MEMBER_ID:u.record.id,ASAF_TWELVE_TRIAL_ENDS_AT:new Date(Date.now()+86400000).toISOString()};await assert.rejects(readMarketSnapshot({selected:'CRWV',env:trial,run:f.run,memberId:'other',fetcher:async()=>{calls++}}));assert.equal(calls,0)});

import {indexStocks,indexCatalogueMetadata} from '../index-stock-catalogue.mjs';
test('every imported listed equity resolves and passes chart selection without changing scanner scope',()=>{
 assert.equal(new Set(indexStocks.map(a=>a.symbol)).size,indexStocks.length);
 for(const asset of indexStocks){
  assert.equal(marketSelection(asset.symbol,'1day',env).symbol,asset.symbol);
  assert.equal(resolveAssetQuery(asset.symbol).split(':').at(-1),asset.symbol);
  assert.equal(searchAssets(asset.symbol,'stock',null,{limit:1})[0].symbol.split(':').at(-1),asset.symbol);
 }
 assert.deepEqual(approvedMarketSymbols(env),['AAPL','MSFT']);
});
test('index pages exhaust the catalogue with no missing or repeated symbols',()=>{
 for(const source of indexCatalogueMetadata.sources){
  const expected=indexStocks.filter(a=>a.groups.includes(source.group)).map(a=>a.symbol).sort();
  assert.equal(expected.length,source.listedSymbols);
  const found=[];for(let offset=0;offset<expected.length;offset+=24)found.push(...searchAssets('','stock',null,{group:source.group,offset,limit:24}).map(a=>a.symbol.split(':').at(-1)));
  assert.deepEqual(found.sort(),expected);
 }
 assert.equal(searchAssets('bitcoin','all',null,{group:'sp500'}).length,0);
});
test('fund cash, derivative and restricted rows never become loadable stock suggestions',()=>{
 assert.ok(indexStocks.length>2400);
 for(const symbol of ['USD','XTSLA','SKYD.WS','2200964D','-'])assert.ok(!indexStocks.some(a=>a.symbol===symbol));
 for(const symbol of ['BRK.B','BF.B','MOG.A','GEF.B'])assert.equal(marketSelection(symbol,'1day',env).symbol,symbol);
});
test('small cap company names are searchable and index metadata has dated provenance',()=>{
 assert.equal(searchAssets('GLAUKOS','stock',null,{group:'russell2000'})[0].symbol,'GKOS');
 assert.equal(resolveAssetQuery('GLAUKOS'),'GKOS');
 assert.equal(searchAssets('GKOS','stock',['AAPL']).length,0);
 assert.equal(indexCatalogueMetadata.sources.length,2);
 assert.ok(indexCatalogueMetadata.sources.every(s=>s.url.startsWith('https://www.ishares.com/')&&s.asOf));
});
