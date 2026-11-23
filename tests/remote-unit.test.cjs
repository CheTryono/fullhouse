'use strict';
const {test} = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs'),path = require('node:path');
const {app,emptyData} = require('./helpers/app.cjs');
const {LIMITS,identity,operation,packBackup,unpackBackup,parseBackup,hash} = require('../remote/contract.cjs');
const {createService} = require('../remote/service.cjs');
const {memoryPorts} = require('./helpers/remote.cjs');
test('remote v1 validator matches the public validator, with all nine real historic writers',()=>{
  const {validData} = require('../remote/v1-validator.cjs');
  for (let n=1;n<=9;n++) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname,`fixtures/historical/v0${n}.json`),'utf8')).data;
    assert.equal(validData(data),true);assert.equal(app().call('validData',data),true);
    assert.deepEqual(parseBackup(JSON.stringify(data)),data);
  }
  for (const data of [null,{}, {...emptyData(),routines:[null]}, {...emptyData(),goals:[{}]}, {...emptyData(),version:2}]) assert.throws(()=>parseBackup(JSON.stringify(data)),{code:'invalid-argument'});
});
test('remote requests derive ownership from verified auth and forbid UID injection',()=>{
  assert.throws(()=>identity(null),{code:'unauthenticated'});
  assert.throws(()=>identity({uid:'A',token:{email_verified:false}}),{code:'permission-denied'});
  assert.throws(()=>identity({uid:'../B',token:{email_verified:true}}),{code:'unauthenticated'});
  assert.equal(identity({uid:'A',token:{email_verified:true}}),'A');
  assert.throws(()=>operation({operationId:'operation_000001',baseRevision:null,backup:'{}',uid:'B'},'save'),{code:'invalid-argument'});
});
test('private snapshot deduplicates sources, preserves every photo owner and round-trips v1 facts',async()=>{
  const data=emptyData(),photo={id:'image',kind:'image',src:'data:image/png;base64,aGVsbG8=',caption:'Synthetic photo',stepId:'deleted-step',createdAt:'2030-01-07T12:00:00Z'};
  data.logs['deleted-event@2030-01-07']={completed:true,checkedSteps:['missing-step'],stepNotes:{'missing-step':'original'},choices:{'old-step':'__base'},note:'kept',evidences:[photo,{...photo,id:'other'}]};
  data.extra={keep:'unknown v1 fields'};
  const packed=packBackup(JSON.stringify(data));assert.equal(packed.photos.size,1);
  assert.equal(packed.snapshot.includes(Buffer.from(photo.src)),false);
  const backup=await unpackBackup(packed.snapshot,async sha=>packed.photos.get(sha));
  assert.deepEqual(JSON.parse(backup),data);assert.equal(hash(backup),packed.backupHash);
  assert.equal(data.logs['deleted-event@2030-01-07'].evidences[0].src,photo.src);
  await assert.rejects(unpackBackup(packed.snapshot,async()=>Buffer.from('wrong')),{code:'data-loss'});
});
test('malformed/overlarge v1 data is rejected before becoming a candidate',()=>{
  for (const raw of ['{','null','[]']) assert.throws(()=>parseBackup(raw),{code:'invalid-argument'});
  assert.throws(()=>parseBackup(' '.repeat(LIMITS.backupBytes+1)),{code:'resource-exhausted'});
  const data=emptyData();let nested=data;for(let n=0;n<70;n++)nested=nested.child={};
  assert.throws(()=>parseBackup(JSON.stringify(data)),{code:'resource-exhausted'});
  const many={...emptyData(),extra:Array(100001).fill(0)};
  assert.throws(()=>parseBackup(JSON.stringify(many)),{code:'resource-exhausted'});
  const photo={id:'p',kind:'image',src:'data:image/jpeg;base64,YQ==',caption:'',createdAt:'2030-01-01'};
  const long=emptyData();long.logs['x'.repeat(1025)]={completed:false,checkedSteps:[],evidences:[photo]};
  assert.throws(()=>packBackup(JSON.stringify(long)),{code:'resource-exhausted'});
});
test('invalid/duplicate attachment mappings cannot produce a complete backup',async()=>{
  const data=emptyData();data.logs.x={completed:false,checkedSteps:[],evidences:[{id:'p',kind:'image',src:'data:image/jpeg;base64,YQ==',caption:'',createdAt:'2030-01-01'}]};
  const p=packBackup(JSON.stringify(data)),e=JSON.parse(p.snapshot);e.attachments.push({...e.attachments[0]});
  await assert.rejects(unpackBackup(Buffer.from(JSON.stringify(e)),async sha=>p.photos.get(sha)),{code:'data-loss'});
});
const owner=uid=>({uid,token:{email_verified:true}});
const save=(operationId,baseRevision,note='')=>({operationId,baseRevision,backup:JSON.stringify({...emptyData(),marker:note})});
test('service ports: isolated owners, immutable revisions, idempotency and explicit restoring',async()=>{
  const ports=memoryPorts(),s=createService(ports),a=owner('A'),b=owner('B');
  const first=save('first_operation_01',null,'original');
  const receipt=await s.save(a,first);assert.equal(receipt.sequence,1);assert.deepEqual(await s.save(a,first),receipt);
  assert.equal(await s.read(b,{revisionId:null}),null);
  await assert.rejects(s.read(b,{revisionId:first.operationId}),{code:'not-found'});
  await assert.rejects(s.save(a,{...first,backup:JSON.stringify(emptyData())}),{code:'already-exists'});
  await s.save(a,save('second_operation_02',first.operationId,'next'));
  const restored=await s.restore(a,{operationId:'restore_operation_03',baseRevision:'second_operation_02',restoreRevision:first.operationId});
  assert.equal(restored.sequence,3);assert.equal((await s.read(a,{revisionId:null})).backup,first.backup);
  assert.equal((await s.read(a,{revisionId:'second_operation_02'})).backup,save('unused',null,'next').backup);
  assert.equal(ports.docs.size,7); // head + three immutable revision/receipt pairs.
});
test('service ports: all pre-commit interruptions preserve confirmed data and stable retries',async()=>{
  for(const stage of ['before-upload','after-upload','before-transaction','transaction']){
    const ports=memoryPorts(),s=createService(ports),a=owner('A');
    await s.save(a,save('base_operation_01',null,'base'));
    const before=await s.read(a,{revisionId:null}),command=save('fault_operation_02','base_operation_01',stage),original=JSON.stringify(command);
    const broken=createService({...ports,fault:async at=>{if(at===stage)throw Error('Synthetic interruption');}});
    await assert.rejects(broken.save(a,command));
    assert.deepEqual(await s.read(a,{revisionId:null}),before);assert.equal(ports.docs.size,3);assert.equal(await s.inspect(a,{operationId:command.operationId}),null);assert.equal(JSON.stringify(command),original);
    const receipt=await s.save(a,command);assert.equal(receipt.operationId,command.operationId);assert.equal(ports.docs.size,5);
  }
});
test('service ports: concurrent CAS, uncertain confirmations and refusal of corruption',async()=>{
  const ports=memoryPorts(),s=createService(ports),a=owner('A');
  const first=await s.save(a,save('base_operation_01',null));
  const race=await Promise.allSettled([s.save(a,save('racing_operation_1',first.revisionId,'a')),s.save(a,save('racing_operation_2',first.revisionId,'b'))]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected'&&x.reason.code==='failed-precondition').length,1);
  for(const stage of ['after-commit','confirmation']){
    const base=(await s.read(a,{revisionId:null})).revisionId,command=save('lost_'+stage.replaceAll('-','_')+'_01',base,stage);
    const lost=createService({...ports,fault:async at=>{if(at===stage)throw Error('Synthetic lost response');}});
    await assert.rejects(lost.save(a,command));
    assert.deepEqual(await s.save(a,command),await s.inspect(a,{operationId:command.operationId}));
  }
  const headBefore=ports.docs.get('users/A/storage/head');
  ports.objects.set(`users/A/revisions/${headBefore.revisionId}.json`,Buffer.from('corruption'));
  await assert.rejects(s.read(a,{revisionId:null}),{code:'data-loss'});assert.deepEqual(ports.docs.get('users/A/storage/head'),headBefore);
});
