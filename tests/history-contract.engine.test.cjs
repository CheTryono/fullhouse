'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, emptyData, routine, step, event, DAY } = require('./helpers/app.cjs');
const { clone, documentV2, alternativesV2, key } = require('./fixtures/history-v2.cjs');
const { createEngine } = require('../history/engine.cjs');
const codec = require('../history/codec.cjs');
const vm=app(), legacy=d=>vm.call('validData',d), engine=createEngine(legacy);
const at=DAY+'T12:00:00Z';
function initial(patch={}) { return {...emptyData(),version:2,recipeRevisions:{},routines:[routine('r',{steps:[step('s1',{min:10}),step('s2',{min:20})]})],events:[event('e',{routineId:'r',minutes:30})],...patch}; }
function command(action,extra={}) {return {executionId:'x',at,context:{eventId:'e',date:DAY,seriesId:'series',revisionId:'rev'},action,...extra};}
function apply(d,a,extra) {return engine.prepare(d,command(a,extra)).after;}
const log=d=>Object.values(d.logs).find(l=>l.history);
function alternatives(manual=true) {return initial({routines:[routine('r',{steps:[step('parent',{mode:'alternatives',chooseWhen:manual?'execute':'weekday',days:[2],children:[step('base',{min:10})],variants:[{id:'alt',title:'Synthetic',desc:'Instructions',min:20,days:[1],children:[step('child',{min:20})]}]})]})]});}

test('motor: consultar y nota vacía no capturan; primera marca congela y es pura',()=>{
  const d=initial(),before=clone(d);
  assert.deepEqual(apply(d,{type:'view'}),d);assert.deepEqual(apply(d,{type:'note',text:' '}),d);
  const after=apply(d,{type:'step',stepId:'s1',checked:true}),l=log(after);
  assert.deepEqual(d,before);assert.equal(l.history.capture.executionId,'x');assert.equal(l.history.capture.scheduledDate,DAY);
  assert.equal(l.history.capture.captureReason,'step');assert.equal(l.history.actualTiming,null);assert.deepEqual(l.checkedSteps,['s1']);
  assert.equal(Object.isFrozen(after.recipeRevisions.rev.definition.steps[0]),true);
  assert.throws(()=>{after.recipeRevisions.rev.definition.steps[0].min=999;},TypeError);
});
for(const [name,action] of [
  ['nota',{type:'note',text:'Synthetic note'}],
  ['foto',{type:'evidence',evidence:{id:'photo',kind:'image',src:'data:image/png;base64,AA==',caption:'Synthetic',createdAt:at}}],
  ['completado',{type:'complete',source:'manual'}],
]) test('motor: primer registro por '+name,()=>{const l=log(apply(initial(),action));assert.equal(l.history.capture.captureReason,{nota:'note',foto:'evidence',completado:'complete'}[name]);assert.equal(l.history.actualTiming,null);});

