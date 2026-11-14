import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSearchSources} from '../web-search-ui.mjs';
test('search source cards use inert text and safe links with retrieval time',()=>{
 const all=[];const doc={createElement:tag=>{const node={tag,children:[],setAttribute(){},append(v){this.children.push(v)},set innerHTML(_){throw Error('unsafe HTML')}};all.push(node);return node}};
 const parent=doc.createElement('div');parent.ownerDocument=doc;
 renderSearchSources(parent,{status:'available',searchedAt:'2026-11-13',sources:[{id:1,title:'<script>bad</script>',url:'https://source.example/report'},{id:2,title:'bad',url:'javascript:alert(1)'}]});
 const links=all.filter(n=>n.tag==='a');assert.equal(links.length,1);assert.equal(links[0].textContent,'[1] <script>bad</script>');assert.equal(links[0].rel,'noopener noreferrer');assert.match(all.find(n=>n.tag==='small').textContent,/אינו מועד פרסום/);
});
