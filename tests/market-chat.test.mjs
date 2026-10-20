import test from "node:test";
import assert from "node:assert/strict";
import {parseCSV} from "../analyzer.mjs";
import {stockContext,answerStockQuestion} from "../market-chat.mjs";
function bars(count=160){
 return Array.from({length:count},(_,i)=>{
  const close=100+i*.5;
  return {date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),open:close-.3,high:close+1,low:close-1,close,volume:100+i};
 });
}
test("CSV supports TradingView Unix timestamps",()=>{
 const source="time,open,high,low,close,volume\n1735776000,99,105,97,100,100\n1735862400,100,107,99,102,110";
 const rows=parseCSV(source);
 assert.equal(rows[0].date,"2025-01-02");
 assert.equal(rows[0].open,99);
 assert.equal(rows.length,2);
});
test("CSV supports ISO date and optional open",()=>{
 const rows=parseCSV("Date,High,Low,Close\n2026-10-01,12,10,11\n2026-10-02,13,11,12");
 assert.equal(rows[0].open,null);
});
test("cannot analyze fewer than 21 candles",()=>assert.throws(()=>stockContext("AAPL",bars(20)),/21/));
test("extracts actual historical price context",()=>{
 const result=stockContext("NASDAQ:NVDA",bars());
 assert.equal(result.symbol,"NASDAQ:NVDA");
 assert.equal(result.bars,160);
 assert.equal(result.candleDirection,"עולה");
 assert.ok(result.atr14>0);
});
test("no CSV never implies live access",()=>{
 const reply=answerStockQuestion("תנתח לי את NVDA");
 assert.match(reply,/אין עדיין נתוני גרף/);
 assert.match(reply,/TradingView/);
});
test("stock answers include input symbol and date",()=>{
 const ctx=stockContext("NASDAQ:NVDA",bars());
 const reply=answerStockQuestion("נתח את הגרף",ctx);
 assert.ok(reply.includes(ctx.date));
 assert.ok(reply.includes(ctx.symbol));
 assert.match(reply,/MA20/);
 assert.match(reply,/ATR14/);
});
test("earnings are not hallucinated",()=>{
 const reply=answerStockQuestion("מה הדוח האחרון?",stockContext("AAPL",bars()));
 assert.match(reply,/אין לי גישה לדוחות/);
});
test("nonfinancial questions are rejected",()=>{
 const reply=answerStockQuestion("יש לך מתכון לעוגה?");
 assert.match(reply,/שוק ההון בלבד/);
});
test("breakout and relative volume use previous days",()=>{
 const series=bars(21),last=series.at(-1);
 last.high=200;last.close=190;last.volume=1000;
 const context=stockContext("TEST",series);
 assert.equal(context.breakout20,true);
 assert.ok(context.volumeRatio>1);
});
