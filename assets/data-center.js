(async function(){
'use strict';
const S=globalThis.FCStore,X=globalThis.FCDataTransfer,$=id=>document.getElementById(id);
const MAX_SIZE=25*1024*1024,KEYS_WITH_FINANCES=new Set([
 'fincontrol-offline-v1','fincontrol-debts-v1','fincontrol-plan-v1','fincontrol-emergency-v1',
 'fincontrol-home-v1','fincontrol-calendar-v1','fincontrol-goals-v1','fincontrol-smart-rules-v1',
 'fincontrol-privat-rules-v1','fincontrol-audit-changelog-v1'
]);
let pending=null,baseline=null,hasCurrent=false,exportStarted=false,busy=false;
const human=n=>new Intl.NumberFormat('uk-UA').format(n);
const descriptions={add:'Буде додано',replace:'Буде замінено',delete:'Буде видалено',same:'Без змін'};
const cssStates={add:'is-add',replace:'is-replace',delete:'is-delete',same:'is-same'};
const readableCount=n=>n===null?'—':human(n);
function status(message,isError=false){
 const box=$('global-status');box.hidden=false;box.classList.toggle('is-error',isError);box.textContent=message;
}
function errorMessage(message){
 $('file-error').hidden=false;$('file-error').textContent=message;
 status(message,true);
}
function snapshot(){
 return X.storageSnapshot(localStorage);
}
function sameSnapshot(a,b){
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 return [...keys].every(k=>Object.hasOwn(a,k)===Object.hasOwn(b,k)&&a[k]===b[k]);
}
function refreshCurrent(){
 const summary=X.outline(snapshot());
 $('current-modules').textContent=human(summary.keys);
 $('current-entries').textContent=human(summary.transactions);
 $('current-credits').textContent=human(summary.credits);
 if(summary.invalid.length)status('У цьому браузері знайдено пошкоджені дані: '+summary.invalid.map(X.label).join(', ')+'. Створи резервну копію перед будь-якими діями.',true);
}
function resetPreview(clearFile=false){
 pending=null;baseline=null;exportStarted=false;busy=false;
 $('backup-preview').hidden=true;$('restore-confirm').disabled=true;
 $('backup-confirmed').checked=false;$('confirm-text').value='';
 $('file-error').hidden=true;$('file-error').textContent='';
 if(clearFile){$('backup-file').value='';$('selected-file').textContent='Файл ще не вибрано.'}
}
function setRestoreEnabled(){
 let enabled=Boolean(pending)&&!busy&&pending.diff.changed>0;
 if(hasCurrent)enabled=enabled&&exportStarted&&$('backup-confirmed').checked&&$('confirm-text').value.trim()==='ВІДНОВИТИ';
 $('restore-confirm').disabled=!enabled;
}
function addCounter(host,label,count,kind){
 const node=document.createElement('span');node.className='fc-data-diff-counter '+(kind?'is-'+kind:'');
 node.textContent=label+': '+human(count);host.append(node);
}
function makeCell(row,text,klass=''){
 const td=document.createElement('td');td.textContent=text;if(klass)td.className=klass;row.append(td);
}
function renderPreview(){
 if(!pending)return;
 const {inspected,diff,name}=pending;
 $('backup-preview').hidden=false;
 const created=inspected.backup.createdAt;
 const stamp=typeof created==='string'&&!Number.isNaN(Date.parse(created))?new Date(created).toLocaleString('uk-UA'):'Не вказана';
 $('preview-date').textContent=stamp;
 $('preview-entries').textContent=human(inspected.info.transactions);
 $('preview-credits').textContent=human(inspected.info.credits);
 $('preview-modules').textContent=human(inspected.info.keys);
 const counters=$('preview-counters');counters.replaceChildren();
 addCounter(counters,'Нових',diff.summary.add,'add');
 addCounter(counters,'Заміняться',diff.summary.replace,'replace');
 addCounter(counters,'Видаляться',diff.summary.delete,'delete');
 addCounter(counters,'Без змін',diff.summary.same,'same');
 const tbody=$('preview-rows');tbody.replaceChildren();
 for(const row of diff.rows){
  const tr=document.createElement('tr');
  makeCell(tr,row.label);
  makeCell(tr,readableCount(row.before));
  makeCell(tr,readableCount(row.after));
  makeCell(tr,descriptions[row.action],'fc-data-state '+cssStates[row.action]);
  tbody.append(tr);
 }
 const warn=$('preview-warnings');warn.replaceChildren();const cautions=[...inspected.warnings];
 if(diff.summary.delete)cautions.unshift('У поточному браузері є '+diff.summary.delete+' модулів, яких немає в копії. Після повного відновлення вони будуть видалені.');
 if(!diff.changed)cautions.unshift('Файл містить ті самі локальні дані. Нічого замінювати не потрібно.');
 if(!hasCurrent)cautions.push('На цьому пристрої не знайдено наявних фінансових модулів. Імпорт створить дані локально.');
 warn.hidden=!cautions.length;
 for(const message of cautions){const p=document.createElement('p');p.textContent='! '+message;warn.append(p)}
 $('replace-guard').hidden=!hasCurrent;
 $('restore-explanation').textContent=hasCurrent
  ?'Це повна заміна поточних даних, а не об’єднання. Нові записи, яких немає у файлі, зникнуть. Перед продовженням збережи чинну копію.'
  :'Файл перевірено. У цьому браузері немає поточних фінансових модулів, які треба захищати від заміни.';
 $('restore-confirm').textContent=hasCurrent?'Замінити дані цього браузера':'Відновити дані з файлу';
 $('selected-file').textContent='Обрано: '+name+' · '+human(Math.round(inspected.bytes/1024))+' КБ вмісту';
 setRestoreEnabled();
}
async function parseFile(file){
 resetPreview();
 if(!file)return;
 if(file.size>MAX_SIZE)throw Error('Файл більший за 25 МБ. Відновлення скасовано.');
 if(file.size===0)throw Error('Файл порожній.');
 $('selected-file').textContent='Перевіряю файл: '+file.name+'…';
 await S.ready;
 let backup;
 try{backup=JSON.parse(await file.text())}
 catch{throw Error('Не вдалося прочитати JSON. Перевір цілісність резервної копії.')}
 const inspected=X.inspectBackup(backup,S),current=snapshot(),diff=X.compare(current,backup.data);
 baseline=current;
 hasCurrent=Object.keys(current).some(k=>KEYS_WITH_FINANCES.has(k)||!['fincontrol-nav-groups-v1','fincontrol-ui-compact-v1','fincontrol-dashboard-v2'].includes(k));
 pending={inspected,diff,name:file.name};
 $('backup-confirmed').checked=false;$('confirm-text').value='';exportStarted=false;
 renderPreview();
 $('backup-preview').scrollIntoView({behavior:'smooth',block:'start'});
 status('Копію перевірено. Переглянь перелік змін перед відновленням.');
}
async function startExport(beforeRestore=false){
 if(busy)return;
 try{
  const current=snapshot();
  await S.backup();
  if(beforeRestore){
   if(!pending||!sameSnapshot(baseline,current)){
    exportStarted=false;
    setRestoreEnabled();
    throw Error('Поточні дані змінилися після перевірки файлу. Обери резервну копію ще раз.');
   }
   exportStarted=true;setRestoreEnabled();
   status('Завантаження поточної копії розпочато. Перевір, що файл справді збережений, перш ніж підтверджувати заміну.');
  }else{
   status('Завантаження повної копії розпочато. Перевір її в папці завантажень.');
   $('export-detail').textContent='Копію сформовано. Переконайся, що браузер зберіг JSON-файл.';
  }
 }catch(e){status('Не вдалося створити копію: '+e.message,true)}
}
$('backup-export').addEventListener('click',()=>startExport(false));
$('backup-before-restore').addEventListener('click',()=>startExport(true));
$('backup-confirmed').addEventListener('change',setRestoreEnabled);
$('confirm-text').addEventListener('input',setRestoreEnabled);
$('backup-file').addEventListener('change',async e=>{
 try{await parseFile(e.target.files?.[0])}
 catch(err){resetPreview();$('selected-file').textContent='Файл не прийнято.';errorMessage(err.message)}
});
const drop=$('backup-drop');
for(const evt of ['dragenter','dragover'])drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.add('is-dragover')});
for(const evt of ['dragleave','drop'])drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.remove('is-dragover')});
drop.addEventListener('drop',async e=>{
 try{await parseFile(e.dataTransfer?.files?.[0])}
 catch(err){resetPreview();$('selected-file').textContent='Файл не прийнято.';errorMessage(err.message)}
});
$('cancel-preview').addEventListener('click',()=>{
 resetPreview(true);
 status('Відновлення скасовано. Дані не змінювалися.');
});
$('restore-confirm').addEventListener('click',async()=>{
 if(!pending||busy)return;
 const latest=snapshot();
 if(!sameSnapshot(baseline,latest)){
  status('Дані змінилися після перевірки. Потрібно заново обрати резервну копію.',true);
  resetPreview();return;
 }
 setRestoreEnabled();
 if($('restore-confirm').disabled)return;
 const message=hasCurrent
  ?'ЗАМІНИТИ поточні дані FINCONTROL даними з вибраного файлу? Усі локальні модулі, яких немає у файлі, буде видалено.'
  :'Відновити фінансові дані з вибраної копії в цьому браузері?';
 if(!confirm(message))return;
 busy=true;setRestoreEnabled();
 try{
  const expected=Object.create(null);
  for(const k of new Set([...Object.keys(baseline),...Object.keys(pending.inspected.backup.data)])){
   expected[k]=Object.hasOwn(baseline,k)?baseline[k]:null;
  }
  await S.restore(pending.inspected.backup,expected);
  status('Дані відновлено. Перезавантажуємо FINCONTROL…');
  location.reload();
 }catch(err){
  busy=false;setRestoreEnabled();
  status('Відновлення не виконано: '+err.message,true);
 }
});
try{
 await S.ready;
 refreshCurrent();
}catch(err){
 status('Помилка доступу до локальних даних: '+err.message,true);
 $('backup-export').disabled=true;$('backup-file').disabled=true;
}
})();
