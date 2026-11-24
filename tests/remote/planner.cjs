'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {RemoteSession,plannerPort,emulatorApi,localStore}=require('../helpers/remote-client.cjs'),{app,emptyData,DAY,routine,event,step}=require('../helpers/app.cjs');
const PROJECT='demo-fullhouse-remote';
const {load}=require('../helpers/remote-client.cjs'),{DurableWorkStore}=load('durable-store.ts'),{IDBFactory}=require('fake-indexeddb');
let a,b;let seq=0;const makeId=()=> 'planner_operation_'+String(++seq).padStart(18,'0');
async function user(uid){const r=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:uid+'@example.test',password:'Synthetic-Password-2030!',returnSecureToken:true})});const json=await r.json();assert(json.idToken);return{uid,emailVerified:true,getIdToken:async()=>json.idToken};}
const raw=note=>JSON.stringify({...emptyData(),dayReviews:{[DAY]:{note,closedAt:'2030-01-07T12:00:00Z'}}});
async function session(owner,store=localStore(),api=emulatorApi(PROJECT,'localhost',()=>owner,owner.uid)){
 const s=new RemoteSession(owner.uid,store,api,()=>true,makeId);await s.open();assert(s.ready,s.message);return s;
}
before(async()=>{assert.equal(process.env.GCLOUD_PROJECT,PROJECT);assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');console.log('3B DATA BACKEND: '+process.env.FULLHOUSE_REMOTE_DATA_MODE);a=await user('lab_A');b=await user('lab_B');});
test('Planner creates a goal, queues locally, confirms remotely and B stays empty',async()=>{
 const s=await session(a),store=localStore(),port=plannerPort(s,store,()=>true,()=>{},undefined,()=>{}),h=app({workspace:port,useLoadedData:true});h.controller.openGoal();h.controller.state.goalDraft.title='Synthetic remote goal';h.controller.saveGoal();
 assert.equal(h.controller.state.data.goals.length,1);assert.equal(s.phase,'pending');assert.match(h.controller.state.toast,/pendientes de confirmación/);await s.retry();assert.equal(s.phase,'confirmed');const other=await session(b);assert.equal(JSON.parse(other.workingRaw).goals.length,0);
});
test('two A sessions hit CAS; loser exports intact and loads server only explicitly',async()=>{
 const one=await session(a),two=await session(a);one.stage(raw('winner'));two.stage(raw('loser'));await one.retry();await two.retry();assert.equal(two.phase,'conflict');assert.equal(two.exportCandidate(),raw('loser'));const op=two.pending.operationId;await two.useServer(true);assert.equal(two.workingRaw,raw('winner'));assert.equal(two.exportRecovery(op),raw('loser'));
});
test('lost response and reload inspect the same receipt rather than duplicating a save',async()=>{
 const api=emulatorApi(PROJECT,'localhost',()=>a,a.uid),store=localStore();let saves=0;
 const lost={...api,save:async command=>{saves++;await api.save(command);throw Error('Synthetic response lost');}};const s=await session(a,store,lost);s.stage(raw('uncertain'));const id=s.pending.operationId;await s.retry();assert.equal(s.phase,'error');const reloaded=await session(a,store,api);await reloaded.retry();assert.equal(reloaded.confirmed.revisionId,id);assert.equal(saves,1);
});
test('network failure preserves pending candidate, then retry confirms with original identity',async()=>{
 const api=emulatorApi(PROJECT,'localhost',()=>b,b.uid),store=localStore(),offline={...api,save:async()=>{throw Error('Synthetic offline');}};const s=await session(b,store,offline);s.stage(raw('B offline'));const id=s.pending.operationId;await s.retry();assert.equal(s.phase,'error');const recovered=await session(b,store,api);assert.equal(recovered.pending.operationId,id);await recovered.retry();assert.equal(recovered.phase,'confirmed');
});
test('historical protections and full v1 notes/photos survive round-trip and explicit restore',async()=>{
 const s=await session(a),store=localStore(),h=app({workspace:plannerPort(s,store,()=>true,()=>{},undefined,()=>{}),useLoadedData:true});
 const data={...emptyData(),routines:[routine()],events:[event('event',{routineId:'routine'})],logs:{['event@'+DAY]:{completed:true,checkedSteps:['step'],note:'original',evidences:[{id:'photo',kind:'image',src:'data:image/jpeg;base64,YQ==',caption:'synthetic',createdAt:'2030-01-07'}]}}};
 assert(h.controller.save(data));await s.retry();assert.equal(s.phase,'confirmed');const original=s.confirmed.revisionId;
 const next=JSON.parse(JSON.stringify(data));next.routines[0].steps.push(step('later'));assert.equal(h.controller.save(next),false);assert.equal(s.pending,null);
 const same=await s.preview(original);assert.deepEqual(JSON.parse(same.backup),data);h.controller.save({...data,dayReviews:{[DAY]:{note:'new',closedAt:'2030-01-07'}}});await s.retry();const newer=s.confirmed.revisionId;await s.restore(original,true);await s.retry();assert.deepEqual(JSON.parse(s.workingRaw),data);assert((await s.preview(newer)).backup.includes('new'));
});
test('changing identity after HTTP dispatch cannot apply A response to B',async()=>{
 let current=a,finish;const native=fetch;
 const request=async(url,options)=>{const response=await native(url,options);if(String(url).endsWith('/saveRemoteV1'))await new Promise(resolve=>{finish=resolve;});return response;};
 const api=emulatorApi(PROJECT,'localhost',()=>current,a.uid,request),store=localStore(),s=new RemoteSession(a.uid,store,api,()=>current===a,makeId);await s.open();s.stage(raw('A after switch'));const pending=s.retry();while(!finish)await new Promise(r=>setImmediate(r));current=b;finish();await pending;assert.equal(s.phase,'error');assert(s.pending);current=a;await s.retry();assert.equal(s.phase,'confirmed');
});
test('3B.2 durable outbox reopens with original UID/base/ID and exact v1 photos over HTTP',async()=>{
 const factory=new IDBFactory(),store=new DurableWorkStore(a.uid,factory,'fullhouse-lab-http'),api=emulatorApi(PROJECT,'localhost',()=>a,a.uid),offline={...api,save:async()=>{throw Error('Synthetic network outage');}};
 const s=await session(a,store,offline),data=JSON.parse(s.workingRaw);data.dayReviews={...data.dayReviews,[DAY]:{note:'Durable HTTP candidate',closedAt:DAY}};const backup=JSON.stringify(data);s.stage(backup);await s.retry();assert.equal(s.phase,'error');assert.equal(s.durability,'durable');const id=s.pending.operationId,base=s.pending.baseRevision;store.close();
 const nextStore=new DurableWorkStore(a.uid,factory,'fullhouse-lab-http'),next=await session(a,nextStore,api);assert.equal(next.pending.operationId,id);assert.equal(next.pending.baseRevision,base);assert.equal(next.workingRaw,backup);await next.retry();assert.equal(next.phase,'confirmed');assert.equal((await next.preview(id)).backup,backup);nextStore.close();
});
