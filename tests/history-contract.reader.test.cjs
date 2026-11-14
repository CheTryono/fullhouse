'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {scheduleSource,bundle}=require('../scripts/history-browser.cjs');
const {createEngine}=require('../history/engine.cjs'),{createReader}=require('../history/reader.cjs'),{createAdapter}=require('../history/adapter.cjs');
const {scenarios}=require('./history-lab/scenarios.cjs');
const codec=require('../history/codec.cjs');
const moduleSchedule={exports:{}};new Function('module',scheduleSource())(moduleSchedule);
const H={createEngine,createReader,createAdapter,schedule:moduleSchedule.exports},lab=scenarios(H),reader=lab.reader;
const fixture=id=>lab.list.find(s=>s.id===id),read=id=>reader.index(fixture(id).doc)[0],clone=x=>JSON.parse(JSON.stringify(x));

test('lector: usa la captura y no los diez pasos ni el título actuales',()=>{
  const s=fixture('edited'),before=clone(s.doc),v=reader.index(s.doc)[0];
  assert.equal(v.kind,'historical');assert.equal(v.title,'Actividad original');assert.equal(v.tree.length,2);assert.equal(v.tree[0].title,'Paso original one');assert.equal(v.tree[0].plannedMinutes,10);assert.deepEqual(s.doc,before);assert.ok(Object.isFrozen(v.tree));
});
test('lector: conserva alternativa automática y reparto previsto tras editar duración',()=>{
  const v=read('durations');assert.equal(v.tree[0].variantId,'monday');assert.equal(v.tree[0].title,'Alternativa del lunes');assert.equal(v.tree[1].plannedMinutes,50);assert.equal(v.plan.budgetMinutes,60);
});
test('lector: ejecución huérfana accesible en archivo, día, horario y calendario sin duplicar',()=>{
  const s=fixture('deleted');assert.equal(reader.index(s.doc).length,1);assert.equal(reader.timeline(s.doc,s.date).length,1);assert.equal(read('deleted').tree.length,2);
  const recurring=fixture('recurring');assert.equal(reader.timeline(recurring.doc,'2030-01-07').length,1);assert.equal(reader.timeline(recurring.doc,'2030-01-08').length,0);
});
test('lector: notas, fotos e inactivos se conservan; árboles/auditorías solo referencian fotos',()=>{
  const v=read('corrected');assert.deepEqual(v.progress,{done:0,total:1,knownUnits:1});assert.equal(v.facts.note,'Nota antes de corregir');assert.equal(v.facts.evidences.length,1);assert.equal(v.inactiveMarks[0].id,'one');
  assert.equal(JSON.stringify(v.tree).includes('data:image'),false);assert.equal(JSON.stringify(v.corrections).includes('data:image'),false);assert.deepEqual(v.corrections[1].before.evidenceIds,['photo']);
});
test('lector: continuidad conserva día original y no duplica crédito de progreso',()=>{
  const s=fixture('continued'),v=read('continued');assert.equal(v.date,'2030-01-07');assert.equal(v.continuations[0].localDate,'2030-01-08');
  assert.equal(reader.timeline(s.doc,s.date).filter(e=>e.kind==='record').length,1);assert.equal(reader.progress(s.doc,s.date).executions.total,0);assert.equal(reader.progress(s.doc,'2030-01-07').executions.total,1);
});
test('lector: metas borradas y revisiones conservan etiquetas capturadas',()=>{
  const s=fixture('review'),views=reader.index(s.doc);assert.equal(views.length,2);assert.equal(views[0].plan.goals[0].title,'Meta original');
  const review=views.find(v=>v.eventId==='review-goal');assert.equal(review.plan.kind,'review');assert.equal(review.title,'Revisión · Meta original');assert.equal(review.plan.goals[0].title,null);
});
test('lector: información incompleta nunca usa plantilla actual aunque se pida estimación',()=>{
  let touched=false;const bad={};Object.defineProperty(bad,'logs',{enumerable:true,get(){touched=true;throw Error('Getter');}});assert.equal(reader.index(bad)[0].kind,'incomplete');assert.equal(touched,false);
  const s=fixture('broken'),key=Object.keys(s.doc.logs)[0],v=reader.read(s.doc,key,{estimate:true});assert.equal(v.kind,'incomplete');assert.equal(v.tree,undefined);assert.equal(v.facts.evidences.length,1);assert.equal(reader.progress(s.doc,s.date).executions.total,0);
  const malformed=clone(fixture('partial').doc);Object.values(malformed.logs)[0].history=null;assert.equal(reader.index(malformed)[0].kind,'incomplete');
});
test('lector: legado y estimación explícita no inventan asociación de pasos ni porcentajes',()=>{
  const s=fixture('legacy'),key=Object.keys(s.doc.logs)[0],before=clone(s.doc),v=reader.read(s.doc,key),estimated=reader.read(s.doc,key,{estimate:true});
  const untrusted=clone(fixture('partial').doc);untrusted.version=1;assert.equal(reader.index(untrusted)[0].kind,'legacy');
  assert.equal(v.kind,'legacy');assert.equal(v.tree.length,0);assert.equal(estimated.kind,'estimated');assert.ok(estimated.tree.every(n=>n.checked===false));assert.deepEqual(estimated.facts.checkedSteps,['missing']);assert.deepEqual(s.doc,before);assert.equal(reader.progress(s.doc,s.date).steps.total,0);
});
test('lector: pasos y bloques separados; añadir programación no altera denominador histórico',()=>{
  const s=fixture('statistics'),p=reader.progress(s.doc,s.date);assert.deepEqual(p.steps,{done:1,total:2,unknownExecutions:0});assert.deepEqual(p.executions,{completed:0,total:1});assert.equal(p.scheduled,2);
  const d=clone(s.doc);d.routines[0].steps=[];d.events=[];assert.deepEqual(reader.progress(d,s.date).steps,p.steps);assert.deepEqual(reader.progress(d,s.date).executions,p.executions);
});
test('lector: IDs duplicados se muestran incompletos, sin contabilizar doble progreso',()=>{
  const d=clone(fixture('partial').doc);d.logs.duplicate=clone(Object.values(d.logs)[0]);assert.ok(reader.index(d).every(v=>v.kind==='incomplete'));assert.equal(reader.progress(d).executions.total,0);
});
test('auditoría: nuevo checkpoint conserva estado, origen y fecha del completado anterior',()=>{
  const v=read('corrected'),reopened=v.corrections[0];assert.equal(reopened.kind,'reopen');assert.equal(reopened.lifecycle.status,'completed');assert.equal(reopened.lifecycle.completionSource,'steps');assert.equal(reopened.lifecycle.completedRecordedAt,'2030-01-07T12:00:00Z');assert.equal(reopened.at,'2030-01-08T12:00:00Z');assert.deepEqual(v.corrections[1].changedChoices,[{stepId:'parent',from:'__base',to:'other'}]);
});
test('auditoría: checkpoints antiguos sin lifecycle siguen válidos y su fecha es desconocida',()=>{
  const d=clone(fixture('corrected').doc),l=Object.values(d.logs)[0];for(const c of l.history.corrections)delete c.before.lifecycle;
  const before=clone(d);assert.deepEqual(codec.validateV2(d,H.schedule.validData),[]);assert.ok(reader.index(d)[0].corrections.every(c=>c.lifecycle===null));assert.deepEqual(d,before);
});
test('auditoría: rechaza ciclo de vida incoherente y timestamps inventados por delante de corrección',()=>{
  const d=clone(fixture('corrected').doc),c=Object.values(d.logs)[0].history.corrections[0];c.before.lifecycle.completedRecordedAt='2035-01-01T12:00:00Z';assert.ok(codec.validateV2(d,H.schedule.validData).length);
  const missing=clone(fixture('corrected').doc);Object.values(missing.logs)[0].history.corrections[0].before.checkedSteps=[];assert.ok(codec.validateV2(missing,H.schedule.validData).length);
});
test('adaptador: dependencias, excepciones y recurrencia usan funciones reales de app.tsx',()=>{
  const d=clone(fixture('partial').doc);d.logs={};d.recipeRevisions={};d.events[0].overrides={'2030-01-08':{skip:true},'2030-01-09':{time:'23:30'}};
  assert.throws(()=>lab.adapter.context(d,'e','2030-01-08',{seriesId:'series',revisionId:'new'}));assert.equal(lab.adapter.context(d,'e','2030-01-09',{seriesId:'series',revisionId:'new'}).window.endMin,1440);
  d.routines.push({id:'a',title:'A',desc:'',steps:[]},{id:'b',title:'B',desc:'',steps:[]});
  const event=d.events[0];d.events.push({...clone(event),id:'a-event',routineId:'a',time:'08:00',minutes:30,overrides:{},seriesId:'a'},{...clone(event),id:'b-event',routineId:'b',time:'10:00',minutes:30,overrides:{},seriesId:'b'});
  Object.assign(event,{anchor:'between',afterRoutineId:'a',beforeRoutineId:'b'});d.routines[0].steps[1].flexible=true;
  const context=lab.adapter.context(d,'e','2030-01-07',{seriesId:'series',revisionId:'new'});assert.deepEqual(context.window,{startMin:481,endMin:600});
  d.events.forEach(e=>delete e.recipeRevisionId);
  const op=lab.adapter.prepare(lab.engine,d,{executionId:'new-exec',at:'2030-01-07T12:00:00Z',context:{eventId:'e',date:'2030-01-07',seriesId:'series',revisionId:'new'},action:{type:'note',text:'Dependency test'}});assert.equal(reader.index(op.after)[0].plan.budgetMinutes,119);
});
test('bundle: carga en navegador sin require/fs/process/React ni almacenamiento',()=>{
  const c=vm.createContext({});vm.runInContext(bundle(),c);
  assert.equal(vm.runInContext('(()=>{const lab=FullhouseHistory.scenarios(FullhouseHistory);return lab.reader.index(lab.list[0].doc)[0].tree.length})()',c),2);
  assert.equal(bundle(),bundle());
});
test('lector: alternativas pendientes conservan total desconocido y se excluyen del denominador conocido',()=>{
  const s=fixture('pending'),v=read('pending');assert.equal(v.tree[0].decisionPending,true);assert.equal(v.plannedMinutes,null);assert.equal(v.progress.total,null);assert.equal(reader.progress(s.doc,s.date).steps.unknownExecutions,1);
});
test('adaptador: captura eventos de revisión generados realmente por saveGoal de producción',()=>{
  const {app}=require('./helpers/app.cjs'),{goal}=require('./fixtures/backups.cjs'),a=app();
  a.controller.state.goalDraft={...goal(),review:{date:'2030-01-07',time:'18:00',repeat:'weekly'}};a.controller.saveGoal();
  const d={...JSON.parse(JSON.stringify(a.controller.state.data)),version:2,recipeRevisions:{}};
  const op=lab.adapter.prepare(lab.engine,d,{executionId:'goal-review',at:'2030-01-07T19:00:00Z',context:{eventId:'review-goal',date:'2030-01-07',seriesId:'goal-series',revisionId:'unused'},action:{type:'note',text:'Synthetic review'}});
  const v=reader.index(op.after)[0];assert.equal(v.plan.kind,'review');assert.equal(v.plan.goals[0].title,'Synthetic goal');assert.equal(v.plan.window.endMin,1110);
});
