/* Cinematic orbital navigation: no DOM framework, no storage writes. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('experience.html');
const css=read('assets/experience.css');
const analytics=read('assets/analytics.js');

test('three real internal hyperlinks replace aria-hidden decorative tags',()=>{
 const nav=html.match(/<nav class="ex-hero-side ex-reveal"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav,'semantic orbital navigation is present');
 assert.match(nav,/aria-label="Швидкі переходи FINCONTROL"/);
 assert.doesNotMatch(nav,/<nav[^>]*aria-hidden="true"/);
 const hrefs=[...nav.matchAll(/<a class="ex-orbit-tag" href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(hrefs,['analytics.html#income','reserve.html','goals.html']);
 for(const label of ['Надходження','Резерв','Фінансові цілі'])assert.ok(nav.includes(label));
 for(const file of ['analytics.html','reserve.html','goals.html'])
  assert.ok(fs.existsSync(path.join(root,file)),file);
});
test('orbital links remain visible and operable on mobile and with motion off',()=>{
 assert.match(html,/assets\/experience\.css\?v=3/);
 assert.match(css,/\.ex-hero-side\{display:grid\}/);
 assert.doesNotMatch(css,/\.ex-hero-side\{display:none\}/);
 assert.match(css,/\.ex-orbit-tag:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.ex-page\.ex-motion-off \.ex-orbit-tag/);
 assert.match(css,/\.ex-orbit-tag::after/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
test('income deep link selects the real operations journal and income kind',()=>{
 assert.match(read('analytics.html'),/assets\/analytics\.js\?v=9/);
 const start=analytics.indexOf('function routeHash(){');
 const stop=analytics.indexOf('for(const b of document.querySelectorAll(\'[data-view]\'))',start);
 assert.ok(start>0&&stop>start,'router extraction');
 const kind={value:'all'},search={value:'existing'},events=[];
 const ctx={
  location:{hash:'#income'},
  $:id=>id==='detail-kind'?kind:search,
  setView:(v,updateHash)=>events.push(['view',v,updateHash]),
  renderTable:()=>events.push(['render',kind.value,search.value]),
  editEntry:()=>events.push(['edit'])
 };
 vm.runInNewContext('var page=3;'+analytics.slice(start,stop)+'routeHash();result=page;',ctx);
 assert.equal(ctx.result,0);
 assert.equal(kind.value,'income');
 assert.equal(search.value,'');
 assert.equal(JSON.stringify(events),JSON.stringify([['view','operations',false],['render','income','']]));
});
