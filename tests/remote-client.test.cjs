'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RemoteSession,digest,plannerPort,emulatorApi,localStore,apiFor}=require('./helpers/remote-client.cjs');
const {createService}=require('../remote/service.cjs'),{memoryPorts}=require('./helpers/remote.cjs'),{app,emptyData,routine,event,step,DAY}=require('./helpers/app.cjs');
const value=note=>JSON.stringify({...emptyData(),dayReviews:{[DAY]:{note,closedAt:'2030-01-07T12:00:00Z'}}});
let counter=0;const makeId=()=>('operation_'+String(++counter).padStart(20,'0'));
async function fixture(){const ports=memoryPorts(),service=createService(ports),store=localStore(),api=apiFor(service,'A'),session=new RemoteSession('A',store,api,()=>true,makeId);await session.open();return{ports,service,store,api,session};}
test('3B: stage is durable before network, confirmed stays separate, second write is blocked',async()=>{
 const {session,store}=await fixture();assert.equal(session.phase,'confirmed');assert.equal(session.confirmed,null);
 session.stage(value('one'));assert.equal(session.phase,'pending');assert.equal(session.confirmed,null);assert.equal(store.map.size,1);
 assert.throws(()=>session.stage(value('two')));const phases=[];session.onChange(()=>phases.push(session.phase));await session.retry();
 assert.equal(session.phase,'confirmed');assert.equal(session.confirmed.backup,value('one'));assert.equal(store.map.size,0);assert(phases.includes('confirming'));
});
test('3B: failed network, cold reload and stable retry preserve complete notes/photos',async()=>{
 const f=await fixture(),data=emptyData();data.logs['deleted@'+DAY]={completed:true,checkedSteps:['old'],note:'kept',choices:{old:'__base'},evidences:[{id:'photo',kind:'image',src:'data:image/jpeg;base64,YQ==',caption:'kept',createdAt:'2030-01-07'}]};
 const raw=JSON.stringify(data),offline={...f.api,save:async()=>{throw Error('offline');}};
 const first=new RemoteSession('A',f.store,offline,()=>true,makeId);await first.open();first.stage(raw);const id=first.pending.operationId;await first.retry();assert.equal(first.phase,'error');assert.equal(first.exportCandidate(),raw);
 const next=new RemoteSession('A',f.store,f.api,()=>true,makeId);await next.open();assert.equal(next.pending.operationId,id);assert.equal(next.workingRaw,raw);await next.retry();assert.equal(next.confirmed.revisionId,id);assert.deepEqual(JSON.parse((await f.api.read(null)).backup),data);
});
test('3B: lost acknowledgement inspects receipt before retry, without duplicating revisions',async()=>{
 const f=await fixture();let saves=0;
 const lost={...f.api,save:async data=>{saves++;await f.api.save(data);throw Error('response lost');}};
 const s=new RemoteSession('A',f.store,lost,()=>true,makeId);await s.open();s.stage(value('lost'));const id=s.pending.operationId;await s.retry();assert.equal(s.phase,'error');assert.equal(s.confirmed,null);
 await s.retry();assert.equal(s.phase,'confirmed');assert.equal(s.confirmed.revisionId,id);assert.equal(saves,1);assert.equal(f.ports.docs.size,3);
});
test('3B: two sessions conflict, keep both candidates and require explicit recovery',async()=>{
 const f=await fixture(),other=new RemoteSession('A',f.store,f.api,()=>true,makeId);await other.open();f.session.stage(value('first'));other.stage(value('second'));const second=other.pending.operationId;
 await f.session.retry();await other.retry();assert.equal(other.phase,'conflict');assert.equal(other.confirmed,null);assert.equal(other.exportCandidate(),value('second'));
 await assert.rejects(other.useServer(false));await other.useServer(true);assert.equal(other.confirmed.backup,value('first'));assert.equal(other.exportRecovery(second),value('second'));assert.equal(other.listRecoveries().length,1);
});
test('3B: multiple local candidates never choose a newest one automatically',async()=>{
 const f=await fixture(),second=new RemoteSession('A',f.store,f.api,()=>true,makeId);await second.open();f.session.stage(value('one'));second.stage(value('two'));
 const reloaded=new RemoteSession('A',f.store,f.api,()=>true,makeId);await reloaded.open();assert.equal(reloaded.phase,'conflict');assert.equal(reloaded.ready,false);assert.equal(reloaded.pending,null);assert.equal(reloaded.busy,false);
 await reloaded.open(second.pending.operationId);assert.equal(reloaded.workingRaw,value('two'));assert.equal(f.store.map.size,2);
});
test('3B: explicit restore appends a revision; no automatic rebase or deletion',async()=>{
 const f=await fixture();f.session.stage(value('old'));await f.session.retry();const old=f.session.confirmed.revisionId;f.session.stage(value('new'));await f.session.retry();const newer=f.session.confirmed.revisionId;
 await assert.rejects(f.session.restore(old,false));await f.session.restore(old,true);assert.equal(f.session.phase,'pending');assert.equal(f.session.confirmed.revisionId,newer);await f.session.retry();assert.equal(f.session.confirmed.backup,value('old'));assert.equal((await f.api.read(newer)).backup,value('new'));
});
test('3B: loading a replacement locks edits for the entire asynchronous read',async()=>{
 const f=await fixture();let release;const api={...f.api,read:()=>new Promise(resolve=>{release=()=>resolve(null);})};const s=new RemoteSession('A',f.store,api,()=>true,makeId);s.ready=true;let seen=false;s.onChange(()=>{if(s.hasPending)seen=true;});
 const reading=s.useServer(true);assert.equal(s.hasPending,true);assert(seen);assert.throws(()=>s.stage(value('must not race')));release();await reading;assert.equal(s.pending,null);assert.equal(s.hasPending,false);
});
test('3B: account switch during await leaves A candidate intact and never changes B',async()=>{
 const f=await fixture();let active=true,finish;const api={...f.api,save:data=>new Promise(resolve=>{finish=async()=>resolve(await f.api.save(data));})};
 const s=new RemoteSession('A',f.store,api,()=>active,makeId);await s.open();s.stage(value('A'));const job=s.retry();while(!finish)await new Promise(r=>setImmediate(r));active=false;await finish();await job;assert.equal(s.phase,'error');assert(s.pending);assert.equal(s.confirmed,null);
 const b=new RemoteSession('B',f.store,apiFor(f.service,'B'),()=>true,makeId);await b.open();assert.equal(b.confirmed,null);assert.equal(b.listPending().length,0);active=true;await s.retry();assert.equal(s.phase,'confirmed');
});
test('3B: unconfirmed receipt, corrupt journal and failed initial read do not become confirmed data',async()=>{
 const f=await fixture();const wrong={...f.api,save:async data=>({...await f.api.save(data),backupHash:'bad'})};const s=new RemoteSession('A',f.store,wrong,()=>true,makeId);await s.open();s.stage(value('safe'));await s.retry();assert.equal(s.phase,'error');assert(s.pending);await s.retry();assert.equal(s.phase,'confirmed');
 const unavailable=new RemoteSession('B',f.store,{...f.api,read:async()=>{throw Error('offline');}},()=>true,makeId);await unavailable.open();assert.equal(unavailable.ready,false);assert.throws(()=>unavailable.stage(value('unsafe')));
 const malformed=new RemoteSession('B',f.store,{...f.api,read:async()=>false},()=>true,makeId);await malformed.open();assert.equal(malformed.ready,false);
 const badKey='fullhouse-remote-lab-v1:demo-fullhouse-remote:C:pending:corrupt_operation_1';f.store.map.set(badKey,'{');const corrupt=new RemoteSession('C',f.store,f.api,()=>true,makeId);await corrupt.open();assert.equal(corrupt.ready,false);assert.equal(corrupt.exportOriginal('corrupt_operation_1'),'{');
});
test('3B: local quota blocks sending and retains the original BUG-01 export path',async()=>{
 const f=await fixture();const port=plannerPort(f.session,f.store,()=>true,()=>{},undefined,()=>{});const h=app({workspace:port,useLoadedData:true});f.store.fail(true);assert.equal(h.controller.save(JSON.parse(value('quota'))),false);assert.equal(h.controller.state.pending.valid,true);assert.equal(f.session.pending,null);assert.equal(f.ports.docs.size,0);assert.equal(h.controller.state.data.dayReviews,undefined);
});
test('3B: real Planner keeps PR19 guards, public local behavior and explicit queued messages',async()=>{
 const f=await fixture();f.store.map.set('fullhouse-v01','original');f.store.map.set('botanica-planificador-v01','alias');
 const port=plannerPort(f.session,f.store,()=>true,()=>{},undefined,()=>{}),h=app({workspace:port,useLoadedData:true});const data={...emptyData(),routines:[routine()],events:[event('event',{routineId:'routine'})],logs:{['event@'+DAY]:{completed:true,checkedSteps:['step'],note:'history'}}};
 assert.equal(h.controller.save(data),true);assert.match(h.controller.state.toast,/pendientes de confirmación/);assert.equal(f.session.confirmed,null);await f.session.retry();
 const changed=JSON.parse(JSON.stringify(data));changed.routines[0].steps.push(step('new'));assert.equal(h.controller.save(changed),false);assert.equal(f.session.pending,null);assert.equal(h.controller.state.data.routines[0].steps.length,1);
 assert.equal(f.store.map.get('fullhouse-v01'),'original');assert.equal(f.store.map.get('botanica-planificador-v01'),'alias');assert(!f.store.reads.includes('fullhouse-v01'));assert(!f.store.reads.includes('botanica-planificador-v01'));
 const local=app();assert(local.controller.save(emptyData(),'Saved locally'));assert.equal(local.controller.state.toast,'Saved locally');
});
test('3B: a delayed backup import cannot replace data changed after its confirmation',async()=>{
 const f=await fixture(),h=app({workspace:plannerPort(f.session,f.store,()=>true,()=>{},undefined,()=>{}),useLoadedData:true});
 const importing=h.importBackup(value('imported'));await new Promise(resolve=>setImmediate(resolve));const newer={...emptyData(),events:[event('newer')]};h.controller.state.data=newer;await importing;
 assert.deepEqual(h.controller.state.data,newer);assert.match(h.controller.state.toast,/datos cambiaron/);assert.equal(f.session.pending,null);assert.equal(f.ports.docs.size,0);
});
test('3B transport: real targets rejected; token captured for A, never replaced by B across awaits',async()=>{
 assert.throws(()=>emulatorApi('fullhouse-staging','localhost',()=>null,'A'));assert.throws(()=>emulatorApi('demo-fullhouse-remote','public.example',()=>null,'A'));
 let current,resolveToken,calls=0;const a={uid:'A',emailVerified:true,getIdToken:()=>new Promise(r=>{resolveToken=r;})},b={uid:'B',emailVerified:true,getIdToken:async()=> 'synthetic-B-token'};current=a;
 const api=emulatorApi('demo-fullhouse-remote','localhost',()=>current,'A',async()=>{calls++;return new Response(JSON.stringify({result:null}));});const request=api.read(null);current=b;resolveToken('synthetic-A-token');await assert.rejects(request);assert.equal(calls,0);
 let finish;current={uid:'A',emailVerified:true,getIdToken:async()=> 'synthetic-A-token'};const frozen=emulatorApi('demo-fullhouse-remote','localhost',()=>current,'A',async(_,options)=>{assert.equal(options.headers.authorization,'Bearer synthetic-A-token');return new Promise(r=>{finish=()=>r(new Response(JSON.stringify({result:null})));});});const after=frozen.read(null);while(!finish)await new Promise(r=>setImmediate(r));current=b;finish();await assert.rejects(after);
});
