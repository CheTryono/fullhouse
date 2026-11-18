'use strict';
process.env.TZ='UTC';
const test=require('node:test'),assert=require('node:assert/strict');
const {schedule,plannerActions,empty,clone}=require('./helpers/history-integration.cjs');
const {routine,event}=require('./helpers/calendar.cjs');
const R=require('../history/storage-routines.cjs'),model=require('../history/storage-model.cjs');
const {manual,fixture,build,day}=require('./helpers/alternative-safety.cjs');
test('regresión __base: el catálogo incluye ausencia y variante real por separado',()=>{
 const profiles=R.choices(manual());assert.deepEqual(profiles,[{}, {s:'__base'}]);
 assert.ok(schedule.routineBalance(manual(),day,10,profiles[0]).error);
 assert.equal(schedule.routineBalance(manual(),day,10,profiles[1]).error,'');
});
test('saveRoutine rechaza la base omitida por distribución, sin alterar el documento',async()=>{
 const {doc,draft}=fixture(),before=clone(doc);await assert.rejects(build(doc,draft),/Distribución inválida/);assert.deepEqual(doc,before);
});
test('saveRoutine permite __base legítimo si base y variante caben',async()=>{
 const {doc,draft}=fixture(10,10),result=await build(doc,draft);
 assert.equal(result.partial.tables.routines.find(r=>r.key==='r').value.steps[0].variants[0].id,'__base');
 assert.equal(result.proof.combinations,2);
});
test('base válida y variante inválida también impiden confirmar',async()=>{
 const {doc,draft}=fixture(10,20);await assert.rejects(build(doc,draft),/Distribución inválida/);
});
test('árboles anidados, variantes inactivas y IDs locales conservan todas las combinaciones',()=>{
 const child=manual(5,5).steps[0],r=manual(10,10);child.id='child';r.steps[0].children=[clone(child)];
 r.steps[0].variants[0].children=[{id:'inactive',title:'Inactive',min:5,mode:'alternatives',chooseWhen:'execute',variants:[{id:'__base',title:'V',desc:'',min:5,days:[]}]}];
 const before=clone(r),profiles=R.choices(r);assert.equal(profiles.length,8);assert.ok(profiles.some(c=>!Object.hasOwn(c,'s')));assert.ok(profiles.some(c=>c.s==='__base'&&c.inactive==='__base'));assert.deepEqual(r,before);
 assert.throws(()=>R.choices({...r,steps:[...r.steps,clone(child)]}),/pasos ambiguos/);
 const duplicate=manual();duplicate.steps[0].variants.push(clone(duplicate.steps[0].variants[0]));assert.throws(()=>R.choices(duplicate),/variantes ambiguos/);
 const huge=manual();huge.steps=Array.from({length:9},(_,i)=>({...clone(huge.steps[0]),id:'s'+i}));assert.throws(()=>R.choices(huge),/combinaciones/);
});
test('días automáticos y alternativas fijas/flexibles usan los helpers reales',async()=>{
 const {doc,draft}=fixture(5,5);draft.durationMode='fixed';draft.durationMin=10;draft.steps[0].flexible=true;draft.steps[0].variants[0].flexible=true;
 await build(doc,draft);
 draft.steps[0].variants[0].flexible=false;draft.steps[0].variants[0].min=11;await assert.rejects(build(doc,draft),/alternativa|Alternativa|Rutina inválida/);
 const automatic=manual(10,10);automatic.steps[0].chooseWhen='weekday';automatic.steps[0].variants[0].days=[1];
 assert.equal(schedule.activeSteps(automatic.steps,day,{})[0].min,10);assert.deepEqual(R.choices(automatic),[{}]);
});
test('24:00 exacto, desbordamiento y dependencias encadenadas no se relajan',async()=>{
 const {doc,draft}=fixture(10,10);doc.events=[event('e',{date:day,routineId:'r',time:'23:50'})];await build(doc,draft);draft.steps[0].variants[0].min=11;await assert.rejects(build(doc,draft),/24:00/);
 const x=fixture(10,10);x.doc.routines.push(routine('d',60),routine('nested',50));x.doc.events.push(event('d',{date:day,routineId:'d',time:'10:00'}),event('nested',{date:day,routineId:'nested',anchor:'between',afterRoutineId:'r',beforeRoutineId:'d'}));await build(x.doc,x.draft);x.doc.events.find(e=>e.id==='d').time='09:59';await assert.rejects(build(x.doc,x.draft),/nested/);
});
test('plantillas actuales admiten el ID; versiones capturadas y decisiones guardadas no se reinterpretan',async()=>{
 const codec=require('../history/codec.cjs'),{documentV2,at}=require('./fixtures/history-v2.cjs'),{createEngine}=require('../history/engine.cjs');
 const d=documentV2(),before=clone(d.recipeRevisions);d.routines=[{...manual(10,10),id:'routine'}];d.logs.legacy={completed:false,checkedSteps:['unknown'],choices:{s:'__base'},note:'Original'};
 assert.deepEqual(codec.validateV2(d,schedule.validData),[]);assert.deepEqual(codec.decode(codec.encode(d,schedule.validData),schedule.validData).document,d);
 const original=clone(d);assert.throws(()=>createEngine(schedule.validData).createRevision(d,'routine',{revisionId:'new',at}),/reserved historical alternative id/);assert.deepEqual(d,original);assert.deepEqual(d.recipeRevisions,before);
 assert.equal(schedule.activeSteps(d.routines[0].steps,day,{s:'__base'})[0].min,10);
});

