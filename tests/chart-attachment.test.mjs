import test from 'node:test';
import assert from 'node:assert/strict';
import {chartAttachment} from '../chart-attachment.mjs';
test('automatic chart attachment requires matching loaded data and explicit enabled option',()=>{
 let captures=0;const snapshot=()=>{captures++;return 'data:image/png;base64,example'};
 assert.equal(chartAttachment({auto:true,hasMatchingData:false,snapshot}),null);assert.equal(chartAttachment({auto:false,hasMatchingData:true,snapshot}),null);assert.equal(captures,0);
 assert.equal(chartAttachment({auto:true,hasMatchingData:true,snapshot}),'data:image/png;base64,example');assert.equal(captures,1);
});
test('an explicit alternative image takes precedence over automatic capture',()=>{
 assert.equal(chartAttachment({manual:'chosen-image',auto:true,hasMatchingData:true,snapshot:()=>{throw Error('must not run')}}),'chosen-image');
});
test('unavailable or hidden chart capture leaves structured OHLC analysis usable',()=>{
 assert.equal(chartAttachment({auto:true,hasMatchingData:true,snapshot:()=>{throw Error('not rendered')}}),null);assert.equal(chartAttachment({auto:true,hasMatchingData:true,snapshot:()=>null}),null);
});
