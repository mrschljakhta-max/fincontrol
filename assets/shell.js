(function(){
'use strict';
// One shared local MIT-licensed Tabler SVG sprite for all working FINCONTROL modules.
const tablerIcon={
 dashboard:'layout-dashboard',ledger:'notes',debt:'credit-card',calendar:'calendar-event',
 goal:'target-arrow',reserve:'shield-check',home:'home',import:'file-import',
 audit:'file-check',backup:'device-floppy',rules:'adjustments-horizontal',
 more:'dots',close:'x',search:'search'
};
function icon(name){
 const symbol=tablerIcon[name]||'layout-dashboard';
 return '<svg class="icon icon-tabler" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="assets/icons/tabler-sprite.svg#ti-'+symbol+'"></use></svg>';
}
const links=[['analytics.html','Дашборд','dashboard'],['ledger.html','Журнал і огляд','ledger'],['calendar.html','Календар','calendar'],['goals.html','Цілі та сценарії','goal'],['debts.html','Кредити','debt'],['plan.html','Фінансовий план','calendar'],['reserve.html','Фінансова подушка','reserve'],['home.html','Моє житло','home'],['data-center.html','Керування даними','backup'],['privat-import.html','Імпорт Приват24','import'],['chat-import.html','Імпорт операцій','import'],['audit.html','Аудитор записів','audit'],['smart.html','Правила імпорту','rules'],['diagnostics.html','Діагностика','audit']];
const current=location.pathname.split('/').pop()||'index.html',premium=document.body.classList.contains('fc-premium');
if(!premium)document.body.classList.add('fc-unified');
let sidebar=document.querySelector('.sidebar');if(!sidebar){sidebar=document.createElement('aside');sidebar.className='sidebar';sidebar.setAttribute('aria-label','Навігація FINCONTROL');document.body.prepend(sidebar)}
const sections=[
 {key:'core',title:'ОСНОВНЕ',items:links.slice(0,5)},
 {key:'planning',title:'ПЛАНУВАННЯ',items:links.slice(5,8)},
 {key:'tools',title:'ІНСТРУМЕНТИ',items:links.slice(8)}
];
const GROUP_KEY='fincontrol-nav-groups-v1';
let savedGroups={};try{const v=JSON.parse(localStorage.getItem(GROUP_KEY));if(v&&typeof v==='object'&&!Array.isArray(v))savedGroups=v}catch{}
const navLink=([href,label,key])=>'<a class="nav-link'+(href===current?' is-active':'')+'" href="'+href+'"'+(href===current?' aria-current="page"':'')+'>'+icon(key)+'<span>'+label+'</span></a>';
const navHTML=sections.map(section=>section.key==='core'
 ?'<div class="fc-nav-section"><p class="nav-caption">'+section.title+'</p>'+section.items.map(navLink).join('')+'</div>'
 :'<details class="fc-nav-group" data-group="'+section.key+'"'+((section.items.some(item=>item[0]===current)||savedGroups[section.key]===true)?' open':'')+'><summary>'+section.title+'<span class="fc-nav-chevron" aria-hidden="true">⌄</span></summary><div class="fc-nav-group-links">'+section.items.map(navLink).join('')+'</div></details>'
).join('');
sidebar.innerHTML='<a class="brand" href="analytics.html" aria-label="FINCONTROL — дашборд"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 20V4h14M5 11h10" stroke="currentColor" stroke-width="2.7"/><path d="m15 20 4-4" stroke="currentColor" stroke-width="2.7"/></svg></span><span>FIN<span class="brand-light">CONTROL</span></span></a><nav class="site-nav" aria-label="Основні розділи">'+navHTML+'</nav><div class="sidebar-note"><div><strong>Локальна приватність</strong><p>Твої фінансові дані залишаються в цьому браузері.</p></div></div><div class="sidebar-bottom"><span class="status-dot"></span> FINCONTROL · 2026</div>';
sidebar.querySelectorAll('.fc-nav-group').forEach(group=>group.addEventListener('toggle',()=>{savedGroups[group.dataset.group]=group.open;try{localStorage.setItem(GROUP_KEY,JSON.stringify(savedGroups))}catch{}}));
function dialog(id,cls,title){const d=document.createElement('dialog');d.id=id;d.className=cls;d.setAttribute('aria-label',title);return d}
const more=dialog('fc-more','fc-modal','Усі розділи');more.innerHTML='<div class="fc-drawer-head"><h2>Усі розділи</h2><button class="fc-icon-button" aria-label="Закрити" data-close="fc-more">'+icon('close')+'</button></div><nav class="fc-more-links">'+sections.map(section=>'<div class="fc-more-group"><p class="fc-more-title">'+section.title+'</p>'+section.items.map(([href,label])=>'<a href="'+href+'"'+(href===current?' aria-current="page" class="is-active"':'')+'>'+label+'</a>').join('')+'</div>').join('')+'</nav>';document.body.append(more);
const mobile=document.createElement('nav');mobile.className='fc-mobile-nav';mobile.setAttribute('aria-label','Мобільна навігація');mobile.innerHTML='<a href="analytics.html" class="'+(current==='analytics.html'?'is-active':'')+'">'+icon('dashboard')+'<span>Дашборд</span></a><a href="analytics.html#operations">'+icon('ledger')+'<span>Операції</span></a><a href="calendar.html" class="'+(current==='calendar.html'?'is-active':'')+'">'+icon('calendar')+'<span>Календар</span></a><button type="button" id="fc-more-open">'+icon('more')+'<span>Ще</span></button>';document.body.append(mobile);document.getElementById('fc-more-open').onclick=()=>more.showModal();
const command=dialog('fc-command','fc-command','Швидкі команди');command.innerHTML='<div class="fc-drawer-head"><h2>Куди перейдемо?</h2><button class="fc-icon-button" data-close="fc-command" aria-label="Закрити">'+icon('close')+'</button></div><label class="sr-only" for="fc-command-search">Пошук розділів і дій</label><input id="fc-command-search" type="search" placeholder="Пошук розділу або дії…" autocomplete="off"><div id="fc-command-results"></div><p class="fc-footnote">Ctrl K — відкрити · Esc — закрити</p>';document.body.append(command);
const commands=[...links.map(([href,label])=>({href,label})),{href:'analytics.html#new',label:'Додати операцію'},{href:'analytics.html#goals',label:'Симулятор сценаріїв'}];
function drawCommands(){const q=document.getElementById('fc-command-search').value.toLowerCase().trim(),host=document.getElementById('fc-command-results');host.replaceChildren();for(const c of commands.filter(c=>c.label.toLowerCase().includes(q))){const a=document.createElement('a');a.href=c.href;a.textContent=c.label;host.append(a)}if(!host.children.length)host.textContent='Нічого не знайдено';}
function showCommand(){drawCommands();command.showModal();document.getElementById('fc-command-search').focus()}
document.getElementById('command-open')?.addEventListener('click',showCommand);document.getElementById('fc-command-search').oninput=drawCommands;
document.getElementById('fc-command-search').onkeydown=e=>{if(e.key==='Enter'){const a=command.querySelector('#fc-command-results a');if(a){e.preventDefault();a.click();command.close()}}if(e.key==='ArrowDown')command.querySelector('#fc-command-results a')?.focus()};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(command.open)command.close();else showCommand()}});
document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close)document.getElementById(close.dataset.close)?.close();if(e.target instanceof HTMLDialogElement){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
window.addEventListener('storage',e=>{if(premium||!e.key?.startsWith('fincontrol-')||e.key==='fincontrol-transaction-v2'||document.getElementById('fc-data-notice'))return;const n=document.createElement('div');n.id='fc-data-notice';n.className='fc-data-notice';n.setAttribute('role','status');n.append(document.createTextNode('Дані змінено в іншій вкладці. Онови сторінку перед збереженням.'));const b=document.createElement('button');b.textContent='Оновити сторінку';b.onclick=()=>location.reload();n.append(b);document.body.append(n)});
window.addEventListener('error',e=>{if(e.message?.includes('іншій вкладці'))alert(e.message)});
})();
