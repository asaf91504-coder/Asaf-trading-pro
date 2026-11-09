import test from 'node:test';
import assert from 'node:assert/strict';
import {requestsChartAnalysis,hasAnalysisCandles} from '../chart-analysis-request.mjs';
import {parseChartCommand} from '../chat-chart-actions.mjs';

test('chart analysis shortcuts require candles; lessons and ordinary conversation do not',()=>{
 for(const question of ['נתח את הגרף','תנתח את הגרף הנוכחי','תנתח את הגרף ואת המגמה','מה המגמה לפי הגרף?','מה דעתך על הגרף','analyze the chart','explain this chart','תנתח NVDA'])assert.equal(requestsChartAnalysis(question,{command:parseChartCommand(question,{currentSymbol:'AAPL'})}),true,question);
 for(const question of ['שלום','איך מנתחים גרף?','כיצד לקרוא גרף','how do I analyze a chart?','what is a stock?','הסבר מהו RSI','הוסף MA20 ולמה הוא חשוב?','analysis'])assert.equal(requestsChartAnalysis(question,{command:parseChartCommand(question,{currentSymbol:'AAPL'})}),false,question);
});
test('analysis data must match symbol and interval and include enough actual candles',()=>{
 const data={symbol:'NVDA',interval:'1day',bars:Array(21).fill({close:1})};
 assert.equal(hasAnalysisCandles(data,'NVDA','1day'),true);
 for(const [value,symbol,interval] of [[null,'NVDA','1day'],[data,'AAPL','1day'],[data,'NVDA','1week'],[{...data,bars:[]},'NVDA','1day']])assert.equal(hasAnalysisCandles(value,symbol,interval),false);
});