test('motor: revisiones compartidas, IDs estables y nueva revisión al editar',()=>{
  const d=initial();const one=engine.createRevision(d,'r',{revisionId:'revision',at});
  const again=engine.createRevision(one.document,'r',{revisionId:'unused',at});assert.equal(again.revisionId,'revision');
  const edited=clone(one.document);edited.routines[0].steps[0].desc='New instruction';
  const two=engine.createRevision(edited,'r',{revisionId:'revision2',at});
  assert.deepEqual(two.document.recipeRevisions.revision,one.document.recipeRevisions.revision);assert.equal(Object.keys(two.document.recipeRevisions).length,2);
  assert.throws(()=>engine.createRevision(edited,'r',{revisionId:'revision',at}));
  const captured=apply(one.document,{type:'note',text:'First'});assert.equal(log(captured).history.capture.recipeRevisionId,'revision');
  const future=clone(captured);future.events.push(event('e2',{routineId:'r'}));
  const next=apply(future,{type:'note',text:'Next'},{executionId:'x2',context:{eventId:'e2',date:'2030-01-08',seriesId:'other-series',revisionId:'unused'}});
  assert.equal(Object.keys(next.recipeRevisions).length,1);assert.equal(next.logs['e2@2030-01-08'].history.capture.recipeRevisionId,'revision');
});
test('motor: alternativas automáticas conservan subpasos e instrucciones originales',()=>{
  const d=apply(alternatives(false),{type:'note',text:'Start'}),l=log(d);
  assert.equal(l.history.resolution.tree[0].variantId,'alt');assert.deepEqual(l.history.resolution.unitStepIds,['child']);
  assert.equal(d.recipeRevisions.rev.definition.steps[0].variants[0].desc,'Instructions');
  const edited=clone(d);edited.routines=[];edited.events=[];
  const next=apply(edited,{type:'step',stepId:'child',checked:true});assert.deepEqual(log(next).history.resolution,l.history.resolution);
});
test('motor: alternativa manual pendiente, elección inicial y corrección con auditoría',()=>{
  let d=apply(alternatives(),{type:'note',text:'Start'});assert.equal(log(d).history.resolution.totalPlannedMinutes,null);
  assert.throws(()=>apply(d,{type:'complete',source:'manual'}));
  d=apply(d,{type:'choice',stepId:'parent',variantId:'__base'});
  d=apply(d,{type:'step',stepId:'base',checked:true});
  d=apply(d,{type:'evidence',evidence:{id:'photo',kind:'image',src:'data:image/png;base64,AA==',caption:'Synthetic',stepId:'base',createdAt:at}});
  const before=clone(d);assert.throws(()=>apply(d,{type:'choice',stepId:'parent',variantId:'alt'}));assert.deepEqual(d,before);
  d=apply(d,{type:'choice',stepId:'parent',variantId:'alt',correctionId:'correction',reason:'Synthetic correction'});
  const l=log(d);assert.deepEqual(l.checkedSteps,['base']);assert.equal(l.note,'Start');assert.deepEqual(l.history.resolution.unitStepIds,['child']);
  assert.equal(l.history.corrections[0].before.choices.parent,'__base');assert.deepEqual(l.history.corrections[0].before.evidenceIds,['photo']);
  assert.equal(JSON.stringify(d).split('data:image/png;base64,AA==').length-1,1);
  assert.throws(()=>apply(d,{type:'complete',source:'steps'}));
});
test('motor: duración fija/flexible ponderada y suma exacta',()=>{
  const d=initial({routines:[routine('r',{durationMode:'fixed',durationMin:31,steps:[step('s1',{min:10}),step('s2',{min:5,flexible:true,flexWeight:2}),step('s3',{min:5,flexible:true,flexWeight:1})]})]});
  const after=apply(d,{type:'step',stepId:'s1',checked:true});assert.deepEqual(log(after).history.resolution.tree.map(n=>n.plannedMinutes),[10,14,7]);
  const bad=clone(d);bad.routines[0].durationMin=9;assert.throws(()=>apply(bad,{type:'note',text:'Start'}));assert.deepEqual(d.routines[0].durationMin,31);
});
test('motor: completar por pasos exige unidades; manual no inventa marcas',()=>{
  let d=apply(initial(),{type:'step',stepId:'s1',checked:true});assert.throws(()=>apply(d,{type:'complete',source:'steps'}));
  d=apply(d,{type:'step',stepId:'s2',checked:true});d=apply(d,{type:'complete',source:'steps'});assert.equal(log(d).history.state.status,'completed');
  const manual=apply(initial(),{type:'complete',source:'manual'});assert.deepEqual(log(manual).checkedSteps,[]);
});
test('motor: cierre parcial, reapertura y continuidad conservan fecha, notas y marcas',()=>{
  let d=apply(initial(),{type:'step',stepId:'s1',checked:true});d=apply(d,{type:'close-partial'});
  assert.equal(log(d).completed,false);assert.throws(()=>apply(d,{type:'step',stepId:'s2',checked:true}));
  d=apply(d,{type:'reopen',correctionId:'reopen',reason:'Continue later'});
  const later='2030-01-08T13:00:00Z';d=apply(d,{type:'continue',localDate:'2030-01-08',timezoneOffsetMinutes:60},{at:later});
  const l=log(d);assert.equal(l.history.capture.scheduledDate,DAY);assert.equal(l.history.capture.executionId,'x');assert.deepEqual(l.checkedSteps,['s1']);assert.equal(l.history.continuations.length,1);
});
test('motor: recurrencias/excepciones y dependencias solo consumen contexto resuelto',()=>{
  const d=initial();Object.assign(d.events[0],{repeat:'daily',anchor:'between',overrides:{[DAY]:{time:'23:00'}}});
  assert.throws(()=>apply(d,{type:'note',text:'Start'}));
  const context={eventId:'e',date:DAY,seriesId:'series',revisionId:'rev',window:{startMin:1380,endMin:1440},budgetMinutes:60};
  d.routines[0].steps[1].flexible=true;
  const after=apply(d,{type:'note',text:'Start'},{context});assert.equal(log(after).history.resolution.totalPlannedMinutes,60);assert.deepEqual(after.events[0].overrides,d.events[0].overrides);
  assert.throws(()=>apply(d,{type:'note',text:'Start'},{context:{...context,window:{startMin:1380,endMin:1441}}}));
});
test('motor: reintento tras almacenamiento rechazado no confirma ni duplica identidad',()=>{
  const before=initial(),cmd=command({type:'note',text:'Pending'}),op=engine.prepare(before,cmd);
  let saved=before;const storage={write(){throw new Error('QuotaExceededError');}};
  assert.throws(()=>{storage.write(engine.encode(op.after));saved=engine.accept(saved,op);});assert.deepEqual(saved,before);
  assert.deepEqual(engine.prepare(before,cmd).after,op.after);
  saved=engine.accept(saved,op);assert.deepEqual(engine.accept(saved,op),saved);assert.equal(Object.keys(saved.logs).length,1);assert.equal(Object.keys(saved.recipeRevisions).length,1);
  assert.throws(()=>engine.accept(saved,{before:op.before,after:op.after}));
  const stale=clone(before);stale.events[0].title='Other edit';assert.throws(()=>engine.accept(stale,op));
});
test('motor: fallos de construcción, IDs colisionados y legado no alteran el original',()=>{
  const d=initial(),original=clone(d);
  for(const action of [{type:'step',stepId:'missing',checked:true},{type:'evidence',evidence:{id:'photo'}},{type:'choice',stepId:'s1',variantId:'missing'}]) {assert.throws(()=>apply(d,action));assert.deepEqual(d,original);}
  d.logs['e@'+DAY]={completed:true,checkedSteps:['old'],note:'Original legacy'};const legacyDoc=clone(d);
  assert.throws(()=>apply(d,{type:'note',text:'New'}));assert.deepEqual(d,legacyDoc);
  const other=apply(d,{type:'note',text:'Next'},{context:{eventId:'e',date:'2030-01-08',seriesId:'series',revisionId:'rev'}});
  assert.deepEqual(other.logs['e@'+DAY],d.logs['e@'+DAY]);assert.equal(other.logs['e@'+DAY].history,undefined);
});
test('motor: varios nodos anidados pendientes conservan total desconocido',()=>{
  const d=alternatives();d.routines[0].steps=[step('container',{min:40,children:[...d.routines[0].steps,step('other',{min:20,children:[step('manual2',{mode:'alternatives',chooseWhen:'execute',variants:[{id:'v',title:'Variant',desc:'',min:5,days:[]}]})]})]})];
  const after=apply(d,{type:'note',text:'Start'}),r=log(after).history.resolution;
  assert.equal(r.totalPlannedMinutes,null);assert.equal(r.tree[0].plannedMinutes,null);assert.equal(r.tree[0].children[1].plannedMinutes,null);
});
test('motor: pasos por día se filtran según fecha original y no el día de continuación',()=>{
  const d=initial();d.routines[0].steps[1].mode='selected';d.routines[0].steps[1].days=[2];
  let after=apply(d,{type:'step',stepId:'s1',checked:true});assert.deepEqual(log(after).history.resolution.unitStepIds,['s1']);
  after=apply(after,{type:'continue',localDate:'2030-01-08',timezoneOffsetMinutes:0},{at:'2030-01-08T12:00:00Z'});
  assert.deepEqual(log(after).history.resolution.unitStepIds,['s1']);assert.throws(()=>apply(after,{type:'step',stepId:'s2',checked:true},{at:'2030-01-08T12:00:00Z'}));
});
test('motor: cambio de evidencia con el mismo ID se rechaza sin perder el original',()=>{
  const photo={id:'photo',kind:'image',src:'data:image/png;base64,AA==',caption:'Original',createdAt:at};
  const d=apply(initial(),{type:'evidence',evidence:photo});assert.deepEqual(apply(d,{type:'evidence',evidence:photo}),d);
  assert.throws(()=>apply(d,{type:'evidence',evidence:{...photo,caption:'Replacement'}}));assert.equal(log(d).evidences[0].caption,'Original');
});
test('motor: completado reabierto conserva checkpoint y permite desmarcado explícito',()=>{
  let d=apply(initial(),{type:'step',stepId:'s1',checked:true});d=apply(d,{type:'complete',source:'manual'});
  assert.throws(()=>apply(d,{type:'note',text:'Edit closed'}));
  d=apply(d,{type:'reopen',correctionId:'reopen',reason:'Correction'});
  assert.equal(log(d).history.corrections[0].before.completed,true);
  d=apply(d,{type:'step',stepId:'s1',checked:false});assert.deepEqual(log(d).checkedSteps,[]);
});
test('motor: ID de ejecución/serie no se reutiliza para otra ocurrencia',()=>{
  const d=apply(initial(),{type:'note',text:'Start'});
  assert.throws(()=>apply(d,{type:'note',text:'Other'},{executionId:'new',context:{eventId:'e',date:DAY,seriesId:'series',revisionId:'rev2'}}));
  assert.throws(()=>apply(d,{type:'note',text:'Wrong occurrence'},{context:{eventId:'e',date:'2030-01-08',seriesId:'series',revisionId:'rev'}}));
  const changed=clone(d);changed.logs['e@'+DAY].history.capture.executionId='different';assert.ok(codec.validateTransition(d,changed,'progress',legacy).length);
});
test('motor: conserva instrucciones de actividad y rutina y etiquetas de metas',()=>{
  const {goal}=require('./fixtures/backups.cjs'),d=initial();d.goals=[goal()];d.events[0].goalId='goal';d.events[0].note='Event instructions';d.routines[0].desc='Routine instructions';
  const after=apply(d,{type:'note',text:'Observation'}),l=log(after);
  assert.equal(l.history.capture.plan.description,'Event instructions');assert.equal(after.recipeRevisions.rev.definition.desc,'Routine instructions');assert.equal(l.history.capture.plan.goals[0].title,'Synthetic goal');
  const edited=clone(after);edited.goals[0].title='Changed goal';edited.events[0].note='Changed instructions';
  const next=apply(edited,{type:'step',stepId:'s1',checked:true});assert.deepEqual(log(next).history.capture,l.history.capture);
});
test('motor: actividad sin rutina y cancelaciones conservan su contexto histórico',()=>{
  const d=initial({routines:[],events:[event('e',{note:'Original plain instructions'})]});
  let after=apply(d,{type:'note',text:'Start'});assert.equal(log(after).history.capture.plan.description,'Original plain instructions');assert.equal(log(after).history.capture.recipeRevisionId,null);
  const cancelled=clone(after);cancelled.events[0].overrides[DAY]={skip:true};
  after=apply(cancelled,{type:'complete',source:'manual'});assert.equal(log(after).completed,true);assert.equal(log(after).history.capture.plan.description,'Original plain instructions');
  const future=clone(d);future.events[0].overrides[DAY]={skip:true};assert.throws(()=>apply(future,{type:'note',text:'Start'}));
});
