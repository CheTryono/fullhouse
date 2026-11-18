'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {documentV2,clone,key}=require('./fixtures/history-v2.cjs');
const {schedule}=require('./helpers/history-integration.cjs');
const model=require('../history/storage-model.cjs'),archive=require('../history/storage-archive.cjs'),sources=require('../history/storage-sources.cjs');
const legacy=schedule.validData;
test('modelo IDB: separa blobs y devuelve todos los hechos/fotos originales',async()=>{
  const doc=documentV2(),before=clone(doc),plan=await model.prepareDocument(doc,legacy);assert.equal(plan.images.length,1);assert.equal(JSON.stringify(plan.tables).includes('data:image'),false);assert.deepEqual(await model.hydrate(plan,legacy),doc);assert.deepEqual(doc,before);
});
test('modelo IDB: deduplica bytes conservando propietarios de evidencia diferentes',async()=>{
  const doc=documentV2(),copy=clone(doc.logs[key]);copy.history.capture.executionId='other';copy.history.capture.seriesId='other';doc.logs.other=copy;
  const plan=await model.prepareDocument(doc,legacy);assert.equal(plan.images.length,1);assert.equal(plan.tables.evidence.length,2);assert.equal(new Set(plan.tables.evidence.map(e=>e.value.owner)).size,2);
});
test('archivo portable binario: roundtrip, truncado, versión incorrecta y corrupción',async()=>{
  const doc=documentV2(),plan=await model.prepareDocument(doc,legacy),file=await archive.exportArchive(plan,legacy),restored=await archive.importArchive(file,legacy);assert.deepEqual(await model.hydrate(restored,legacy),doc);
  await assert.rejects(archive.importArchive(file.slice(0,file.size-1),legacy));await assert.rejects(archive.importArchive(new Blob(['wrong']),legacy));
  const bad={...plan,images:[{...plan.images[0],blob:new Blob(['wrong'])}]};await assert.rejects(model.verifyPlan(bad,legacy));
});
test('alias: coincidencia de bytes/hechos y divergencia requieren selección explícita',async()=>{
  const d={version:1,goals:[],routines:[],events:[],logs:{old:{completed:false,checkedSteps:['missing'],note:'Original'}}},raw=JSON.stringify(d),copies={main:raw,alias:raw};
  assert.equal((await sources.inspectSources(copies,legacy)).status,'same-bytes');assert.equal((await sources.inspectSources({main:raw,alias:JSON.stringify(d,null,2)},legacy)).status,'same-facts');
  const divergent={main:raw,alias:JSON.stringify({...d,logs:{}})};assert.equal((await sources.inspectSources(divergent,legacy)).status,'divergent');await assert.rejects(sources.proposeMigration(divergent,null,legacy));
  const p=await sources.proposeMigration(divergent,'main',legacy);assert.deepEqual((await model.hydrate(p.plan,legacy)).logs,d.logs);assert.equal(divergent.main,raw);assert.deepEqual(p.sources,divergent);
});
test('migración: nueve exportaciones 0.1–0.9 conservan hechos, dataURL y bytes',async()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'fixtures/historical');
  for(const f of fs.readdirSync(dir).filter(f=>/^v\d+\.json$/.test(f))){const doc=JSON.parse(fs.readFileSync(path.join(dir,f))).data,raw=JSON.stringify(doc),p=await sources.proposeMigration({main:raw,alias:null},'main',legacy),after=await model.hydrate(p.plan,legacy);delete after.recipeRevisions;after.version=1;assert.deepEqual(after,doc);assert.equal(p.sources.main,raw);}
});
test('modelo: falla sin alterar original ante referencias, getters y foto no canónica',async()=>{
  const doc=documentV2();doc.logs[key].history.capture.recipeRevisionId='missing';const before=clone(doc);await assert.rejects(model.prepareDocument(doc,legacy));assert.deepEqual(doc,before);
  let executed=false;const getter={get version(){executed=true;return 2;}};await assert.rejects(model.prepareDocument(getter,legacy));assert.equal(executed,false);
  const malformed=documentV2();malformed.logs[key].evidences[0].src='data:image/png;base64,AA';await assert.rejects(model.prepareDocument(malformed,legacy));
});
test('IDB: sin factory no abre ejemplos ni vuelve a localStorage; solo nombres lab',async()=>{
  const {createLabDatabase}=require('../history/storage-idb.cjs');assert.throws(()=>createLabDatabase({name:'fullhouse',legacy}));const db=createLabDatabase({factory:null,name:'fullhouse-lab-unavailable',legacy});assert.equal((await db.open()).status,'recovery');
});
test('formato físico: rechaza índices falsos, imágenes sin dueño y fuentes corruptas',async()=>{
  const plan=await model.prepareDocument(documentV2(),legacy),badIndex=structuredClone(plan);badIndex.tables.executions[0].executionId='wrong';await assert.rejects(model.verifyPlan(badIndex,legacy));
  const extra=structuredClone(plan);extra.images.push({hash:await model.bytesHash(new Blob(['unused'])),size:6,blob:new Blob(['unused'])});await assert.rejects(model.verifyPlan(extra,legacy));
  const source=structuredClone(plan);source.sourceBackups=[{id:'["m","main"]',migrationId:'m',source:'main',raw:'original',hash:'incorrect'}];await assert.rejects(model.verifyPlan(source,legacy));
  const invalid=documentV2();invalid.recipeRevisions=[];await assert.rejects(model.prepareDocument(invalid,legacy));
});
test('preparación asíncrona toma un snapshot antes del primer await',async()=>{
  const doc=documentV2(),original=clone(doc),promise=model.prepareDocument(doc,legacy);doc.logs[key].note='Changed while hashing';doc.routines[0].title='Changed template';const plan=await promise;assert.deepEqual(await model.hydrate(plan,legacy),original);
});
