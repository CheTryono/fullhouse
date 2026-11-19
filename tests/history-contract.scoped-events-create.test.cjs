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
