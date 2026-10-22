/* Run: node --test tests/experience-design-system.test.cjs
   Presentation and UI interaction tests — never touch a user's financial data. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html=read('experience.html');
const styles=read('assets/experience-design-system.css');
const src=read('assets/experience-design-system.js');

class MockElement {
 constructor(id){
  this.id=id;this.hidden=id==='ex-mobile-nav';this.attrs=new Map();this.handlers={};
  this.textContent='';this.focused=false;this.clicks=0;
  this.children=[];
 }
 setAttribute(n,v){this.attrs.set(n,String(v))}
 getAttribute(n){return this.attrs.get(n)}
 addEventListener(n,fn){(this.handlers[n]??=[]).push(fn)}
 click(){
  this.clicks++;
  for(const cb of this.handlers.click||[])cb({target:this});
 }
 focus(){this.focused=true}
 contains(target){return target===this||this.children.includes(target)}
 closest(selector){return selector.includes('a[href^=')?this._link?this:null:null}
}
function fixture(){
 const ids=['ex-mobile-menu-toggle','ex-mobile-nav','ex-mobile-motion','ex-mobile-privacy','ex-motion-toggle','ex-privacy-toggle'];
 const elements=new Map(ids.map(id=>[id,new MockElement(id)]));
 const evDoc=new Map(),evWin=new Map(),classes=new Set();
 const el=id=>elements.get(id);
 el('ex-motion-toggle').setAttribute('aria-pressed','true');
 el('ex-privacy-toggle').setAttribute('aria-pressed','false');
 el('ex-mobile-menu-toggle').setAttribute('aria-expanded','false');
 el('ex-motion-toggle').addEventListener('click',()=>{
  const button=el('ex-motion-toggle');
  button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
 });
 el('ex-privacy-toggle').addEventListener('click',()=>{
  const button=el('ex-privacy-toggle');
  button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
 });
 const document={
  body:{classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k),contains:k=>classes.has(k)}},
  getElementById:el,
  addEventListener:(k,cb)=>evDoc.set(k,cb)
 };
 const window={innerWidth:800,addEventListener:(k,cb)=>evWin.set(k,cb)};
 vm.runInNewContext(src,{document,window},{timeout:3000});
 const nav=el('ex-mobile-nav');
 return {el,nav,classes,evDoc,evWin,document,window,click:id=>el(id).click()};
}
test('head loads one isolated design system after all visual assets',()=>{
 assert.match(html,/href="assets\/experience-design-system.css\?v=3"/);
 assert.match(html,/src="assets\/experience-design-system.js\?v=2"/);
 assert.ok(html.indexOf('experience-design-system.css')>html.indexOf('experience-premium-phone.css'));
 assert.match(html,/src="assets\/experience.js\?v=10"/);
});
test('navigation has six matching scene anchors and mobile menu accessibility',()=>{
 const chapterIDs=['overview','calendar','credits','reserve','housing','analytics'];
 for(const id of chapterIDs){
  assert.match(html,new RegExp('id="'+id+'"'));
  const links=html.match(new RegExp('data-chapter-nav="'+id+'"','g'))||[];
  assert.equal(links.length,2,id+' desktop and mobile link');
 }
 assert.match(html,/aria-controls="ex-mobile-nav"/);
 assert.match(html,/aria-expanded="false"/);
 assert.match(html,/id="ex-mobile-nav"[^>]+hidden/);
});
test('approved typographic tokens, comfortable touch targets and all section variants exist',()=>{
 for(const rule of ['--ex-text-nav:15px','--ex-text-body:16px','--ex-touch:44px','--ex-header-size:78px'])
  assert.ok(styles.includes(rule),rule);
 for(const id of ['#overview','#credits','#reserve','#housing','#analytics','.ex-finish'])
  assert.ok(styles.includes(id),id);
 assert.match(styles,/\.ex-page \.ex-navigation a\s*\{/);
 assert.match(styles,/\.ex-page \.ex-calendar-day\s*\{/);
 assert.match(styles,/@media\(max-width:1090px\)/);
 assert.match(styles,/@media\(max-width:680px\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 const opens=(styles.match(/\{/g)||[]).length,closes=(styles.match(/\}/g)||[]).length;
 assert.equal(opens,closes);
});
test('mobile nav opens and closes with accessible status and Escape focus restoration',()=>{
 const f=fixture();
 assert.equal(f.nav.hidden,true);
 f.click('ex-mobile-menu-toggle');
 assert.equal(f.nav.hidden,false);
 assert.equal(f.el('ex-mobile-menu-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(f.classes.has('ex-mobile-nav-open'),true);
 f.evDoc.get('keydown')({key:'Escape'});
 assert.equal(f.nav.hidden,true);
 assert.equal(f.el('ex-mobile-menu-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(f.el('ex-mobile-menu-toggle').focused,true);
});
test('outside click and viewport changes close the menu',()=>{
 const f=fixture();
 f.click('ex-mobile-menu-toggle');
 f.evDoc.get('click')({target:new MockElement('outside')});
 assert.equal(f.nav.hidden,true);
 f.click('ex-mobile-menu-toggle');
 f.window.innerWidth=1200;
 f.evWin.get('resize')();
 assert.equal(f.nav.hidden,true);
});
test('mobile privacy and motion buttons reuse original controls, without financial writes',()=>{
 const f=fixture();
 f.click('ex-mobile-menu-toggle');
 assert.equal(f.el('ex-mobile-motion').getAttribute('aria-pressed'),'true');
 assert.equal(f.el('ex-mobile-privacy').getAttribute('aria-pressed'),'false');
 f.click('ex-mobile-motion');
 assert.equal(f.el('ex-motion-toggle').getAttribute('aria-pressed'),'false');
 assert.equal(f.el('ex-mobile-motion').getAttribute('aria-pressed'),'false');
 f.click('ex-mobile-privacy');
 assert.equal(f.el('ex-privacy-toggle').getAttribute('aria-pressed'),'true');
 assert.equal(f.el('ex-mobile-privacy').getAttribute('aria-pressed'),'true');
 assert.doesNotMatch(src,/FCStore|\.update\(/);
});
test('month controls and typed expense-ring animation are provided',()=>{
 for(const id of ['ex-calendar-prev','ex-calendar-next','ex-calendar-today'])
  assert.match(html,new RegExp('id="'+id+'"'));
 const controller=read('assets/experience.js');
 assert.match(controller,/function changeCalendarMonth\(delta\)/);
 assert.match(controller,/calendarAnchor=C\.monthStart/);
 assert.match(controller,/refreshData\(\); \/\/ Read-only rerender/);
 assert.match(styles,/@property --ex-donut-angle/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
});
