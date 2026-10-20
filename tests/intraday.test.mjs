import test from "node:test";
import assert from "node:assert/strict";
import {parseCSV, analyze} from "../analyzer.mjs";

test("1-minute candles do not collapse into one row for same date",()=>{
 const records=["Date,Open,High,Low,Close,Volume,Ticker"];
 for(let i=0;i<40;i++){
   const stamp="2026-10-20 09:"+String(i).padStart(2,"0")+":00",close=100+i/10;
   records.push([stamp,close-.1,close+.4,close-.5,close,100+i,"AAPL"].join(","));
 }
 const bars=parseCSV(records.join("\n"));
 assert.equal(bars.length,40);
 assert.equal(bars[0].date,"2026-10-20 09:00:00");
 assert.equal(bars.at(-1).date,"2026-10-20 09:39:00");
 assert.equal(bars.at(-1).ticker,"AAPL");
 assert.ok(analyze(bars).atr14>0);
});

test("UNIX timestamp input retains minute resolution",()=>{
 const lines=["time,open,high,low,close,volume"];
 for(let i=0;i<25;i++){
   const unix=Date.UTC(2026,9,20,9,i)/1000,close=150+i/10;
   lines.push([unix,close,close+2,close-2,close,1000].join(","));
 }
 const bars=parseCSV(lines.join("\n"));
 assert.equal(bars.length,25);
 assert.equal(bars[0].date,"2026-10-20 09:00:00");
 assert.equal(bars.at(-1).date,"2026-10-20 09:24:00");
});

test("timezone-offset ISO timestamps convert consistently into UTC",()=>{
 const rows=parseCSV("time,open,high,low,close\n2026-10-20T12:30:00+03:00,100,110,90,105\n2026-10-20T12:31:00+03:00,105,111,100,108");
 assert.equal(rows[0].date,"2026-10-20 09:30:00");
 assert.equal(rows[1].date,"2026-10-20 09:31:00");
});

test("daily candles continue parsing as day-only labels",()=>{
 const rows=parseCSV("Date,Open,High,Low,Close\n2026-10-19,100,110,90,105\n2026-10-20,105,111,100,108");
 assert.equal(rows.length,2);
 assert.equal(rows[1].date,"2026-10-20");
});
