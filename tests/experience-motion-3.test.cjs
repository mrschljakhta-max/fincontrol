'use strict';
/* FINCONTROL Motion 3.0 contract tests. No access to real browser storage. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('experience.html'),style=read('assets/experience-cinematic-next.css');
const scene=read('assets/experience-cinematic.js'),finance=read('assets/experience.js');
test('all eight chapters have one atmospheric layer and navigable step',()=>{
 const ids=['intro','overview','calendar','credits','reserve','housing','analytics','finish'];
 for(const id of ids){
  const begin=html.indexOf('<section id="'+id+'"'),end=html.indexOf('</section>',begin);
  assert.ok(begin>0&&end>begin,id);
  assert.match(html.slice(begin,end),/class="ex-cine-haze"/);
  assert.ok(html.includes('data-ex-chapter="'+id+'"'));
 }
 assert.equal((html.match(/class="ex-cine-haze"/g)||[]).length,8);
 assert.equal((html.match(/data-ex-chapter="/g)||[]).length,8);
 assert.match(finance,/FCExperienceCinematic\?\.setStage\(at,motionEnabled\)/);
 assert.match(style,/prefers-reduced-motion:reduce/);
});
test('live phone has keyboard-accessible preview buttons and real page links',()=>{
 for(const name of ['income','reserve','home','debt'])assert.ok(html.includes('data-ex-live="'+name+'"'));
 for(const id of ['ex-live-title','ex-live-value','ex-live-caption','ex-live-action'])assert.ok(html.includes('id="'+id+'"'));
 for(const link of ['analytics.html#income','reserve.html','home.html','debts.html'])assert.ok(scene.includes(link));
 assert.match(scene,/renderPreview/);
 assert.doesNotMatch(scene,/FCStore|localStorage|sessionStorage|\.write\(/);
 assert.match(scene,/page\.classList\.contains\('ex-private-on'\)/);
});
test('financial story uses existing monthly actuals, not forecasts or sample numbers',()=>{
 assert.match(html,/id="ex-finance-story"/);
 assert.match(finance,/set\('ex-finance-story',summary\)/);
 assert.match(finance,/totals\.inc>0/);
 assert.match(finance,/privacyOn[\s\S]*?'Фінансова динаміка доступна/);
 assert.match(style,/ex-cine-finance-story/);
});
test('motion 3.0 never replaces the rock, WebGL house or premium phone',()=>{
 for(const id of ['ex-crystal-3d','ex-house-3d','ex-premium-phone-image','ex-morph-shell'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/assets\/experience-cinematic-next\.css\?v=2/);
 assert.match(html,/assets\/experience-cinematic\.js\?v=2/);
 assert.match(html,/assets\/experience\.js\?v=14/);
 assert.doesNotMatch(scene,/requestAnimationFrame/);
 assert.equal((style.match(/\{/g)||[]).length,(style.match(/\}/g)||[]).length);
});
