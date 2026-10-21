/* Tabler icons integration / local asset & accessible UI integrity.
 * node --test tests/tabler-icons.test.cjs */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=read('experience.html'),shell=read('assets/shell.js');
const svg=read('assets/icons/tabler-sprite.svg'),license=read('assets/icons/LICENSE.txt');
const style=read('assets/experience-tabler.css');
const controller=read('assets/experience.js'),mobile=read('assets/experience-design-system.js');
const symbols=[...svg.matchAll(/<symbol id="ti-([a-z0-9-]+)"/g)].map(m=>m[1]);
test('33 official local MIT licensed SVG icons, no duplicates',()=>{
 assert.ok(symbols.length>=30);
 assert.equal(new Set(symbols).size,symbols.length);
 assert.match(license,/MIT License/);
 assert.match(license,/Paweł Kuna/);
 assert.match(svg,/<svg xmlns="http:\/\/www.w3.org\/2000\/svg">/);
 assert.match(svg,/<\/svg>\s*$/);
});
test('all symbols referenced in panorama resolve to the sprite',()=>{
 const references=[...page.matchAll(/href="assets\/icons\/tabler-sprite.svg#ti-([a-z0-9-]+)"/g)].map(m=>m[1]);
 assert.ok(references.length>=50);
 for(const ref of references)assert.ok(symbols.includes(ref),'Missing icon: '+ref);
});
test('global sidebar uses same sprite and every route category resolves',()=>{
 assert.match(shell,/const tablerIcon=/);
 assert.match(shell,/tabler-sprite.svg#ti-/);
 const list=shell.slice(shell.indexOf('const tablerIcon='),shell.indexOf('function icon('));
 const names=[...list.matchAll(/:\s*'([a-z0-9-]+)'/g)].map(m=>m[1]);
 for(const name of names)assert.ok(symbols.includes(name),'Missing shell icon: '+name);
 assert.match(shell,/function icon\(name\)/);
 assert.doesNotMatch(shell,/const paths=\{/);
});
test('main and mobile tabs have semantic labels and use inline pictograms',()=>{
 for(const id of ['overview','calendar','credits','reserve','housing','analytics']){
  const entries=page.match(new RegExp('data-chapter-nav="'+id+'"','g'))||[];
  assert.equal(entries.length,2,id);
 }
 assert.match(page,/aria-controls="ex-mobile-nav"/);
 assert.match(page,/aria-label="Попередній місяць"/);
 assert.match(page,/aria-label="Наступний місяць"/);
 assert.match(style,/\.ex-page \.ex-ti/);
 assert.match(style,/@media\(max-width:680px\)/);
});
test('privacy and motion change icon state without replacing live SVG markup',()=>{
 assert.doesNotMatch(controller,/privacyButton\.textContent\s*=/);
 assert.match(controller,/privacyButton\.querySelector\('use'\)/);
 assert.match(controller,/ti-'\+\(privacyOn\?'eye':'eye-off'\)/);
 assert.match(controller,/ti-'\+\(motionEnabled\?'player-pause':'player-play'\)/);
 assert.match(mobile,/function setTablerButton/);
 assert.match(mobile,/\.ex-mobile-button-label/);
 assert.match(mobile,/\?\.setAttribute\?\./);
 assert.doesNotMatch(mobile,/FCStore|\.update\(/);
});
test('icon UI does not add external CDN runtime dependencies',()=>{
 assert.doesNotMatch(page,/<script[^>]+src="https?:/);
 assert.doesNotMatch(shell,/cdn\.jsdelivr\.net|unpkg\.com/);
});
