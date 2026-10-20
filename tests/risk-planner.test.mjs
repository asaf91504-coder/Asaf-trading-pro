import test from 'node:test';
import assert from 'node:assert/strict';
import {planPosition} from '../risk-planner.mjs';
const input={account:10000,riskPercent:1,entry:100,stop:95,target:115,budget:10000};
test('position uses risk budget and calculates actual exposure',()=>{const r=planPosition(input);assert.equal(r.shares,20);assert.equal(r.actualRisk,100);assert.equal(r.positionValue,2000);assert.equal(r.targetProfit,300);assert.equal(r.ratio,3)});
test('tight stop cannot oversize beyond available capital',()=>{const r=planPosition({...input,stop:99.99});assert.equal(r.shares,100);assert.equal(r.positionValue,10000);assert.equal(r.capitalLimited,true);assert.ok(r.actualRisk<r.riskBudget)});
test('allocation limit and whole shares are enforced',()=>{const r=planPosition({...input,budget:550});assert.equal(r.shares,5);assert.equal(r.actualRisk,25);assert.equal(r.actualRiskPercent,.25);assert.equal(planPosition({...input,budget:50}).shares,0)});
test('short position reverses stop and target direction',()=>{const r=planPosition({...input,side:'short',stop:105,target:85});assert.equal(r.shares,20);assert.equal(r.ratio,3);assert.throws(()=>planPosition({...input,side:'short'}))});
test('invalid and non-finite input cannot retain a calculation',()=>{for(const patch of [{account:0},{riskPercent:101},{entry:NaN},{budget:Infinity},{stop:100},{target:90},{side:'invalid'}])assert.throws(()=>planPosition({...input,...patch}))});
