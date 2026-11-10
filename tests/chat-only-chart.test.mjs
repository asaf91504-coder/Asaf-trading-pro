import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('customers have a chat entry point and no manual drawing controls or forms',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../terminal-ui.mjs',import.meta.url),'utf8');
 for(const id of ['chartDrawingTool','chartTrend','chartUndo','chartRedo','chartAnchorForm','drawingStartPrice','drawingText'])assert.doesNotMatch(html+ui,new RegExp(id));
 assert.match(html,/<div class="chart-config" hidden aria-hidden="true" inert>/);
 assert.match(ui,/chartChatOnly\.onclick/);assert.match(ui,/דבר עם הצ׳אט על הגרף/);
 for(const id of ['chartZoomIn','chartZoomOut','chartPrev','chartNext','chartFullscreen'])assert.ok(html.includes('id="'+id+'"'));
});
