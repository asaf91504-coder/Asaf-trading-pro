import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANS,planFor,consentFor,quotaWindow,usageDecision,estimateMonthlyCost} from '../server/subscription-policy.mjs';
test('trial and monthly tiers match approved prices and message limits',()=>{
  assert.deepEqual(Object.values(PLANS).map(p=>[p.priceUSD,p.dailyMessages]),[[0,7],[22,40],[45,100]]);
  assert.equal(PLANS.trial.trialDays,14);
  assert.notEqual(consentFor('pro'),consentFor('max'));
  assert.throws(()=>consentFor('trial'));
  for(const id of ['constructor','toString','__proto__','legacy']) assert.throws(()=>planFor(id));
});
test('boundary blocks without charging and offers only an explicit upgrade',()=>{
  for(const tier of Object.keys(PLANS)){
    const cap=PLANS[tier].dailyMessages;
    assert.equal(usageDecision({tier,used:cap-1}).allowed,true);
    const exhausted=usageDecision({tier,used:cap});
    assert.equal(exhausted.allowed,false);assert.equal(exhausted.remaining,0);
    assert.equal(exhausted.route,null);assert.equal(exhausted.autoCharge,false);
  }
  assert.equal(usageDecision({tier:'max',used:100}).upgradeTo,null);
});
test('simple requests stay economical; complex requests respect premium ceiling',()=>{
  assert.equal(usageDecision({tier:'pro',used:10,premiumUsed:0,complex:false}).route,'economy');
  assert.equal(usageDecision({tier:'pro',used:10,premiumUsed:7,complex:true}).route,'premium');
  assert.equal(usageDecision({tier:'pro',used:10,premiumUsed:8,complex:true}).route,'economy');
  assert.throws(()=>usageDecision({tier:'pro',used:-1}));
  assert.throws(()=>usageDecision({tier:'pro',used:1,premiumUsed:2}));
});
test('reset uses UTC midnight across month and year boundaries',()=>{
  assert.deepEqual(quotaWindow(Date.parse('2026-12-31T23:59:59Z')),{day:'2026-12-31',resetsAt:Date.parse('2027-01-01T00:00:00Z')});
});
test('full utilization estimates and doubled context are explicit and reproducible',()=>{
  const pro=estimateMonthlyCost({users:100,messagesPerDay:40});
  const max=estimateMonthlyCost({users:100,messagesPerDay:100});
  assert.equal(pro.messages,120000);assert.equal(pro.total,696);
  assert.equal(max.total,1740);
  assert.equal(estimateMonthlyCost({users:100,messagesPerDay:40,inputTokens:10000,outputTokens:2000}).total,1272);
  assert.equal(estimateMonthlyCost({users:100,messagesPerDay:100,inputTokens:10000,outputTokens:2000}).total,3180);
  assert.throws(()=>estimateMonthlyCost({users:100,messagesPerDay:40,premiumShare:2}));
});
