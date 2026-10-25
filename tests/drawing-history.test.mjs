import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingHistory} from '../drawing-history.mjs';
test('undo and redo restore full snapshots, including clearing all drawings',()=>{const h=drawingHistory();h.commit([{tool:'text',text:'רמה'}]);h.commit([]);assert.deepEqual(h.undo(),[{tool:'text',text:'רמה'}]);assert.deepEqual(h.undo(),[]);assert.deepEqual(h.redo(),[{tool:'text',text:'רמה'}]);assert.deepEqual(h.redo(),[])});
test('a new drawing after undo invalidates the abandoned redo branch',()=>{const h=drawingHistory();h.commit([1]);h.commit([2]);h.undo();h.commit([3]);assert.equal(h.canRedo(),false);assert.deepEqual(h.redo(),[3])});
test('history never mutates caller-owned drawings or returned snapshots',()=>{const a=[{price:100}],h=drawingHistory(a);a[0].price=1;const v=h.value();v[0].price=2;assert.equal(h.value()[0].price,100);h.commit([{price:200}]);const u=h.undo();u[0].price=3;assert.equal(h.value()[0].price,100)});
test('switching dataset clears undo and redo so drawings cannot leak between symbols',()=>{const h=drawingHistory([1]);h.commit([2]);h.undo();h.reset([9]);assert.equal(h.canRedo(),false);assert.equal(h.canUndo(),false);assert.deepEqual(h.undo(),[9])});
test('history is bounded and unchanged snapshots do not create phantom undo steps',()=>{const h=drawingHistory([],2);h.commit([]);assert.equal(h.canUndo(),false);h.commit([1]);h.commit([2]);h.commit([3]);assert.deepEqual(h.undo(),[2]);assert.deepEqual(h.undo(),[1]);assert.equal(h.canUndo(),false)});
