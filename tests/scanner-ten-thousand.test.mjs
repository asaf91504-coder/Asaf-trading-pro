import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerUniverse,MAX_SCANNER_SYMBOLS} from '../server/scanner-universe.mjs';
import {usStockDirectory,usStockDirectoryMetadata} from '../server/us-stock-directory.mjs';
import {collectScannerResults} from '../scanner-search-policy.mjs';
import {scannerCapacity} from '../server/scanner-budget.mjs';

test('10,000 US stock pool preserves previous ordering without fabricated symbols or funds',()=>{
 const env={ASAF_SCANNER_UNIVERSE:'us1000',ASAF_MARKET_ALLOWED_SYMBOLS:'AMD,TSLA'};
 const previous=scannerUniverse(env,{legacy:true}),expanded=scannerUniverse({...env,ASAF_SCANNER_UNIVERSE:'us10000'});
 assert.equal(MAX_SCANNER_SYMBOLS,10000);assert.equal(expanded.length,10000);assert.equal(new Set(expanded).size,10000);
 assert.deepEqual(expanded.slice(0,1000),previous);
 assert.deepEqual(scannerUniverse(env),expanded);
 const directory=new Set(usStockDirectory);assert.ok(expanded.slice(1000).every(s=>directory.has(s)));
 assert.equal(usStockDirectoryMetadata.instrumentType,'Common Stock');assert.equal(usStockDirectoryMetadata.currency,'USD');
 assert.ok(usStockDirectoryMetadata.exchanges.OTC>0);
 assert.deepEqual(scannerUniverse({...env,ASAF_SCANNER_UNIVERSE:'us100000'}),[]);
});
test('50-result cap counts distinct matching symbols only, regardless of direction and duplicate patterns',()=>{
 const map=new Map(),row=(symbol,matches=true)=>({symbol,presentation:'derived-only',screen:{matches},opportunities:[{side:'long'},{side:'short'}]});
 const rows=[...Array.from({length:200},(_,i)=>row('WATCH'+i,false)),row('duplicate'),row('DUPLICATE'),{...row('RAW'),presentation:'raw'},...Array.from({length:70},(_,i)=>row('MATCH'+i))];
 assert.equal(collectScannerResults(map,rows),50);assert.equal(map.size,250);
 assert.equal(map.has('RAW'),false);assert.equal(map.has('MATCH49'),false);
 assert.equal(collectScannerResults(map,[row('duplicate',false),row('NEW')]),50);
 assert.equal(map.get('DUPLICATE').screen.matches,false);assert.equal(map.get('NEW').screen.matches,true);
});
test('capacity remains honest about a 10,000-stock cold load and leaves provider quotas unchanged',()=>{
 const capacity=scannerCapacity({ASAF_MARKET_REQUESTS_PER_MINUTE:'610',ASAF_MARKET_REQUESTS_PER_DAY:'100000',ASAF_SCANNER_DAILY_VOLUME_ENABLED:'true'},{symbols:10000,fundamentals:true});
 assert.equal(capacity.coldMinutes,1000);assert.equal(capacity.coldCredits,520000);assert.equal(capacity.coldFitsDailyBudget,false);assert.equal(capacity.threeHourCyclePossible,false);
});
