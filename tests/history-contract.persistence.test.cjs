'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {make,empty,request,schedule,documentV2,clone,key,at,KEYS}=require('./helpers/history-integration.cjs');
const {createMemoryStorage,createMemoryLock}=require('../history/storage-memory.cjs');
const {prepareLegacyDocument,readBackup,exportV2,footprint}=require('../history/backups.cjs');
async function ready(doc=empty()){const m=make();await m.integration.open();await m.integration.initialize(doc,'init');assert.equal(m.integration.state().pending,null);return m;}

test('persistencia: captura y primer paso se confirman juntos, sin mutar base',async()=>{
  const m=await ready(),before=m.integration.state().confirmed;
  await m.integration.dispatch(request({type:'step',stepId:'one',checked:true}));
  assert.deepEqual(before.logs,{});const after=m.integration.state();assert.equal(after.pending,null);assert.equal(after.busy,false);assert.equal(after.confirmed.logs[key].history.capture.executionId,'execution');assert.deepEqual(after.confirmed.logs[key].checkedSteps,['one']);assert.equal((await m.repository.open()).status,'ready');
});
test('persistencia: escritura rechazada retiene confirmado, candidato e IDs; reintento sin duplicar fotos',async()=>{
  const m=await ready(),old=m.integration.exportConfirmed(),photo={id:'photo',kind:'image',src:'data:image/png;base64,AA==',caption:'Synthetic',createdAt:at};
  m.storage.failNext({op:'write',key:KEYS.b});await m.integration.dispatch(request({type:'evidence',evidence:photo}));
  assert.equal(m.integration.exportConfirmed(),old);assert.equal(m.integration.state().pending.document.logs[key].evidences.length,1);
  await assert.rejects(m.integration.dispatch(request({type:'note',text:'Do not lose'},'second')));
  m.integration.setDraft('note','Unsubmitted synthetic note');const recovery=await m.integration.exportRecovery();assert.equal(recovery.drafts.note,'Unsubmitted synthetic note');assert.equal(JSON.parse(recovery.pending).logs[key].evidences.length,1);
  await m.integration.retry();assert.equal(m.integration.state().pending,null);assert.equal(m.integration.state().confirmed.logs[key].evidences.length,1);assert.equal(Object.keys(m.integration.state().confirmed.recipeRevisions).length,1);
});
test('persistencia: lectura posterior fallida no confirma; reintento verifica el mismo candidato',async()=>{
  const m=await ready(),before=m.integration.exportConfirmed();m.storage.failNext({op:'read',key:KEYS.b,skip:1});
  await m.integration.dispatch(request({type:'note',text:'Pending note'}));assert.equal(m.integration.exportConfirmed(),before);assert.ok(m.integration.state().pending);
  await m.integration.retry();assert.equal(m.integration.state().pending,null);assert.equal(m.integration.state().confirmed.logs[key].note,'Pending note');
});
for(const after of [false,true])test('protocolo: interrupción '+(after?'después':'antes')+' del manifiesto se recupera explícitamente',async()=>{
  const m=await ready(),before=m.integration.exportConfirmed();m.storage.failNext({op:'write',key:KEYS.manifest,after});await m.integration.dispatch(request({type:'note',text:'Interrupted'}));
  assert.equal(m.integration.exportConfirmed(),before);assert.equal((await m.repository.open()).status,'recovery');
  const reboot=make(m.storage,m.lock);await reboot.integration.open();assert.ok(reboot.integration.state().recovery);await reboot.integration.recover();assert.equal(reboot.integration.state().confirmed.logs[key].note,'Interrupted');assert.equal(reboot.integration.state().recovery,null);
});
test('protocolo: intento sin candidato íntegro bloquea recuperación y conserva el último slot',async()=>{
  const m=await ready(),old=m.storage.raw(KEYS.a);m.storage.failNext({op:'write',key:KEYS.b});await m.integration.dispatch(request({type:'note',text:'Memory only'}));
  const reboot=make(m.storage,m.lock);assert.equal((await reboot.repository.open()).status,'recovery');await assert.rejects(reboot.repository.recoverOperation());assert.equal(m.storage.raw(KEYS.a),old);
});
test('protocolo: dos pestañas compatibles no sobrescriben una base obsoleta',async()=>{
  const m=await ready(),other=make(m.storage,m.lock);await other.integration.open();
  await Promise.all([m.integration.dispatch(request({type:'note',text:'First'},'first')),other.integration.dispatch(request({type:'note',text:'Other'},'other'))]);
  const states=[m.integration.state(),other.integration.state()];assert.equal(states.filter(s=>s.pending).length,1);assert.equal((await m.repository.open()).document.logs[key].note,'First');
  const loser=states[0].pending?m:other;await loser.integration.retry();assert.ok(loser.integration.state().pending);assert.equal((await m.repository.open()).document.logs[key].note,'First');
});
test('protocolo: v1 divergente o corrupto bloquea antes de escribir v2',async()=>{
  const v1={version:1,goals:[],routines:[],events:[],logs:{}},raw=JSON.stringify(v1),storage=createMemoryStorage({[KEYS.legacy]:raw}),m=make(storage);
  await m.integration.open();await m.integration.initialize(prepareLegacyDocument(raw,schedule.validData),'init');assert.equal(storage.raw(KEYS.legacy),raw);
  const old=storage.raw(KEYS.manifest);storage.externalWrite(KEYS.legacy,JSON.stringify({...v1,logs:{old:{completed:true,checkedSteps:[]}}}));
  const opened=await m.repository.open();assert.equal(opened.status,'recovery');assert.equal(storage.raw(KEYS.manifest),old);
  await assert.rejects(m.repository.recoverOperation());
  storage.externalWrite(KEYS.legacy,'{"version":3}');assert.equal((await m.repository.open()).status,'recovery');
});
test('protocolo: inicialización no puede descartar hechos v1 ni elegir copia sin manifiesto',async()=>{
  const alias=make(createMemoryStorage({[KEYS.historical]:JSON.stringify({version:1,goals:[],routines:[],events:[],logs:{}})}));assert.equal((await alias.repository.open()).status,'recovery');assert.equal(alias.storage.raw(KEYS.a),null);
  const v1={version:1,goals:[],routines:[],events:[],logs:{legacy:{completed:true,checkedSteps:['lost']}}},raw=JSON.stringify(v1),m=make(createMemoryStorage({[KEYS.legacy]:raw}));
  const opened=await m.repository.open();await assert.rejects(m.repository.prepare(opened.token,empty(),'bad'));assert.equal(m.storage.raw(KEYS.legacy),raw);
  m.storage.externalWrite(KEYS.a,JSON.stringify(documentV2()));assert.equal((await m.repository.open()).status,'recovery');
  const extended={...v1,recipeRevisions:{original:'Unknown v1 facts'}},source=JSON.stringify(extended),guard=make(createMemoryStorage({[KEYS.legacy]:source})),token=(await guard.repository.open()).token;
  assert.throws(()=>prepareLegacyDocument(source,schedule.validData));await assert.rejects(guard.repository.prepare(token,{...extended,version:2,recipeRevisions:{}},'no-loss'));assert.equal(guard.storage.raw(KEYS.legacy),source);
});
test('protocolo: documento corrupto, manifiesto incompatible y hash alterado no causan fallback',async()=>{
  const {sha256}=require('../history/persistence.cjs');assert.notEqual(await sha256('a\ud800'),await sha256('a\ud801'));
  for(const mutate of [m=>m.storage.externalWrite(KEYS.a,'broken'),m=>m.storage.externalWrite(KEYS.manifest,'{"protocol":9}'),m=>m.storage.externalWrite(KEYS.b,'{"version":1}'),m=>{const manifest=JSON.parse(m.storage.raw(KEYS.manifest));manifest.id='corrupt';m.storage.externalWrite(KEYS.manifest,JSON.stringify(manifest));}]){
    const m=await ready();mutate(m);const before=m.storage.dump();assert.equal((await m.repository.open()).status,'recovery');assert.deepEqual(m.storage.dump(),before);
  }
});
test('respaldos: inválidos no reemplazan; v2 completo conserva fotos/correcciones; v1 requiere revisión',async()=>{
  const m=await ready(documentV2()),old=m.integration.exportConfirmed();await assert.rejects(m.integration.importBackup('{"version":2}',{id:'bad',confirmReplace:true}));assert.equal(m.integration.exportConfirmed(),old);
  assert.deepEqual(readBackup(exportV2(documentV2(),schedule.validData),schedule.validData).document,documentV2());assert.throws(()=>exportV2({version:1},schedule.validData));
  const legacyRaw=JSON.stringify({version:1,goals:[],routines:[],events:[],logs:{old:{completed:true,checkedSteps:['lost']}}});assert.equal((await m.integration.importBackup(legacyRaw)).status,'legacy-review');assert.equal(m.integration.exportConfirmed(),old);
});
test('respaldos históricos 0.1–0.9 se proponen en memoria sin modificar ni inventar contexto',()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'fixtures/historical');
  for(const f of fs.readdirSync(dir).filter(f=>/^v\d+\.json$/.test(f))){const data=JSON.parse(fs.readFileSync(path.join(dir,f))).data,raw=JSON.stringify(data),v2=prepareLegacyDocument(raw,schedule.validData);assert.deepEqual(v2.logs,data.logs);assert.equal(v2.version,2);assert.equal(Object.values(v2.logs).some(l=>l.history),false);assert.equal(JSON.stringify(data),raw);}
});
test('cuota: no se borra el último confirmado para hacer sitio',async()=>{
  const m=await ready(),old=m.storage.dump();m.storage.setQuota(m.storage.bytes()+100);
  await m.integration.dispatch(request({type:'note',text:'x'.repeat(1000)}));assert.ok(m.integration.state().pending);assert.equal(m.storage.raw(KEYS.a),old[KEYS.a]);assert.equal(m.storage.raw(KEYS.manifest),old[KEYS.manifest]);assert.equal(m.storage.trace.some(x=>x.op==='remove' && [KEYS.a,KEYS.b,KEYS.legacy].includes(x.key)),false);
});
test('capacidad: miles de ejecuciones y muchas versiones se validan, sin duplicar definiciones por ejecución',async()=>{
  const {growth}=require('./fixtures/history-growth.cjs'),d=growth(2000,500,0),raw=exportV2(d,schedule.validData),m=make();await m.integration.open();await m.integration.initialize(d,'large');
  assert.equal(m.integration.state().pending,null);assert.equal(Object.keys(m.integration.state().confirmed.logs).length,2000);assert.equal(Object.keys(m.integration.state().confirmed.recipeRevisions).length,500);assert.equal(JSON.parse(raw).version,2);
});
test('capacidad: cuota durante duplicación de ranuras y patrón JPEG comprimido conserva originales',async()=>{
  const {growth}=require('./fixtures/history-growth.cjs'),d=growth(40,10,1),m=make();await m.integration.open();await m.integration.initialize(d,'photos');
  const before=m.storage.dump(),candidate=clone(d);candidate.logs[Object.keys(candidate.logs)[0]].note='New note';const {token}=await m.repository.open(),op=await m.repository.prepare(token,candidate,'quota');m.storage.setQuota(m.storage.bytes()+2000);
  await assert.rejects(m.repository.write(op),/Quota/);assert.equal(m.storage.raw(KEYS.a),before[KEYS.a]);assert.equal(m.storage.raw(KEYS.manifest),before[KEYS.manifest]);assert.equal(footprint(d).dualSlotPeakBytes,footprint(d).utf16Bytes*2);
});
test('respaldos: no se exporta un archivo mayor que el que el codec puede volver a leer',()=>{
  const d=documentV2(),src='data:image/png;base64,'+'A'.repeat(11000000);d.logs[key].evidences=Array.from({length:3},(_,i)=>({id:'large'+i,kind:'image',src,caption:'Synthetic size only',createdAt:at}));assert.throws(()=>exportV2(d,schedule.validData),/límite de lectura/);
});
test('recuperación: paquete exportado conserva candidato, borradores y fotos en un destino vacío',async()=>{
  const {readRecovery}=require('../history/backups.cjs'),m=await ready();m.storage.failNext({op:'write',key:KEYS.b});await m.integration.dispatch(request({type:'evidence',evidence:{id:'p',kind:'image',src:require('./fixtures/synthetic-image.cjs'),caption:'Synthetic',createdAt:at}}));m.integration.setDraft('note','Unsubmitted');
  const result=readRecovery(JSON.stringify(await m.integration.exportRecovery()),schedule.validData);assert.equal(result.ok,true);assert.equal(result.drafts.note,'Unsubmitted');assert.equal(result.pending.logs[key].evidences.length,1);
  const restored=make();await restored.integration.open();await restored.integration.initialize(result.pending,'restored');assert.equal(restored.integration.index()[0].facts.evidences.length,1);
  assert.equal(readRecovery('{"format":"wrong"}',schedule.validData).ok,false);
});
test('borradores: una nota escrita durante una confirmación no se descarta ni entra silenciosamente al candidato',async()=>{
  const m=await ready();m.integration.setDraft('note','First');const write=m.integration.dispatch(request({type:'note',text:'First'}));m.integration.setDraft('note','New unsubmitted');await write;
  assert.equal(m.integration.state().confirmed.logs[key].note,'First');assert.equal(m.integration.state().drafts.note,'New unsubmitted');assert.equal((await m.integration.exportRecovery()).drafts.note,'New unsubmitted');
});
test('protocolo: fallo antes del intento no toca disco y un ACK perdido de limpieza es reintentable',async()=>{
  for(const fault of [{op:'write',key:KEYS.intent},{op:'remove',key:KEYS.intent,after:true}]){
    const m=await ready(),old=m.integration.exportConfirmed();m.storage.failNext(fault);await m.integration.dispatch(request({type:'note',text:'Ack test'}));assert.equal(m.integration.exportConfirmed(),old);assert.ok(m.integration.state().pending);await m.integration.retry();assert.equal(m.integration.state().pending,null);assert.equal(m.integration.state().confirmed.logs[key].note,'Ack test');
  }
});
test('carga fallida: conserva la memoria confirmada y nunca inventa ejemplos',async()=>{
  const m=await ready(documentV2()),before=m.integration.exportConfirmed();const opening=m.integration.open();await assert.rejects(m.integration.dispatch(request({type:'note',text:'Concurrent open'})));await opening;m.storage.failNext({op:'read',key:KEYS.legacy});await m.integration.open();assert.ok(m.integration.state().recovery);assert.equal(m.integration.exportConfirmed(),before);
  const fresh=make(m.storage,m.lock);m.storage.failNext({op:'read',key:KEYS.legacy});await fresh.integration.open();assert.equal(fresh.integration.state().confirmed,null);assert.ok(fresh.integration.state().recovery);
});
test('importación v2 fallida conserva confirmado y el candidato completo con evidencias',async()=>{
  const m=await ready(),old=m.integration.exportConfirmed();m.storage.failNext({op:'write',key:KEYS.b});await m.integration.importBackup(JSON.stringify(documentV2()),{id:'import',confirmReplace:true});assert.equal(m.integration.exportConfirmed(),old);assert.deepEqual(m.integration.state().pending.document,documentV2());await m.integration.retry();assert.deepEqual(m.integration.state().confirmed,documentV2());
});
