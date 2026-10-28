import test from 'node:test';
import assert from 'node:assert/strict';
import {screenResult} from '../scanner-core.mjs';
import {scannerSettings,scannerDefaults,asafScannerPreset,scannerFields} from '../scanner-presets.mjs';
import {personalData,mergePersonal,personalBackup,parsePersonalBackup} from '../personal-data.mjs';
import {preparePersonalRestore,completePersonalRestore} from '../personal-restore.mjs';
const preset=(id='qa')=>({id,name:'תבנית מחקר',saved:'2026-10-25T00:00:00Z',settings:scannerDefaults()});
test('defaults contain every implemented scanner control without provider options',()=>{const s=scannerDefaults();assert.equal(Object.keys(s).length,Object.keys(scannerFields).length);assert.equal(s.scanMinPrice,5);assert.equal(s.scanAbove20,true);assert.equal(s.scanSort,'atr');assert.equal(s.provider,undefined)});
test('Asaf preset encodes loaded-data criteria without pretending market cap is verified',()=>{const s=asafScannerPreset();assert.equal(s.scanRisingVolume,true);assert.equal(s.scanAbove20,true);assert.equal(s.scanMinMeasuredMove,15);assert.equal(s.scanOnlyMatches,true);assert.equal(s.scanSort,'atr');assert.equal(s.marketCap,undefined)});
test('scanner numeric settings reject coercion, null, negative and non-finite values',()=>{for(const value of ['5',null,true,-1,NaN,Infinity])assert.throws(()=>scannerSettings({scanMinPrice:value}));assert.throws(()=>scannerSettings({scanMinRSI:80,scanMaxRSI:20}))});
test('scanner settings only allow implemented pattern and direction values',()=>{for(const patch of [{scanPattern:'fake'},{scanSort:'profit'},{scanAbove20:'true'},{scanDIDirection:'sideways'},{scanMinScenarioRR:101}])assert.throws(()=>scannerSettings(patch));assert.equal(scannerSettings({scanPattern:'doubleTop'}).scanPattern,'doubleTop')});
test('saved scanner templates round trip through the same account backup schema',()=>{const value=[preset()];assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('scannerPresets',value)),'scannerPresets'),value)});
test('template merge preserves local unique IDs and uses explicit account priority on collisions',()=>{const r=mergePersonal('scannerPresets',[preset(),preset('local')],[{...preset(),name:'cloud'}]);assert.equal(r.length,2);assert.equal(r[0].name,'cloud')});
test('preset limits reject duplicates and prevent silent loss of the eleventh record',()=>{assert.throws(()=>personalData('scannerPresets',[preset(),preset()]));const ten=Array.from({length:10},(_,i)=>preset('id'+i));assert.throws(()=>mergePersonal('scannerPresets',ten,[preset('extra')]))});
test('preset restore preview protects against concurrent local changes',()=>{const current=[preset()],text=JSON.stringify(personalBackup('scannerPresets',[preset('new')])),plan=preparePersonalRestore('scannerPresets',current,text);assert.equal(plan.counts.merged,2);assert.equal(completePersonalRestore(plan,'scannerPresets',current,text).length,2);assert.throws(()=>completePersonalRestore(plan,'scannerPresets',[],text))});

test('Asaf preset rejects bearish measured moves and accepts matching long setups',()=>{
 const settings=asafScannerPreset();assert.equal(settings.scanScenarioSide,'long');const options={risingVolume:settings.scanRisingVolume,minMeasuredMove:settings.scanMinMeasuredMove,scenarioSide:settings.scanScenarioSide};const record={summary:{close:10,aboveMA20:true,volumeRatio:2},bars:[{close:9},{close:10}],research:{available:true,candidates:[{kind:'doubleTop',stage:'crossed',scenario:{side:'short',movePercent:20,riskReward:3}}]}};assert.equal(screenResult(record,options).matches,false);record.research.candidates.push({kind:'doubleBottom',stage:'crossed',scenario:{side:'long',movePercent:16,riskReward:2}});assert.equal(screenResult(record,options).matches,true);assert.equal(screenResult(record,{...options,scenarioSide:'short'}).matches,true);assert.equal(screenResult(record,{...options,scenarioSide:'bad'}).matches,false);
});
test('older saved scanner templates restore with either-side default',()=>{
 const value=preset();delete value.settings.scanScenarioSide;const restored=personalData('scannerPresets',[value]);assert.equal(restored[0].settings.scanScenarioSide,'any');assert.equal(scannerSettings({}).scanScenarioSide,'any');assert.throws(()=>scannerSettings({scanScenarioSide:'up'}));
});
