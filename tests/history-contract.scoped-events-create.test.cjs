'use strict';
process.env.TZ='UTC';
const test=require('node:test'),assert=require('node:assert/strict'),{schedule,plannerActions}=require('./helpers/history-integration.cjs'),{fixture,draft,context,head,build,clone,day}=require('./helpers/scoped-events.cjs'),E=require('../history/storage-events.cjs');
test('creación puntual: normaliza como Planner, reserva IDs y no toca el documento',async()=>{
 const d=fixture(),before=clone(d),p=draft({minutes:0}),ctx=context(),out=await build(d,p,ctx),actor=plannerActions(clone(d),{...ctx,ids:[out.reservation.eventId],confirm:true});
 actor.controller.state.eventDraft={...p,seriesId:out.reservation.seriesId};await actor.controller.saveEvent();
 assert.deepEqual(out.row.value,actor.result().candidate.events.at(-1));assert.deepEqual(d,before);assert.equal(out.proof.status,'valid');assert.equal(out.row.value.minutes,1);
 assert.deepEqual(E.issue(head,'create'),out.reservation);assert.notEqual(E.issue({...head,receiptHash:'b'.repeat(64),generation:2},'create').eventId,out.reservation.eventId);
});
test('día completo, ocasión multiday, meta y ancla de término conservan semántica',async()=>{
 const d=fixture();d.goals=[{id:'g',title:'G',desc:'',parentId:'',color:'#123456',current:0,target:1,unit:'',history:[]}];
 for(const extra of [{allDay:true,time:''},{kind:'occasion',endDate:'2030-01-10'},{goalId:'g'},{anchor:'end',endTime:'10:00',minutes:20}]){
  const out=await build(d,draft(extra));assert.equal(out.proof.status,'valid');if(extra.anchor)assert.equal(out.row.value.time,'09:40');
 }
});
test('24:00 exacto, excesos, fechas y formulario inválido no generan candidato',async()=>{
 assert.equal((await build(fixture(),draft({time:'23:30'}))).proof.status,'valid');
 for(const extra of [{time:'23:31'},{title:'   '},{date:'2030-02-30'},{endDate:'2029-01-01'},{goalId:'missing'},{id:'existing'},{kind:'review'},{seriesId:'supplied'}])await assert.rejects(build(fixture(),draft(extra)));
});
test('solapamiento ordinario se permite; move con colisión se bloquea entero',async()=>{
 const d=fixture();d.events=[{...draft({id:'old',title:'Old',minutes:60}),id:'old'}];
 assert.equal((await build(d,draft())).proof.status,'valid');
 await assert.rejects(build(d,draft({overlapMode:'move'})),e=>e.code==='MOVE_UNSUPPORTED');
 assert.equal((await build(d,draft({time:'12:00',overlapMode:'move'}))).proof.status,'valid');
});
test('IDs existentes, históricos y review-* no se pueden reservar como nuevos',()=>{
 const identity={events:new Set(['legacy']),series:new Set(['old-series'])},plan={tables:{events:[{key:'existing',value:{seriesId:'active-series'}}]}};
 for(const ids of [{eventId:'existing',seriesId:'new'},{eventId:'legacy',seriesId:'new'},{eventId:'new',seriesId:'old-series'},{eventId:'review-g',seriesId:'new'}])assert.throws(()=>E.checkIdentity(plan,ids,identity));
 assert.throws(()=>E.issue(head,undefined));
});
test('la selección de alcance y la construcción no leen ejecuciones ni fotos ajenas',async()=>{
 const model=require('../history/storage-model.cjs'),plan=await model.prepareDocument(fixture(),schedule.validData),history=E.historyIdentities(plan),ctx=context(),reservation=E.issue(head,ctx.operationId);
 Object.defineProperty(plan.tables,'executions',{get(){throw Error('Historical executions hydrated');}});Object.defineProperty(plan,'images',{get(){throw Error('Photos hydrated');}});
 const scope=E.selectScope(plan,reservation,draft(),ctx,history),result=await E.buildChange(scope,{legacy:schedule.validData,schedule,plannerActions});assert.equal(result.proof.status,'valid');assert.equal(result.row.key,reservation.eventId);
});
test('programaciones periódicas y finitas: calendario completo, no ocho ocurrencias',async()=>{
 const {routine}=require('./helpers/calendar.cjs');
 for(const repeat of ['daily','weekly','weekdays','custom','dates','monthly','yearly','every']){
  const d=fixture();d.routines=[routine('r',30)];
  const extra={routineId:'r',repeat,repeatDays:[1,3],specificDates:['2040-01-07'],everyDays:3,...(['monthly','yearly','every'].includes(repeat)?{endDate:'2031-01-07'}:{})};
  assert.equal((await build(d,draft(extra),context('create-'+repeat))).proof.status,'valid');
 }
 const result=await build(fixture(),draft({repeat:'monthly',date:'2030-01-31'}));assert.equal(result.proof.status,'valid');assert.ok(result.proof.certificate.counts.states>=146097);
 await assert.rejects(build(fixture(),draft({repeat:'daily',overrides:{'2250-01-01':{time:'23:31'}}})),e=>e.status==='invalid'&&e.counterexample?.date==='2250-01-01');
});
function boundaries(){const {routine,event}=require('./helpers/calendar.cjs'),d=fixture();d.routines=[routine('a',60),routine('c',60),routine('r',10)];d.events=[event('a',{date:day,time:'08:00',routineId:'a'}),event('c',{date:day,time:'09:10',routineId:'c'})];return d;}
const between=extra=>draft({routineId:'r',repeat:'daily',anchor:'between',afterRoutineId:'a',beforeRoutineId:'c',...extra});
test('regresión preview: el ID real __fh_preview__ deja de ocultar el límite',async()=>{
 const d=boundaries();d.events[0].id='__fh_preview__';const p=between(),actor=plannerActions(clone(d),{...context(),ids:['reserved-real'],confirm:true});actor.controller.state.eventDraft=p;
 assert.equal(actor.controller.schedulePreview(p)[0].skipped,true);await actor.controller.saveEvent();assert.equal(actor.result().candidate,null);
 const actual=await build(d,p);assert.equal(actual.proof.status,'valid');assert.equal(actual.row.value.afterRoutineId,'a');assert.equal(d.events[0].id,'__fh_preview__');
});
test('between: límites, ciclos, orden y espacio se verifican sin sustituciones',async()=>{
 const d=boundaries();assert.equal((await build(d,between())).proof.status,'valid');
 const absent=boundaries();absent.events=absent.events.filter(e=>e.routineId!=='a');await assert.rejects(build(absent,between()));
 const order=boundaries();order.events.unshift({...clone(order.events[0]),id:'first-a',time:'09:00'});await assert.rejects(build(order,between()));
 const cycle=boundaries();cycle.events[0]={...cycle.events[0],anchor:'between',afterRoutineId:'r',beforeRoutineId:'c'};await assert.rejects(build(cycle,between()));
});
test('añadir una nueva rutina límite puede invalidar una cadena; se rechaza',async()=>{
 const {routine,event}=require('./helpers/calendar.cjs'),d=fixture();d.routines=[routine('a',60),routine('c',60),routine('b',5,{steps:[{id:'s',title:'Flex',min:5,flexible:true}]}),routine('r',10)];
 d.events=[event('c',{date:day,time:'10:00',routineId:'c'}),event('b',{date:day,routineId:'b',anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'}),event('r',{date:day,routineId:'r',anchor:'between',afterRoutineId:'b',beforeRoutineId:'c'})];
 await assert.rejects(build(d,draft({routineId:'a',repeat:'daily',time:'08:00'})),e=>e.status==='invalid');
});
test('duplicado futuro de rutina y referencias inexistentes conservan reglas Planner',async()=>{
 const d=boundaries();await assert.rejects(build(d,draft({routineId:'a',repeat:'weekly',date:'2040-01-01'})),/programación futura|ya está programada/);
 await assert.rejects(build(d,draft({routineId:'missing'})),e=>e.code==='ROUTINE_MISSING');
 await assert.rejects(build(d,between({beforeRoutineId:'missing'})),e=>e.code==='BOUNDARIES');
 const {routine}=require('./helpers/calendar.cjs');d.routines.push(routine('new',20));const result=await build(d,draft({routineId:'new',anchor:'end',endTime:'23:59'}));
 assert.equal(result.proof.status,'valid');assert.equal(result.row.value.time,'23:39');
});
test('alternativas, días y presupuestos no se omiten para autorizar',async()=>{
 const {routine}=require('./helpers/calendar.cjs'),d=boundaries();d.routines[2]=routine('r',10,{steps:[{id:'s',title:'S',min:10,mode:'alternatives',chooseWhen:'execute',variants:[{id:'long',title:'Long',desc:'',min:11,days:[]}]}]});
 await assert.rejects(build(d,between()),e=>e.status==='invalid'&&e.counterexample?.rule==='routine-balance');
 d.routines[2].steps[0].variants[0].id='__base';await assert.rejects(build(d,between()),e=>e.code==='ROUTINE_NOT_CAPTURABLE');
 await assert.rejects(build(fixture(),draft({repeat:'monthly'}),context('budget',{budgets:{states:3}})),e=>e.status==='indeterminate');
});
