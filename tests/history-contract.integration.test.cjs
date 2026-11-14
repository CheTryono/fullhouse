'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {make,empty,request,clone,key,at}=require('./helpers/history-integration.cjs');
async function ready(){const m=make();await m.integration.open();await m.integration.initialize(empty(),'init');return m;}
const ctx=(id,ids=[])=>({today:'2030-01-07',ids,confirm:true,operationId:id});
test('puente: operaciones reales saveRoutine/saveEvent crean y editan antes de capturar',async()=>{
  const m=await ready(),doc=m.integration.state().confirmed,r=clone(doc.routines[0]);r.title='Edited current';
  await m.integration.plan('saveRoutine',r,ctx('edit-routine'));assert.equal(m.integration.state().confirmed.routines[0].title,'Edited current');
  const newRoutine={id:'',title:'Synthetic new',desc:'',steps:[{id:'new-step',title:'New step',min:10}]};await m.integration.plan('saveRoutine',newRoutine,ctx('new-routine',['new-routine']));
  const event={...clone(doc.events[0]),id:'',routineId:'new-routine',title:'New activity',date:'2030-01-08',time:'10:00',repeat:'none'};await m.integration.plan('saveEvent',event,ctx('new-event',['new-event']));
  assert.equal(m.integration.state().pending,null);assert.equal(m.integration.state().confirmed.events.some(e=>e.id==='new-event'),true);
});
test('puente: último paso y completado se persisten en un solo candidato',async()=>{
  const m=await ready();await m.integration.dispatch(request({type:'step',stepId:'one',checked:true},'one'));
  await m.integration.dispatch(request({type:'step',stepId:'two',checked:true},'two'));
  const l=m.integration.state().confirmed.logs[key];assert.equal(l.completed,true);assert.equal(l.history.state.completionSource,'steps');
  const before=clone(m.integration.state().confirmed);await assert.rejects(m.integration.dispatch(request({type:'step',stepId:'one',checked:false},'undo')));assert.deepEqual(m.integration.state().confirmed,before);
});
test('puente: editar/eliminar plantilla después de completar mantiene historial consultable',async()=>{
  const m=await ready();await m.integration.dispatch(request({type:'complete',source:'manual'}));const previous=m.integration.index()[0];
  const r=clone(m.integration.state().confirmed.routines[0]);r.steps.push({id:'future',title:'Future step',min:10});await m.integration.plan('saveRoutine',r,ctx('edit'));
  assert.deepEqual(m.integration.index()[0],previous);await m.integration.plan('deleteRoutine',{id:r.id},ctx('delete'));assert.deepEqual(m.integration.index()[0],previous);assert.equal(m.integration.state().confirmed.routines.length,0);
});
test('puente: desplazamientos usan BUG-04 y no afectan notas ni excepciones futuras',async()=>{
  const m=await ready();await m.integration.dispatch(request({type:'note',text:'Frozen note'}));const old=m.integration.index()[0];
  await m.integration.plan('shiftEvent',{eventId:'event',date:'2030-01-07',delta:15},ctx('shift'));assert.deepEqual(m.integration.index()[0],old);assert.equal(m.integration.state().confirmed.events[0].overrides['2030-01-07'].time,'09:15');
  await assert.rejects(m.integration.plan('shiftEvent',{eventId:'event',date:'2030-01-07',delta:10000},ctx('invalid')));assert.equal(m.integration.state().pending,null);
});
test('puente: reprogramación divide serie y no mueve ni duplica logs históricos/legados',async()=>{
  const m=await ready(),doc=clone(m.integration.state().confirmed);doc.events[0].date='2030-01-01';doc.events[0].repeat='daily';
  await m.integration.importBackup(JSON.stringify(doc),{id:'setup',confirmReplace:true});await m.integration.dispatch(request({type:'note',text:'Original'}));
  const before=clone(m.integration.state().confirmed),draft={...clone(before.events[0]),time:'11:00',applyFrom:'2030-01-08'};
  await m.integration.plan('saveEvent',draft,ctx('reprogram',['future-segment']));const after=m.integration.state().confirmed;assert.deepEqual(after.logs,before.logs);assert.equal(after.events.length,2);assert.equal(new Set(after.events.map(e=>e.seriesId)).size,1);assert.equal(m.integration.index().length,1);
});
test('puente: legado no se adopta ni descarta al editar rutinas; acciones requieren decisión explícita',async()=>{
  const m=await ready(),doc=clone(m.integration.state().confirmed);doc.logs[key]={completed:false,checkedSteps:['deleted'],note:'Original legacy'};
  await m.integration.importBackup(JSON.stringify(doc),{id:'legacy',confirmReplace:true});await assert.rejects(m.integration.dispatch(request({type:'note',text:'Do not replace'})));
  const r=clone(doc.routines[0]);r.title='Changed';await m.integration.plan('saveRoutine',r,ctx('routine'));assert.deepEqual(m.integration.state().confirmed.logs,doc.logs);
});
test('puente: cambiar duración no puede guardar una programación nueva fuera del día',async()=>{
  const m=await ready(),before=clone(m.integration.state().confirmed),r=clone(before.routines[0]);r.steps[0].min=1500;
  await assert.rejects(m.integration.plan('saveRoutine',r,ctx('overflow')),/no es válida/);assert.deepEqual(m.integration.state().confirmed,before);assert.equal(m.integration.state().pending,null);
});
test('puente: cerrar, reabrir y continuar son operaciones confirmadas de la misma ejecución',async()=>{
  const m=await ready();await m.integration.dispatch(request({type:'note',text:'Partial'},'note'));await m.integration.dispatch(request({type:'close-partial'},'partial'));assert.equal(m.integration.index()[0].status.status,'closed-partial');
  await m.integration.dispatch(request({type:'reopen',reason:'Continue',correctionId:'correction'},'reopen'));const next=request({type:'continue',localDate:'2030-01-08',timezoneOffsetMinutes:0},'continue');next.at='2030-01-08T12:00:00Z';await m.integration.dispatch(next);assert.equal(m.integration.index()[0].date,'2030-01-07');assert.equal(m.integration.index()[0].continuations.length,1);
});
test('puente: marcas, completado y notas coinciden con las acciones reales v1 antes de editar plantillas',async()=>{
  const {app}=require('./helpers/app.cjs'),data=empty();delete data.recipeRevisions;data.version=1;const legacy=app({data}),m=await ready(),event=data.events[0];
  const compare=()=>{const a=legacy.controller.state.data.logs[key],b=m.integration.state().confirmed.logs[key];assert.equal(b.completed,a.completed);assert.deepEqual(b.checkedSteps,Array.from(a.checkedSteps));assert.equal(b.note,a.note);};
  legacy.controller.toggleStep(event,'2030-01-07','one');await m.integration.dispatch(request({type:'step',stepId:'one',checked:true},'one'));compare();
  legacy.controller.saveOccurrenceNote(event,'2030-01-07','Synthetic note');await m.integration.dispatch(request({type:'note',text:'Synthetic note'},'note'));compare();
  legacy.controller.toggleStep(event,'2030-01-07','two');await m.integration.dispatch(request({type:'step',stepId:'two',checked:true},'two'));compare();
});
