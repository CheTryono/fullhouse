'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
const {load,RemoteSession,digest,apiFor,localStore}=require('./helpers/remote-client.cjs'),{DurableWorkStore}=load('durable-store.ts');
const {memoryPorts}=require('./helpers/remote.cjs'),{createService}=require('../remote/service.cjs');
const {emptyData}=require('./helpers/app.cjs');
const {app,event}=require('./helpers/app.cjs'),{DraftCheckpoints}=load('drafts.ts');
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
function planner(data=emptyData()){
 const p=app({data}).controller,set=p.setState.bind(p);p.setState=(patch,callback)=>{set(patch);callback?.();};return p;
}
function checkpoints(p,f,build='test-build',day=()=> '2030-01-07'){return new DraftCheckpoints(p,f.session,f.store,build,undefined,day,'UTC');}
test('unsubmitted real Planner forms and exact note keys restore explicitly without changing v1 data',async()=>{
 const f=await setup(),p=planner();const d=checkpoints(p,f);p.openGoal();p.setState({goalDraft:{...p.state.goalDraft,title:'Unsent goal'}});p.noteProps(event(),'2030-01-07','removed-step').onDraft('Unsent historical step note');await d.flush();assert.equal(d.status,'protected');const [row]=await d.list();assert(row);assert.equal(f.session.pending,null);
 const next=planner(),recovery=checkpoints(next,f);await assert.rejects(recovery.restore(row,false));await recovery.restore(row,true);assert.equal(next.state.goalDraft.title,'Unsent goal');assert.equal(next.noteDrafts.get(JSON.stringify(['event','2030-01-07','removed-step'])),'Unsent historical step note');assert.deepEqual(next.state.data,emptyData());await recovery.flush();f.store.close();
});
test('draft quota/abort keeps previous checkpoint, warns and exports newest RAM values',async()=>{
 let fail=false;const f=await setup((kind,tx)=>{if(fail&&kind==='draft')tx.abort();}),p=planner(),d=checkpoints(p,f);p.openRoutine();p.setState({routineDraft:{...p.state.routineDraft,title:'Previous'}});await d.flush();fail=true;p.setState({routineDraft:{...p.state.routineDraft,title:'Latest RAM'}});await d.flush();assert.equal(d.status,'error');assert(d.unprotected);assert.equal(JSON.parse((await d.list())[0].raw).state.routineDraft.title,'Previous');assert.equal(JSON.parse(await d.exportCurrent()).state.routineDraft.title,'Latest RAM');fail=false;await d.flush();assert.equal(d.status,'protected');f.store.close();
});
test('draft restoration refuses different base, owner, corrupted hash and UI build, without applying fields',async()=>{
 const f=await setup(),p=planner(),d=checkpoints(p,f);p.openEvent();p.setState({eventDraft:{...p.state.eventDraft,title:'Original event draft'}});await d.flush();const [row]=await d.list(),next=planner(),recovery=checkpoints(next,f,'new-build');await assert.rejects(recovery.restore(row,true),/incompatible/);assert.equal(next.state.modal,null);
 const current=checkpoints(planner(),f);await assert.rejects(current.restore({...row,owner:'B'},true));await assert.rejects(current.restore({...row,raw:row.raw+' '},true));f.session.stage(raw('server changed'));await f.session.retry();await assert.rejects(current.restore(row,true),/base/);await Promise.all([recovery.flush(),current.flush()]);f.store.close();
});
test('daily review from another day is recovered as text, never assigned to today',async()=>{
 const f=await setup(),p=planner(),d=checkpoints(p,f);p.setState({page:'hoy',reviewDraft:'Yesterday reflection'});await d.flush();const [row]=await d.list(),next=planner(),recovery=checkpoints(next,f,'test-build',()=> '2030-01-08'),result=await recovery.restore(row,true);assert(result.manual.some(text=>text.includes('2030-01-07')&&text.includes('Yesterday reflection')));assert.equal(next.state.reviewDraft,'');await recovery.flush();f.store.close();
});
test('a clearing form cannot erase its prior draft before the candidate is locally durable',async()=>{
 const f=await setup(),p=planner(),d=checkpoints(p,f);p.openGoal();p.setState({goalDraft:{...p.state.goalDraft,title:'Pending'}});await d.flush();let release;const persist=f.store.persist.bind(f.store);f.store.persist=async(...args)=>{await new Promise(r=>{release=r;});await persist(...args);};f.session.stage(raw('candidate'));p.close(true);await d.flush();assert.equal((await d.list()).length,1);assert.notEqual(d.status,'protected');while(!release)await new Promise(r=>setImmediate(r));release();while(f.session.busy)await new Promise(r=>setImmediate(r));await d.flush();assert.equal((await d.list()).length,0);f.store.close();
});
test('durable sessions retain both conflicting branches and archive only by explicit request',async()=>{
 const f=await setup(),secondStore=new DurableWorkStore('A',f.factory,'fullhouse-lab-unit'),second=new RemoteSession('A',secondStore,f.api,()=>true,op);await second.open();f.session.stage(raw('first branch'));second.stage(raw('second branch'));const id=second.pending.operationId;await f.session.retry();await second.retry();assert.equal(second.phase,'conflict');assert.equal(second.durability,'durable');assert.equal(second.exportCandidate(),raw('second branch'));await second.useServer(true);assert.equal(second.exportRecovery(id),raw('second branch'));assert.equal(second.workingRaw,raw('first branch'));f.store.close();secondStore.close();
});
test('lost local cleanup acknowledgement inspects server receipt without duplicating confirmed revision',async()=>{
 let fail=true;const f=await setup((kind,tx)=>{if(fail&&kind==='remove')tx.abort();});f.session.stage(raw('uncertain cleanup'));const id=f.session.pending.operationId;await f.session.retry();assert.equal(f.session.phase,'error');assert(f.session.pending);assert.match(f.session.message,/commit podría existir/);const stored=f.ports.docs.size;fail=false;await f.session.retry();assert.equal(f.session.confirmed.revisionId,id);assert.equal(f.ports.docs.size,stored);f.store.close();
});
test('RAM recovery package exports identity on quota failure and restores it explicitly without sending',async()=>{
 const f=await setup((kind,tx)=>{if(kind==='journal')tx.abort();});f.session.stage(raw('RAM package'));await f.session.retry();assert.equal(f.session.durability,'error');const packet=f.session.exportPending(),id=f.session.pending.operationId;
 const otherStore=new DurableWorkStore('B',f.factory,'fullhouse-lab-unit'),other=new RemoteSession('B',otherStore,f.api,()=>true,op);await other.open();await assert.rejects(other.recoverPacket(packet,true));assert.equal(other.pending,null);
 const nextStore=new DurableWorkStore('A',f.factory,'fullhouse-lab-unit'),next=new RemoteSession('A',nextStore,f.api,()=>true,op);await next.open();await assert.rejects(next.recoverPacket(packet,false));await next.recoverPacket(packet,true);assert.equal(next.pending.operationId,id);assert.equal(next.confirmed,null);assert.equal(f.ports.docs.size,0);await next.retry();assert.equal(next.confirmed.revisionId,id);f.store.close();otherStore.close();nextStore.close();
});
test('escaping-heavy valid v1 backups remain recoverable when their outer journal exceeds 18 MiB',async()=>{
 const f=await setup(),backup=raw('\\'.repeat(2400000));f.session.confirmed={revisionId:op(),backup,backupHash:await digest(backup)};f.session.stage(backup);while(f.session.busy)await new Promise(r=>setImmediate(r));const packet=f.session.exportPending();assert(packet.length>18*1024*1024);f.store.close();const nextStore=new DurableWorkStore('A',f.factory,'fullhouse-lab-unit'),next=new RemoteSession('A',nextStore,f.api,()=>true,op);await next.open();assert.equal(next.pending.backup,backup);assert.equal(next.ready,true);assert.equal(next.phase,'conflict');nextStore.close();
});
