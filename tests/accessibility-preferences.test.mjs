import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences} from '../accessibility.mjs';
test('corrupt or old stored preferences remain safe and defaults do not disable shortcuts',()=>{
 for(const value of [null,undefined,42,'bad',[]])assert.deepEqual(normalizePreferences(value),{largeText:false,contrast:false,underline:false,reduceMotion:false,disableShortcuts:false});
 assert.deepEqual(normalizePreferences({largeText:true,contrast:'true',underline:1,reduceMotion:true,disableShortcuts:true,unknown:true}),{largeText:true,contrast:false,underline:false,reduceMotion:true,disableShortcuts:true});
});
