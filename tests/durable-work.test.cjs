'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
const {load,RemoteSession,apiFor,localStore}=require('./helpers/remote-client.cjs'),{DurableWorkStore}=load('durable-store.ts');
const {memoryPorts}=require('./helpers/remote.cjs'),{createService}=require('../remote/service.cjs');
const {emptyData}=require('./helpers/app.cjs');
const raw=note=>JSON.stringify({...emptyData(),note}),op=()=>crypto.randomUUID();
async function setup(fault){const factory=new IDBFactory(),store=new DurableWorkStore('A',factory,'fullhouse-lab-unit',fault),ports=memoryPorts(),service=createService(ports),api=apiFor(service,'A'),session=new RemoteSession('A',store,api,()=>true,op);await session.open();return{factory,store,ports,service,api,session};}
test('IDB outbox commits before any remote call and survives close/reopen with stable ID',async()=>{
 const f=await setup();let reads=0;const api={...f.api,inspect:async id=>{assert.equal(s.durability,'durable');reads++;return f.api.inspect(id);}};const s=new RemoteSession('A',f.store,api,()=>true,op);await s.open();s.stage(raw('pending'));const id=s.pending.operationId;assert.notEqual(s.durability,'durable');assert.equal(reads,0);
 while(s.busy)await new Promise(r=>setImmediate(r));assert.equal(s.durability,'durable');f.store.close();
 const nextStore=new DurableWorkStore('A',f.factory,'fullhouse-lab-unit'),next=new RemoteSession('A',nextStore,f.api,()=>true,op);await next.open();assert.equal(next.pending.operationId,id);assert.equal(next.workingRaw,raw('pending'));await next.retry();assert.equal(next.phase,'confirmed');assert.equal(next.confirmed.revisionId,id);assert.equal(nextStore.length,0);nextStore.close();
});
test('aborted journal transaction keeps RAM candidate, stable retry and previous confirmed data',async()=>{
 let fail=false;const f=await setup((kind,tx)=>{if(fail&&kind==='journal')tx.abort();});f.session.stage(raw('base'));await f.session.retry();const base=f.session.confirmed;fail=true;f.session.stage(raw('new'));const id=f.session.pending.operationId;await f.session.retry();assert.equal(f.session.durability,'error');assert.equal(f.session.confirmed,base);assert.equal(f.ports.docs.size,3);assert.equal(f.session.exportCandidate(),raw('new'));fail=false;await f.session.retry();assert.equal(f.session.confirmed.revisionId,id);assert.equal(f.session.durability,'durable');f.store.close();
});
test('UID scoping, immutable candidates and archive abort cannot delete or replace other work',async()=>{
 let fail=false;const f=await setup((kind,tx)=>{if(fail&&kind==='archive')tx.abort();});const a=f.store.prefix+'pending:immutable_operation_1';await f.store.persist(a,'original');await assert.rejects(f.store.persist(a,'other'));const b=new DurableWorkStore('B',f.factory,'fullhouse-lab-unit');await b.ready();assert.equal(b.length,0);assert.throws(()=>b.getItem(a));await assert.rejects(b.persist(a,'B'));
 fail=true;await assert.rejects(f.store.archivePersisted(a,f.store.prefix+'recovery:immutable_operation_1','original'));assert.equal(f.store.getItem(a),'original');fail=false;await f.store.archivePersisted(a,f.store.prefix+'recovery:immutable_operation_1','original');assert.equal(f.store.getItem(a),null);assert.equal(f.store.getItem(f.store.prefix+'recovery:immutable_operation_1'),'original');f.store.close();b.close();
});
test('draft checkpoints CAS and photo bytes survive real structured clone without UID mixing',async()=>{
 const f=await setup(),first=await f.store.saveDraft('stream',0,'synthetic draft');await assert.rejects(f.store.saveDraft('stream',0,'stale'));const bytes=new Uint8Array(3*1024*1024).fill(37),file=new File([bytes],'synthetic.png',{type:'image/png'});await f.store.savePhoto('photo',{eventId:'original',date:'2030-01-07',stepId:'old',baseRevision:null},file);f.store.close();
 const next=new DurableWorkStore('A',f.factory,'fullhouse-lab-unit');assert.equal((await next.drafts())[0].raw,first.raw);const [photo]=await next.photos();assert.equal(photo.context.eventId,'original');assert.deepEqual(new Uint8Array(await photo.blob.arrayBuffer()),bytes);const other=new DurableWorkStore('B',f.factory,'fullhouse-lab-unit');assert.equal((await other.drafts()).length,0);assert.equal((await other.photos()).length,0);next.close();other.close();
});
test('legacy copying is explicit, preserves original LS bytes and operation identity',async()=>{
 const f=await setup(),legacy=localStore(),old=new RemoteSession('A',legacy,f.api,()=>true,op);await old.open();old.stage(raw('old'));const id=old.pending.operationId,journal=JSON.stringify(JSON.parse([...legacy.map.values()][0]),null,2);await assert.rejects(f.session.copyLegacy(id,journal,false));await f.session.copyLegacy(id,journal,true);assert.equal(f.session.pending.operationId,id);assert.equal(legacy.map.size,1);await f.session.retry();assert.equal(f.session.confirmed.revisionId,id);assert.equal(legacy.map.size,1);assert(f.store.getItem(f.store.prefix+'legacy:'+id));f.store.close();
});
test('unavailable/incompatible IndexedDB blocks initialization instead of falling back or deleting data',async()=>{
 const factory={open(){throw new DOMException('Denied','SecurityError');}},store=new DurableWorkStore('A',factory,'fullhouse-lab-denied');const s=new RemoteSession('A',store,{read:async()=>null},()=>true,op);await s.open();assert.equal(s.ready,false);assert.throws(()=>s.stage(raw('unsafe')));
 const fake=new IDBFactory();await new Promise((resolve,reject)=>{const r=fake.open('fullhouse-lab-future',2);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});await assert.rejects(new DurableWorkStore('A',fake,'fullhouse-lab-future').ready(),{name:'VersionError'});
});
