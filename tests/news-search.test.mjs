import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCachedNews} from '../news-search.mjs';
const items=[{title:'Rocket Lab expands mission',source:'Reuters',symbols:[]},{title:'Apple earnings',source:'Market news',symbols:['AAPL']}];
test('free-text search finds companies outside ticker classification without mutating cache',()=>{assert.deepEqual(filterCachedNews(items,{query:'ROCKET lab'}),[items[0]]);assert.equal(items.length,2)});
test('metadata search includes source and symbol and combines all terms',()=>{assert.deepEqual(filterCachedNews(items,{query:'aapl market'}),[items[1]]);assert.deepEqual(filterCachedNews(items,{query:'Reuters apple'}),[])});
test('explicit symbol filter only uses existing tags and empty search returns cache',()=>{assert.deepEqual(filterCachedNews(items,{symbol:'NASDAQ:AAPL'}),[items[1]]);assert.deepEqual(filterCachedNews(items,{symbol:'RKLB'}),[]);assert.deepEqual(filterCachedNews(items,{query:'  '}),items)});
