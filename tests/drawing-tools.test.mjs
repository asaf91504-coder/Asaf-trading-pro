import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingFromAnchors,drawingMeasurement,arrowHead} from '../chart-styles.mjs';
import {personalData,personalBackup,parsePersonalBackup} from '../personal-data.mjs';
const bars=[{date:'2026-10-01',close:100},{date:'2026-10-02',close:120},{date:'2026-10-03',close:90}];
test('precise drawings require exact loaded timestamps and finite positive prices',()=>{
 assert.deepEqual(drawingFromAnchors(bars,'arrow',{date:'2026-10-01',price:'100'},{date:'2026-10-03',price:'90'}),[{index:0,price:100,tool:'arrow'},{index:2,price:90,tool:'arrow'}]);
 for(const point of [{date:'2026-10-04',price:100},{date:'2026-10-01',price:0},{date:'2026-10-01',price:Infinity},{date:'2026-10-01',price:1e13},{date:'2026-10-01',price:true}])assert.throws(()=>drawingFromAnchors(bars,'measure',point,point));
 const intraday=[{date:'2026-10-01 09:30:00',close:100}];assert.throws(()=>drawingFromAnchors(intraday,'vertical',{date:'2026-10-01',price:100}));assert.equal(drawingFromAnchors(intraday,'vertical',{date:'2026-10-01 09:30:00',price:100})[1].index,0);
});
test('measurement reports signed price and bar changes without implying annualized or future returns',()=>{
 const up=drawingMeasurement({index:0,price:100},{index:2,price:120});assert.equal(up.change,20);assert.equal(up.bars,2);assert.ok(Math.abs(up.percent-20)<1e-10);
 const down=drawingMeasurement({index:2,price:120},{index:0,price:90});assert.deepEqual(down,{change:-30,percent:-25,bars:-2});assert.equal(drawingMeasurement({index:0,price:100},{index:0,price:100}).percent,0);
 assert.equal(drawingMeasurement({index:0,price:Number.MIN_VALUE},{index:1,price:1e12}).percent,null);
});
test('arrow heads point back from the destination and zero-length arrows remain finite',()=>{
 const points=arrowHead({x:0,y:0},{x:10,y:0});assert.equal(points.length,2);for(const p of points){assert.ok(p.x<10&&p.x>0);assert.ok(Math.abs(Math.hypot(10-p.x,p.y)-5)<1e-10)}assert.equal(points[0].y,-points[1].y);assert.deepEqual(arrowHead({x:1,y:2},{x:1,y:2}),[]);
});
test('arrows and measurements preserve date/price anchors through account backup round trips',()=>{
 for(const tool of ['arrow','measure']){const data={AAPL:{savedAt:1,lines:[[{date:'2026-10-01',price:100,tool},{date:'2026-10-03',price:90,tool}]]}};assert.deepEqual(personalData('drawings',data),data);assert.deepEqual(parsePersonalBackup(JSON.stringify(personalBackup('drawings',data)),'drawings'),data)}
});
