'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {app}=require('./helpers/app.cjs');
const {documentV2,clone,key,at}=require('./fixtures/history-v2.cjs');
const codec=require('../history/codec.cjs');
const vm=app(),legacy=d=>vm.call('validData',d);
const check=d=>codec.validateV2(d,legacy);
const mutations={
  'campo desconocido':d=>{d.logs[key].history.capture.extra='incomplete';},
  'copia de foto en definición':d=>{d.recipeRevisions.rev1.definition.src='data:image/png;base64,AA==';},
  'versión sin identidad':d=>{delete d.recipeRevisions.rev1.id;},
  'ID de paso duplicado':d=>{d.recipeRevisions.rev1.definition.steps[1].id='one';},
  'IDs de evidencia duplicados':d=>{d.logs[key].evidences.push(clone(d.logs[key].evidences[0]));},
  'marcas duplicadas':d=>{d.logs[key].checkedSteps.push('one');},
  'hijo omitido':d=>{d.logs[key].history.resolution.tree.pop();d.logs[key].history.resolution.unitStepIds.pop();d.logs[key].history.resolution.totalPlannedMinutes=10;},
  'nodo desconocido':d=>{d.logs[key].history.resolution.tree[0].stepId='missing';},
  'decisión pendiente falsa':d=>{const r=d.logs[key].history.resolution;r.tree[0].decisionPending=true;r.tree[0].plannedMinutes=null;r.unitStepIds=['two'];r.unitsKnown=false;r.totalPlannedMinutes=null;},
  'fecha inválida':d=>{d.logs[key].history.capture.capturedAt='2030-02-30T12:00:00Z';},
  'fecha de registro anterior':d=>{d.logs[key].history.state.lastRecordedAt='2029-01-01T00:00:00Z';},
  'auditoría con marcas inventadas':d=>{d.logs[key].history.corrections=[{id:'c',recordedAt:at,reason:'Synthetic',kind:'choice',before:{...codec.checkpoint(d.logs[key]),checkedSteps:['unknown']}}];},
  'auditoría con resolución inválida':d=>{d.logs[key].history.corrections=[{id:'c',recordedAt:at,reason:'Synthetic',kind:'choice',before:{...codec.checkpoint(d.logs[key]),resolution:{rule:'fake',tree:[]}}}];},
  'auditorías duplicadas':d=>{const c={id:'c',recordedAt:at,reason:'Synthetic',kind:'choice',before:codec.checkpoint(d.logs[key])};d.logs[key].history.corrections=[c,clone(c)];},
};
for(const [name,mutate] of Object.entries(mutations))test('codec rechaza '+name+' sin mutar entrada',()=>{
  const d=documentV2();mutate(d);const before=clone(d);assert.ok(check(d).length);assert.deepEqual(d,before);
});
test('codec maneja entradas arbitrarias, ciclos, getters y profundidad acotada sin lanzar',()=>{
  const cycle={};cycle.self=cycle;let getterCalled=false;const accessor={};Object.defineProperty(accessor,'version',{enumerable:true,get(){getterCalled=true;throw new Error('Getter');}});
  let deep={};for(let i=0;i<100;i++)deep={child:deep};
  for(const value of [null,undefined,1,'bad',[],{},cycle,deep,accessor,{version:2,logs:null},new Date(),NaN,Infinity,()=>{}])assert.doesNotThrow(()=>assert.ok(check(value).length));
  assert.equal(getterCalled,false);
  const proxy=new Proxy({},{ownKeys(){throw new Error('Proxy');}});assert.ok(check(proxy).length);
});
test('codec: parseo rechaza claves JSON duplicadas, versiones desconocidas y JSON malformado',()=>{
  for(const raw of ['{','null','{"version":3}','{"version":1,"version":2}',JSON.stringify(documentV2()).replace('"version":2','"version":2,"version":2')])assert.equal(codec.decode(raw,legacy).ok,false);
});
test('codec: roundtrip v2 preserva notas/fotos y no comparte referencias mutables',()=>{
  const d=documentV2(),result=codec.decode(codec.encode(d,legacy),legacy);assert.equal(result.ok,true);assert.deepEqual(result.document,d);assert.equal(Object.isFrozen(result.document.logs[key]),true);
  const original=clone(result.document);d.logs[key].note='Edited';assert.deepEqual(result.document,original);
});
test('codec: referencias heredadas perdidas siguen siendo hechos sin captura',()=>{
  const d=documentV2();d.logs.old={completed:true,checkedSteps:['deleted'],choices:{deleted:'old'},stepNotes:{deleted:'Original'},note:'Legacy'};
  assert.deepEqual(check(d),[]);assert.equal(codec.decode(codec.encode(d,legacy),legacy).document.logs.old.history,undefined);
});
test('codec: transiciones no pueden modificar ejecuciones ajenas ni secciones no relacionadas',()=>{
  const before=documentV2(),after=clone(before);after.logs[key].note='Allowed note';
  after.routines[0].title='Unrelated';assert.ok(codec.validateTransition(before,after,'progress',legacy).length);
  const another=clone(before.logs[key]);another.history.capture.executionId='other';another.history.capture.seriesId='other';before.logs.other=another;
  const changed=clone(before);changed.logs[key].note='Changed';changed.logs.other.note='Also changed';assert.ok(codec.validateTransition(before,changed,'progress',legacy).length);
});
test('codec: las revisiones y capturas inmutables requieren comparación con estado anterior',()=>{
  const before=documentV2(),after=clone(before);after.recipeRevisions.rev1.definition.desc='Mutation';
  assert.ok(codec.validateTransition(before,after,'progress',legacy).length);
  const lost=clone(before);lost.recipeRevisions={};assert.ok(check(lost).length);
});
test('codec: reloj/identificadores no se generan durante validación o serialización',()=>{
  const d=documentV2();assert.equal(codec.encode(d,legacy),codec.encode(d,legacy));assert.deepEqual(check(d),[]);
});
test('codec: todas las exportaciones 0.1–0.9 conservan exactamente sus hechos en roundtrip',()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'fixtures/historical');
  const files=fs.readdirSync(dir).filter(f=>/^v\d+\.json$/.test(f));assert.equal(files.length,9);
  for(const f of files){const d=JSON.parse(fs.readFileSync(path.join(dir,f))).data,result=codec.decode(codec.encode(d,legacy),legacy);assert.equal(result.ok,true);assert.equal(result.kind,'legacy');assert.deepEqual(result.document,d);}
});
test('codec: variantes con IDs repetidos y evidencia con paso desconocido se rechazan',()=>{
  const {alternativesV2}=require('./fixtures/history-v2.cjs');const d=alternativesV2();
  const variants=d.recipeRevisions.rev1.definition.steps[0].variants;variants.push(clone(variants[0]));assert.ok(check(d).length);
  const plain=documentV2();plain.logs[key].evidences[0].stepId='missing';assert.ok(check(plain).length);
});
test('codec: no se altera horario, continuidad ni auditoría mediante progreso ordinario',()=>{
  const before=documentV2();
  for(const change of [d=>{d.events[0].time='22:00';},d=>{d.logs[key].history.continuations.push({recordedAt:at,localDate:'2030-01-08',timezoneOffsetMinutes:0});},d=>{d.logs[key].history.corrections.push({id:'audit',recordedAt:at,reason:'Unrelated',kind:'choice',before:codec.checkpoint(before.logs[key])});}]){
    const after=clone(before);change(after);assert.ok(codec.validateTransition(before,after,'progress',legacy).length);
  }
});
