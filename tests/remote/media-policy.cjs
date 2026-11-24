'use strict';
// Real Firestore/Storage emulators; Admin credentials never contact live projects.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const admin=require('node:module').createRequire(path.resolve(__dirname,'../../remote/package.json'));
const {initializeApp,deleteApp}=admin('firebase-admin/app'),{getFirestore,Timestamp}=admin('firebase-admin/firestore'),{getStorage}=admin('firebase-admin/storage');
const out=require('../../scripts/build-remote-staging.cjs').build(),{createMediaService}=require(path.join(out,'media.cjs')),{emptyData}=require('../helpers/app.cjs');
const project='demo-fullhouse-remote',uid='media_A',other='media_B',now=2000000000000,auth=id=>({uid:id,token:{email_verified:true}});
const image={id:'photo',kind:'image',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGVEAAAAASUVORK5CYII=',caption:'Sintética',createdAt:'2030-01-01T00:00:00Z'};
const data=(photos=[],note='')=>({...emptyData(),logs:{'event@2030-01-01':{completed:false,checkedSteps:[],note,evidences:photos}}}),cmd=(d,base=null)=>({operationId:crypto.randomUUID(),baseRevision:base,backup:JSON.stringify(d)});
let app,db,bucket,service,first;
before(()=>{
 assert.equal(process.env.GCLOUD_PROJECT,project);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8088');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');process.env.FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9198';
 app=initializeApp({projectId:project,storageBucket:project+'.appspot.com'},'media-policy');db=getFirestore(app);bucket=getStorage(app).bucket();service=createMediaService({db,bucket,now:()=>Timestamp.now(),clock:()=>now,trialUids:[uid]});
});
after(async()=>{if(app)await deleteApp(app);});
test('Free image import is denied without any confirmed revision',async()=>{
 await assert.rejects(service.save(auth(uid),cmd(data([image]))),{code:'permission-denied'});assert.equal((await db.doc(`users/${uid}/storage/head`).get()).exists,false);
});
test('server trial grants permit images, downgrade retains text/read/export/restore and denies new bindings',async()=>{
 const grant=db.doc('billingEntitlements/'+uid);await grant.set({version:1,uid,tier:'premium',source:'staging-owner',status:'active',revision:'owner-synthetic',validFromMs:now-1000,validUntilMs:now+1000});
 first=cmd(data([image]));await service.save(auth(uid),first);const ledger=await db.doc(`users/${uid}/mediaUsage/head`).get();assert.equal(Object.keys(ledger.data().bindings).length,1);
 await grant.delete();const edit=cmd(data([{...image,caption:'Texto corregido'}],'Nota'),first.operationId);await service.save(auth(uid),edit);
 assert.deepEqual(JSON.parse((await service.read(auth(uid),{revisionId:null})).backup),JSON.parse(edit.backup));
 await assert.rejects(service.save(auth(uid),cmd(data([image,{...image,id:'new'}]),edit.operationId)),{code:'permission-denied'});
 await service.restore(auth(uid),{operationId:crypto.randomUUID(),baseRevision:edit.operationId,restoreRevision:first.operationId});assert.equal((await service.read(auth(uid),{revisionId:null})).backup,first.backup);
 await assert.rejects(service.restore(auth(other),{operationId:crypto.randomUUID(),baseRevision:null,restoreRevision:first.operationId}),{code:'not-found'});assert.equal(await service.read(auth(other),{revisionId:null}),null);
});
test('failed media transaction commits no receipt, ledger or head; an uncertain ack is retryable',async()=>{
 let failure='transaction';const s=createMediaService({db,bucket,now:()=>Timestamp.now(),clock:()=>now,fault:async stage=>{if(stage===failure)throw Error('synthetic interrupted transaction');}}),pending=cmd(data([], 'Pending'));
 await assert.rejects(s.save(auth(other),pending));for(const p of ['storage/head','mediaUsage/head',`operations/${pending.operationId}`])assert.equal((await db.doc(`users/${other}/${p}`).get()).exists,false);
 failure='after-commit';await assert.rejects(s.save(auth(other),pending));failure=null;const receipt=await s.inspect(auth(other),{operationId:pending.operationId});assert.deepEqual(await s.save(auth(other),pending),receipt);
});
test('two emulator transactions keep a single confirmed base and a coherent inventory',async()=>{
 const current=await service.read(auth(other),{revisionId:null}),base=current.revisionId;
 const results=await Promise.allSettled([service.save(auth(other),cmd(data([], 'one'),base)),service.save(auth(other),cmd(data([], 'two'),base))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'failed-precondition');
 const head=(await db.doc(`users/${other}/storage/head`).get()).data();assert.equal(head.sequence,2);assert.equal((await db.doc(`users/${other}/mediaUsage/head`).get()).data().complete,true);
});
