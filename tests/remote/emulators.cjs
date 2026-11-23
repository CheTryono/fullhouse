'use strict';
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict'),fs = require('node:fs'),path = require('node:path');
const backendRequire = require('node:module').createRequire(path.resolve(__dirname,'../../remote/package.json'));
const {initializeApp:adminApp,deleteApp:deleteAdmin} = backendRequire('firebase-admin/app');
const {getAuth:adminAuth} = backendRequire('firebase-admin/auth');
const {getFirestore:adminFirestore,Timestamp} = backendRequire('firebase-admin/firestore');
const {getStorage:adminStorage} = backendRequire('firebase-admin/storage');
const {initializeApp,deleteApp} = require('firebase/app');
const {initializeAuth,inMemoryPersistence,connectAuthEmulator,signInWithEmailAndPassword} = require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,getDoc,getDocs,collection,setDoc,updateDoc,deleteDoc,terminate} = require('firebase/firestore');
const {getStorage,connectStorageEmulator,ref,getBytes,uploadBytes,deleteObject,getDownloadURL} = require('firebase/storage');
const {getFunctions,connectFunctionsEmulator,httpsCallable} = require('firebase/functions');
const {createService} = require('../../remote/service.cjs');
const {hash} = require('../../remote/contract.cjs');
const projectId='demo-fullhouse-remote',bucketName=projectId+'.appspot.com',clients=[];
let admin,db,bucket,service,a,b,unverified,anon;
const auth = uid=>({uid,token:{email_verified:true}});
const empty = ()=>({version:1,goals:[],routines:[],events:[],logs:{}});
function sample(note='original') {
 const data=empty();data.logs['deleted-event@2030-01-07']={completed:true,checkedSteps:['old-step'],choices:{'old-step':'__base'},note,stepNotes:{'old-step':'retained note'},evidences:[{id:'photo_A',kind:'image',src:'data:image/png;base64,aGVsbG8=',caption:'synthetic',stepId:'old-step',createdAt:'2030-01-07T12:00:00Z'}]};
 return data;
}
const command=(operationId,baseRevision,data=sample())=>({operationId,baseRevision,backup:JSON.stringify(data)});
const call=(client,name,data)=>httpsCallable(client.functions,name)(data).then(x=>x.data);
const rejects=(promise,code)=>assert.rejects(promise,e=>e.code==='functions/'+code);
const assertFails=promise=>assert.rejects(promise,e=>['permission-denied','storage/unauthorized'].includes(e.code));
const assertSucceeds=promise=>promise;
async function client(name,uid) {
 const app=initializeApp({projectId,apiKey:'demo-key',authDomain:projectId+'.firebaseapp.com',storageBucket:bucketName},name);
 const access=initializeAuth(app,{persistence:inMemoryPersistence});connectAuthEmulator(access,'http://127.0.0.1:9098',{disableWarnings:true});
 const firestore=getFirestore(app);connectFirestoreEmulator(firestore,'127.0.0.1',8088);
 const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9198);
 const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',5002);
 const value={app,access,firestore,storage,functions};clients.push(value);
 if(uid)await signInWithEmailAndPassword(access,uid+'@example.test','Synthetic-Password-2030!');
 return value;
}
before(async()=>{
 assert.equal(process.env.GCLOUD_PROJECT,projectId);
 for(const [key,port]of [['FIREBASE_AUTH_EMULATOR_HOST',9098],['FIRESTORE_EMULATOR_HOST',8088],['FIREBASE_STORAGE_EMULATOR_HOST',9198]])assert.equal(process.env[key],'127.0.0.1:'+port,'No se permite ejecutar contra servicios reales');
 admin=adminApp({projectId,storageBucket:bucketName},'remote-emulator-test');db=adminFirestore(admin);bucket=adminStorage(admin).bucket();service=createService({db,bucket,now:()=>Timestamp.now()});
 for(const uid of ['synthetic_A','synthetic_B','synthetic_unverified'])await adminAuth(admin).createUser({uid,email:uid+'@example.test',password:'Synthetic-Password-2030!',emailVerified:uid!=='synthetic_unverified'});
 a=await client('A','synthetic_A');b=await client('B','synthetic_B');unverified=await client('unverified','synthetic_unverified');anon=await client('anonymous');
});
after(async()=>{await Promise.all(clients.map(async c=>{await terminate(c.firestore);await deleteApp(c.app);}));if(admin)await deleteAdmin(admin);});
test('real callable/Auth emulators: verified A saves and reads v1; empty B has no adopted local data',async()=>{
 assert.equal(await call(b,'readRemoteV1',{revisionId:null}),null);
 const result=await call(a,'saveRemoteV1',command('initial_operation_A',null));assert.equal(result.sequence,1);
 const loaded=await call(a,'readRemoteV1',{revisionId:null});assert.deepEqual(JSON.parse(loaded.backup),sample());assert.equal(hash(loaded.backup),loaded.backupHash);
 assert.equal(await call(b,'readRemoteV1',{revisionId:null}),null);
});
test('rules: no public/cross-account reads, queries, writes, owner tampering or photo download tokens',async()=>{
 const p='users/synthetic_A/storage/head',r='users/synthetic_A/revisions/initial_operation_A',o='users/synthetic_A/operations/initial_operation_A';
 for(const client of [b,anon,unverified])for(const target of [p,r,o])await assertFails(getDoc(doc(client.firestore,target)));
 for(const target of [p,r,o])await assertSucceeds(getDoc(doc(a.firestore,target)));
 for(const c of [a,b,anon,unverified]){
  await assertFails(getDocs(collection(c.firestore,'users')));
  await assertFails(getDocs(collection(c.firestore,'users/synthetic_A/revisions')));
  await assertFails(setDoc(doc(c.firestore,'users/synthetic_A/storage/head'),{uid:'synthetic_B',role:'admin'}));
  await assertFails(updateDoc(doc(c.firestore,p),{uid:'synthetic_B',sequence:-1,extra:'x'.repeat(10000)}));
  await assertFails(deleteDoc(doc(c.firestore,r)));
  await assertFails(setDoc(doc(c.firestore,'users/synthetic_B/operations/forged_operation_B'),{uid:'synthetic_A'}));
 }
 const sha=hash(sample().logs['deleted-event@2030-01-07'].evidences[0].src),objectPath=`users/synthetic_A/photos/${sha}.dataurl`;
 for(const c of [a,b,anon,unverified]){
  const file=ref(c.storage,objectPath);
  await assertFails(getBytes(file));await assertFails(getDownloadURL(file));await assertFails(uploadBytes(file,Buffer.from('attack')));await assertFails(deleteObject(file));
 }
 const [meta]=await bucket.file(objectPath).getMetadata();assert(!meta.metadata?.firebaseStorageDownloadTokens);
});
test('backend: no unauthenticated/unverified access, UID injection, malformed backup or foreign revisions',async()=>{
 await rejects(call(anon,'readRemoteV1',{revisionId:null}),'unauthenticated');
 await rejects(call(unverified,'saveRemoteV1',command('unverified_operation',null)),'permission-denied');
 await rejects(call(b,'readRemoteV1',{revisionId:'initial_operation_A'}),'not-found');
 await rejects(call(b,'restoreRemoteV1',{operationId:'foreign_restore_B',baseRevision:null,restoreRevision:'initial_operation_A'}),'not-found');
 await rejects(call(b,'readRemoteV1',{revisionId:null,uid:'synthetic_A'}),'invalid-argument');
 for(const backup of ['{',JSON.stringify({...empty(),routines:[null]}),JSON.stringify({...empty(),version:2})])await rejects(call(a,'saveRemoteV1',{operationId:'malformed_operation',baseRevision:'initial_operation_A',backup}),'invalid-argument');
 assert.equal((await call(a,'readRemoteV1',{revisionId:null})).revisionId,'initial_operation_A');
});
test('idempotency survives lost responses; altered command cannot reuse an operation ID',async()=>{
 const value=command('initial_operation_A',null);
 const first=await call(a,'saveRemoteV1',value),second=await call(a,'saveRemoteV1',value);assert.deepEqual(second,first);
 await rejects(call(a,'saveRemoteV1',command('initial_operation_A',null,sample('changed'))),'already-exists');
 assert.equal((await call(a,'inspectRemoteV1',{operationId:'initial_operation_A'})).revisionId,'initial_operation_A');
});
test('two authenticated sessions race: one CAS winner and one preserved conflicting candidate',async()=>{
 const other=await client('A-second-tab','synthetic_A');
 const result=await Promise.allSettled([call(a,'saveRemoteV1',command('race_operation_1_A','initial_operation_A',sample('one'))),call(other,'saveRemoteV1',command('race_operation_2_A','initial_operation_A',sample('two')))]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.filter(x=>x.status==='rejected'&&x.reason.code==='functions/failed-precondition').length,1);
 const current=await call(a,'readRemoteV1',{revisionId:null});assert.deepEqual(JSON.parse(current.backup),sample(current.revisionId==='race_operation_1_A'?'one':'two'));
 assert.deepEqual(JSON.parse((await call(a,'readRemoteV1',{revisionId:'initial_operation_A'})).backup),sample());
});
test('storage interruption and multi-document TX abort preserve head, revision and receipt; stable retry succeeds',async()=>{
 for(const stage of ['before-upload','after-upload','transaction']){
  const old=await call(a,'readRemoteV1',{revisionId:null}),id='fault_'+stage.replaceAll('-','_')+'_A';
  const value=command(id,old.revisionId,sample(stage)),original=JSON.stringify(value);
  const broken=createService({db,bucket,now:()=>Timestamp.now(),fault:async at=>{if(at===stage)throw Error('Synthetic interrupted storage operation');}});
  await assert.rejects(broken.save(auth('synthetic_A'),value));
  assert.equal(JSON.stringify(value),original);assert.deepEqual(await call(a,'readRemoteV1',{revisionId:null}),old);
  assert.equal((await db.doc(`users/synthetic_A/revisions/${id}`).get()).exists,false);assert.equal(await call(a,'inspectRemoteV1',{operationId:id}),null);
  const saved=await call(a,'saveRemoteV1',value);assert.equal(saved.revisionId,id);
 }
});
test('simulated quota refusal cannot replace confirmed metadata; lost post-commit acknowledgement is inspectable',async()=>{
 const old=await call(a,'readRemoteV1',{revisionId:null});
 const refused=createService({db,bucket:{file(){return {save:async()=>{const e=Error('Synthetic quota exhausted');e.code=429;throw e;}};}},now:()=>Timestamp.now()});
 await assert.rejects(refused.save(auth('synthetic_A'),command('quota_operation_A',old.revisionId,sample('quota'))));assert.deepEqual(await call(a,'readRemoteV1',{revisionId:null}),old);
 for(const stage of ['after-commit','confirmation']){
  const base=(await call(a,'readRemoteV1',{revisionId:null})).revisionId,value=command('lost_'+stage.replaceAll('-','_')+'_A',base,sample(stage));
  const uncertain=createService({db,bucket,now:()=>Timestamp.now(),fault:async at=>{if(at===stage)throw Error('Synthetic lost acknowledgement');}});
  await assert.rejects(uncertain.save(auth('synthetic_A'),value));
  const receipt=await call(a,'inspectRemoteV1',{operationId:value.operationId});assert.equal(receipt.revisionId,value.operationId);
  assert.deepEqual(await call(a,'saveRemoteV1',value),receipt);
 }
});
test('all nine historical writers save/read through Functions; explicit restore appends and retains previous revisions',async()=>{
 let base=null;
 for(let n=1;n<=9;n++){
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,`../fixtures/historical/v0${n}.json`),'utf8')).data;
  const value=command('historical_operation_'+n+'_B',base,data);await call(b,'saveRemoteV1',value);base=value.operationId;
  assert.deepEqual(JSON.parse((await call(b,'readRemoteV1',{revisionId:null})).backup),data);
 }
 const restored=await call(b,'restoreRemoteV1',{operationId:'restored_operation_B',baseRevision:base,restoreRevision:'historical_operation_1_B'});
 assert.equal(restored.sequence,10);
 const first=await call(b,'readRemoteV1',{revisionId:'historical_operation_1_B'}),active=await call(b,'readRemoteV1',{revisionId:null});assert.equal(active.backup,first.backup);
 assert.equal((await call(b,'readRemoteV1',{revisionId:base})).revisionId,base);
 await rejects(call(b,'restoreRemoteV1',{operationId:'stale_restore_operation_B',baseRevision:base,restoreRevision:'historical_operation_2_B'}),'failed-precondition');
});
test('missing/corrupt objects block recovery without claiming a complete backup or resetting head',async()=>{
 const uid='synthetic_corruption',value=command('corrupt_operation_id',null,sample('corrupt'));
 await service.save(auth(uid),value);const headPath=`users/${uid}/storage/head`,before=(await db.doc(headPath).get()).data();
 const file=bucket.file(`users/${uid}/revisions/${value.operationId}.json`),[original]=await file.download();
 await file.save(Buffer.from('corrupt'),{resumable:false});
 await assert.rejects(service.read(auth(uid),{revisionId:null}),{code:'data-loss'});assert.deepEqual((await db.doc(headPath).get()).data(),before);
 await file.save(original,{resumable:false});
 const photoPath=`users/${uid}/photos/${hash(sample().logs['deleted-event@2030-01-07'].evidences[0].src)}.dataurl`;await bucket.file(photoPath).delete();
 await assert.rejects(service.inspect(auth(uid),{operationId:value.operationId}),{code:'data-loss'});assert.deepEqual((await db.doc(headPath).get()).data(),before);
});
