/* All plan → fact changes run inside FCStore.update's atomic transaction. */
(function(root){
'use strict';
const M=root.FCCalendarModel;
function fresh(data,K,p){
 const state=M.normalize(data[K.calendar]),event=state.events.find(e=>e.id===p.eventId),item=event&&M.occurrence(state,event,p.occurrence,data[K.ledger]);
 if(!item)throw Error('Подію видалено або змінено. Онови календар.');
 if(p.expected&&M.fingerprint(item)!==p.expected)throw Error('Подія або її платежі змінилися. Відкрий її ще раз.');
 data[K.calendar]=state;return item;
}
function book(data,K,p){
 const item=fresh(data,K,p),s=data[K.calendar];
 if(item.settled)throw Error('Факт для цієї події вже внесено.');
 const ledger=data[K.ledger]??={version:1,debtCents:0,entries:[]};
 let entry;
 if(p.existingId){
  entry=ledger.entries.find(e=>e.id===p.existingId&&e.status==='actual');
  if(!entry||entry.calendarKey||entry.kind!==item.kind)throw Error('Ця операція вже прив’язана або не відповідає типу події.');
  if(item.kind==='debt_payment'&&(!item.creditId||entry.creditId!==item.creditId))throw Error('Вибери операцію для відповідного кредиту.');
 }else{
  if(!M.validDate(p.date)||p.date>(p.today||M.today()))throw Error('Фактична операція не може мати майбутню дату.');
  if(!Number.isSafeInteger(p.cents)||p.cents<=0)throw Error('Вкажи коректну суму.');
  if(ledger.entries.some(e=>e.id===p.operationId))throw Error('Цей запис уже збережено.');
  entry={id:p.operationId,date:p.date,kind:item.kind,status:'actual',category:item.name.slice(0,80),cents:p.cents,note:p.note||'Із фінансового календаря'};
  if(item.kind==='debt_payment'){
   const credit=data[K.debts]?.credits.find(c=>c.id===item.creditId);
   if(!credit)throw Error('Спочатку прив’яжи подію до кредиту в реєстрі.');
   if(p.cents>credit.balance)throw Error('Платіж перевищує залишок кредиту. Перевір суму.');
   credit.balance-=p.cents;entry.creditId=credit.id;
   data[K.debts].history.push({id:p.historyId,creditId:credit.id,name:credit.name,date:p.date,kind:'payment',amount:p.cents,operationId:p.operationId});
  }
  if(item.kind==='reserve_withdrawal')throw Error('Зняття з резерву внось через журнал.');
  ledger.entries.push(entry);
 }
 entry.calendarKey=item.key;entry.calendarEventId=item.id;entry.calendarOccurrence=item.occurrence;
 delete s.done[item.key];
 if(p.finalize)s.settled[item.key]=[...item.operationIds,entry.id];else delete s.settled[item.key];
 return entry;
}

/* Convert a journal plan in place: retain its ID, never append a duplicate fact. */
function confirmPlanned(data,K,p){
 const ledger=data[K.ledger];
 const entry=ledger?.entries?.find(x=>x.id===p.entryId);
 if(!entry||entry.status!=='planned')throw Error('План вже виконано або видалено. Онови календар.');
 const snapshot=JSON.stringify([entry.id,entry.date,entry.kind,entry.cents,entry.category,entry.note,entry.status,entry.calendarKey||'']);
 if(snapshot!==p.expected)throw Error('План змінився в іншій вкладці. Відкрий його повторно.');
 if(entry.calendarKey)throw Error('Пов’язаний із календарем план слід завершити через відповідну подію.');
 if(['debt_payment','review'].includes(entry.kind))throw Error('Кредитні платежі проводь у реєстрі кредитів, невизначені операції — після уточнення.');
 if(!M.validDate(p.date)||p.date>(p.today||M.today()))throw Error('Факт не може бути датований майбутнім.');
 if(!Number.isSafeInteger(p.cents)||p.cents<=0)throw Error('Введи правильну фактичну суму.');
 if(entry.kind==='reserve_withdrawal'){
  const opening=Number(data[K.reserve]?.saved||0),initial=Math.round(opening*100);
  if(!Number.isSafeInteger(initial)||initial<0)throw Error('Перевір початкову суму фінподушки.');
  const net=ledger.entries.filter(x=>x.status==='actual').reduce((sum,x)=>sum+(x.kind==='reserve_deposit'?x.cents:x.kind==='reserve_withdrawal'?-x.cents:0),0);
  if(initial+net-p.cents<0)throw Error('Недостатньо коштів у фінансовій подушці.');
 }
 if(ledger.entries.some(x=>x.id!==entry.id&&x.status==='actual'&&entry.sourceKey&&x.sourceKey===entry.sourceKey&&x.source===entry.source))
  throw Error('Фактична операція з цього джерела вже є в журналі. Не створюй дубль.');
 entry.plannedDate=entry.date;
 entry.plannedCents=entry.cents;
 entry.status='actual';
 entry.date=p.date;
 entry.cents=p.cents;
 entry.confirmedFromPlanAt=new Date().toISOString();
 return entry;
}
/* Unlink a booked fact without deleting a real payment or changing credit balances. */
function unlink(data,K,p){
 const item=fresh(data,K,p),ledger=data[K.ledger],s=data[K.calendar];
 const entry=ledger?.entries?.find(x=>x.id===p.operationId&&x.status==='actual'&&x.calendarKey===item.key);
 if(!entry)throw Error('Пов’язану операцію не знайдено. Онови сторінку.');
 delete entry.calendarKey;
 delete entry.calendarEventId;
 delete entry.calendarOccurrence;
 delete s.settled[item.key];
 return entry;
}
function edit(data,K,p){
 const s=M.normalize(data[K.calendar]);data[K.calendar]=s;
 const v=p.values;
 if(!v.name||!M.validDate(v.date)||!M.KINDS.has(v.kind)||!Number.isSafeInteger(v.cents)||v.cents<=0||!M.REPEATS.includes(v.repeat))throw Error('Перевір назву, дату, тип і суму.');
 if(v.repeat==='twice_monthly'&&(!Number.isInteger(v.secondDay)||v.secondDay<1||v.secondDay>31||v.secondDay===Number(v.date.slice(8))))throw Error('Для другого платежу вкажи інший день місяця від 1 до 31.');
 if(v.kind==='debt_payment'&&v.creditId&&!data[K.debts]?.credits.some(c=>c.id===v.creditId))throw Error('Кредит уже видалено.');
 if(!p.eventId){s.events.push({...v,id:p.newId});return}
 const item=fresh(data,K,p),base=s.events.find(e=>e.id===p.eventId);
 // fresh() normalizes into a new object; keep one shared state for edits.
 data[K.calendar]=s;
 if(item.paid&&(v.kind!==item.kind||v.creditId!==item.creditId||v.cents!==item.cents))throw Error('Подія вже має факт. Її суму, тип і кредит змінювати не можна.');
 if(p.scope==='future'&&base.repeat!=='once'){
  if((data[K.ledger]?.entries||[]).some(e=>e.calendarEventId===base.id&&e.calendarOccurrence>=item.occurrence)||Object.keys(s.done).some(k=>k.startsWith(base.id+'|')&&k.slice(base.id.length+1)>=item.occurrence&&s.done[k]))throw Error('Серед наступних подій є виконані. Зміни лише цю подію або почни нову серію після них.');
  base.until=M.addDays(item.occurrence,-1);s.events.push({...v,id:p.newId});
 }else if(base.repeat==='once'){
  s.overrides[item.key]={...(s.overrides[item.key]||{}),...v};
 }else{
  s.overrides[item.key]={...(s.overrides[item.key]||{}),name:v.name,date:v.date,kind:v.kind,cents:v.cents,note:v.note,creditId:v.creditId};
 }
}
function remove(data,K,p){
 const item=fresh(data,K,p),s=data[K.calendar],base=s.events.find(e=>e.id===item.id);
 if(item.paid)throw Error('Подія має пов’язані факти. Збережи її для історії.');
 if(p.scope==='future'){
  if((data[K.ledger]?.entries||[]).some(e=>e.calendarEventId===base.id&&e.calendarOccurrence>=item.occurrence))throw Error('У серії є пов’язані факти. Можна пропустити лише цю подію.');
  base.until=M.addDays(item.occurrence,-1);
 }else s.overrides[item.key]={...(s.overrides[item.key]||{}),cancelled:true};
}
root.FCCalendarActions={fresh,book,confirmPlanned,unlink,edit,remove};
})(globalThis);
