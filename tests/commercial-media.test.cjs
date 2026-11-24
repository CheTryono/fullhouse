'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const out=require('../scripts/build-remote-staging.cjs').build();
const {QUOTAS,premium,inventory,evaluate,createMediaService}=require(path.join(out,'media.cjs'));
const {createService}=require('../remote/service.cjs'),{createHandler}=require(path.join(out,'policy.cjs'));
const settings=require('../remote-staging/settings.json'),{memoryPorts}=require('./helpers/remote.cjs'),{emptyData}=require('./helpers/app.cjs');
const NOW=2000000000000,auth=uid=>({uid,token:{email_verified:true}}),op=()=>crypto.randomUUID();
// Real, public-domain 1x1 PNG bytes, no personal information.
const IMAGE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGVEAAAAASUVORK5CYII=';
const evidence=(id='image-one',src=IMAGE)=>({id,kind:'image',src,caption:'Sintética',createdAt:'2030-01-01T00:00:00Z'});
const data=(images=[],note='')=>({...emptyData(),logs:{'removed-event@2030-01-01':{completed:false,checkedSteps:['removed-step'],note,evidences:images}}});
const command=(d,base=null,id=op())=>({operationId:id,baseRevision:base,backup:JSON.stringify(d)});
function fixture(options={}){
 const ports=memoryPorts(),grant=(uid='A',patch={})=>ports.docs.set('billingEntitlements/'+uid,{version:1,uid,tier:'premium',source:'staging-owner',status:'active',revision:'explicit-synthetic-grant',validFromMs:NOW-1000,validUntilMs:NOW+100000,...patch});
 const service=createMediaService({...ports,clock:()=>NOW,trialUids:['A','B'],...options});
 return {...ports,service,grant,save:(c,uid='A')=>service.save(auth(uid),c)};
}
test('Free text remains useful; client Premium fields and Auth claims cannot authorize images',async()=>{
 const f=fixture(),c=command(data([], 'Metas, rutinas, calendario y notas'));await f.save(c);
 const d=data([evidence()]);d.premium=true;d.subscription={status:'active'};
 await assert.rejects(f.service.save({...auth('A'),token:{email_verified:true,premium:true}},command(d,c.operationId)),{code:'permission-denied'});
 assert.equal(f.objects.size,1);assert.equal(f.docs.get('users/A/storage/head').revisionId,c.operationId);assert.equal([...f.docs.keys()].filter(k=>k.startsWith('users/A/operations/')).length,1);
});
test('server grants require UID, source, status, time and bounded synthetic trial; malformed rights fail closed',()=>{
 const base={version:1,uid:'A',tier:'premium',source:'payments-backend',status:'active',revision:'verified-payment-event',validFromMs:NOW-1,validUntilMs:NOW+10};assert.equal(premium(base,'A',NOW,[]),true);
 for(const patch of [{uid:'B'},{source:'client'},{status:'past_due'},{validFromMs:NOW+1},{validUntilMs:NOW},{premium:true},{validUntilMs:Infinity}])assert.equal(premium({...base,...patch},'A',NOW,['A']),false);
 assert.equal(premium({...base,source:'staging-owner'},'A',NOW,[]),false);assert.equal(premium({...base,source:'staging-owner',validUntilMs:NOW+86400001},'A',NOW,['A']),false);
});
test('Premium writes atomically register media, revisions, head and receipt; retries charge once',async()=>{
 const f=fixture();f.grant();const c=command(data([evidence(),evidence('image-two')])),r=await f.save(c),ledger=f.docs.get('users/A/mediaUsage/head');assert.equal(Object.keys(ledger.bindings).length,2);
 assert.equal(new Set(Object.values(ledger.bindings).map(b=>b.sha256)).size,1);assert.equal(f.objects.size,2);assert.equal(r.revisionId,c.operationId);
 f.docs.delete('billingEntitlements/A');assert.deepEqual(await f.save(c),r);assert.deepEqual(f.docs.get('users/A/mediaUsage/head'),ledger);assert.equal(f.objects.size,2);
 await assert.rejects(f.save({...c,backup:JSON.stringify(data([], 'different command'))}),{code:'already-exists'});
});
test('downgrade retains image bytes, captions, marks and read/export; text edits do not recreate blobs',async()=>{
 const f=fixture();f.grant();const c=command(data([evidence()]));await f.save(c);f.docs.delete('billingEntitlements/A');
 let photoWrites=0;const file=f.bucket.file;f.bucket.file=name=>{const x=file(name);return {...x,save:async(...args)=>{if(name.includes('/photos/'))photoWrites++;return x.save(...args);}};};const d=data([{...evidence(),caption:'Descripción corregida'}],'Nota corregida');
 // Firestore maps do not promise the insertion order of an in-memory object.
 const stored=f.docs.get('users/A/mediaUsage/head');stored.bindings=Object.fromEntries(Object.entries(stored.bindings).map(([k,b])=>[k,Object.fromEntries(Object.entries(b).sort(([a],[z])=>a.localeCompare(z)))]));f.docs.set('users/A/mediaUsage/head',stored);
 const next=command(d,c.operationId);await f.save(next);assert.equal(photoWrites,0);assert.deepEqual(JSON.parse((await f.service.read(auth('A'),{revisionId:null})).backup),d);
 assert.equal((await f.service.inspect(auth('A'),{operationId:next.operationId})).revisionId,next.operationId);
});
test('Free cannot create a new reference, change owner/step/identity/bytes, or import someone else’s v1 images',async()=>{
 const f=fixture();f.grant();const c=command(data([evidence()]));await f.save(c);f.docs.delete('billingEntitlements/A');
 for(const images of [[evidence('new-id')],[{...evidence(),stepId:'another-step'}],[{...evidence(),src:IMAGE.replace('png','jpeg')}],[evidence(),evidence('second')]])await assert.rejects(f.save(command(data(images),c.operationId)));
 const other=data();other.logs['other-event@2030-01-01']={...data([evidence()]).logs['removed-event@2030-01-01']};await assert.rejects(f.save(command(other,c.operationId)),{code:'permission-denied'});
 await assert.rejects(f.save(command(data([evidence()])),'B'),{code:'permission-denied'});assert.equal(f.docs.has('users/B/storage/head'),false);
});
test('restore is server-sourced, same owner and original binding; downgrade does not destroy old revisions',async()=>{
 const f=fixture();f.grant();const c=command(data([evidence()]));await f.save(c);const remove=command(data([], 'Retirada de la revisión actual'),c.operationId);await f.save(remove);f.docs.delete('billingEntitlements/A');
 const restore={operationId:op(),baseRevision:remove.operationId,restoreRevision:c.operationId};await f.service.restore(auth('A'),restore);
 assert.equal((await f.service.read(auth('A'),{revisionId:null})).backup,c.backup);await assert.rejects(f.service.restore(auth('B'),{...restore,baseRevision:null}),{code:'not-found'});
});
test('manipulated backups cannot add hidden data URL images or duplicate evidence IDs',async()=>{
 const f=fixture();f.grant();for(const d of [data([evidence(),evidence()]),{...data(),hiddenImage:IMAGE},data([],IMAGE),{...data(),hidden:{payload:'data:IMAGE/png;base64,YQ=='}},{...data(),hidden:'data:application/octet-stream;base64,YQ=='}])await assert.rejects(f.save(command(d)),{code:'invalid-argument'});assert.equal(f.objects.size,0);
});
test('new image format/size and plan text limits are checked on the server',async()=>{
 const f=fixture();f.grant();for(const src of ['data:image/png;base64,YQ==','data:image/gif;base64,R0lGODlh','data:image/jpeg;base64,'+Buffer.alloc(450000,65).toString('base64')])await assert.rejects(f.save(command(data([evidence('image',src)]))));
 await assert.rejects(f.save(command(data([], 'x'.repeat(QUOTAS.premiumTextBytes)))),{code:'resource-exhausted'});f.docs.delete('billingEntitlements/A');await assert.rejects(f.save(command(data([], 'x'.repeat(QUOTAS.freeTextBytes)))),{code:'resource-exhausted'});assert.equal(f.objects.size,0);
});
test('reference quota and corrupted inventory never reset, purge or partially confirm',async()=>{
 const f=fixture();f.grant();await assert.rejects(f.save(command(data(Array.from({length:201},(_,i)=>evidence('id-'+i))))),{code:'resource-exhausted'});assert.equal(f.objects.size,0);
 f.docs.set('users/A/mediaUsage/head',{version:1,complete:true,bindings:{corrupt:{}}});await assert.rejects(f.save(command(data())),{code:'data-loss'});assert.equal(f.docs.has('users/A/storage/head'),false);
 const i=inventory(JSON.stringify(data([evidence('one'),evidence('two')]))),keys=Object.keys(i.bindings);i.bindings[keys[1]].bytes++;f.docs.set('users/A/mediaUsage/head',{version:1,complete:true,bindings:i.bindings});await assert.rejects(f.save(command(data())),{code:'data-loss'});assert.equal(f.objects.size,0);
});
test('grandfathered confirmed images need no format conversion; incomplete inventory blocks new ones only',async()=>{
 const f=fixture(),legacy=createService(f),d=data([evidence('old'+'x'.repeat(1200),'data:image/gif;base64,YQ==')]),c=command(d);await legacy.save(auth('A'),c);
 const next=command({...d,note:'Text-only edit'},c.operationId);await f.save(next);assert.equal(f.docs.get('users/A/mediaUsage/head').complete,false);assert.deepEqual(f.docs.get('users/A/mediaUsage/head').bindings,{});
 f.grant();await assert.rejects(f.save(command(data([evidence('new')]),next.operationId)),{code:'failed-precondition'});assert.equal((await f.service.read(auth('A'),{revisionId:c.operationId})).backup,c.backup);
});
test('a missing confirmed photo is a data-loss error, not a Free reupload',async()=>{
 const f=fixture();f.grant();const c=command(data([evidence()]));await f.save(c);f.docs.delete('billingEntitlements/A');const key=[...f.objects.keys()].find(k=>k.includes('/photos/'));f.objects.delete(key);
 await assert.rejects(f.save(command(data([evidence()],'edit'),c.operationId)),{code:'data-loss'});assert.equal(f.objects.has(key),false);assert.equal(f.docs.get('users/A/storage/head').revisionId,c.operationId);
});
test('revocation between upload and TX leaves no confirmed media/revision; orphan bytes are not entitlements',async()=>{
 let f,revoke=true;f=fixture({fault:async stage=>{if(stage==='before-transaction'&&revoke){revoke=false;f.docs.delete('billingEntitlements/A');}}});f.grant();const c=command(data([evidence()]));await assert.rejects(f.save(c),{code:'permission-denied'});assert.equal(f.docs.has('users/A/storage/head'),false);assert.equal(f.docs.has('users/A/mediaUsage/head'),false);assert.equal(f.objects.size,2);
 await assert.rejects(f.save(c),{code:'permission-denied'});f.grant();await f.save(c);assert.equal(f.objects.size,2);assert.equal(Object.keys(f.docs.get('users/A/mediaUsage/head').bindings).length,1);
});
test('transaction failure rolls back media+receipt; lost acknowledgement reuses receipt after downgrade',async()=>{
 let stage='transaction';const f=fixture({fault:async point=>{if(stage===point)throw Error('synthetic failure');}});f.grant();const c=command(data([evidence()]));await assert.rejects(f.save(c));assert.equal(f.docs.size,1);assert.equal(f.docs.has('users/A/mediaUsage/head'),false);
 stage='after-commit';await assert.rejects(f.save(c));assert.equal(f.docs.get('users/A/storage/head').revisionId,c.operationId);const ledger=structuredClone(f.docs.get('users/A/mediaUsage/head'));f.docs.delete('billingEntitlements/A');stage=null;
 const r=await f.service.inspect(auth('A'),{operationId:c.operationId});assert.deepEqual(await f.save(c),r);assert.deepEqual(f.docs.get('users/A/mediaUsage/head'),ledger);
});
test('two sessions cannot exceed quota or replace the other session’s confirmed base',async()=>{
 const f=fixture();f.grant();const results=await Promise.allSettled([f.save(command(data([evidence('one')]))),f.save(command(data([evidence('two')])))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'failed-precondition');assert.equal(Object.keys(f.docs.get('users/A/mediaUsage/head').bindings).length,1);
});
test('actual staging gateway composes media enforcement behind unchanged Auth/App Check and closed flags',async()=>{
 const f=fixture(),env={FULLHOUSE_REMOTE_STAGING_ENABLED:'1',FULLHOUSE_STAGING_TEST_UIDS:'A,B'};f.docs.set('stagingControl/remoteV1',{enabled:true,writesEnabled:true});f.docs.set('stagingAccess/A',{enabled:true});
 const handle=createHandler({db:f.db,service:f.service,settings:{...settings,remoteEnabled:true},env,clock:()=>NOW}),request={auth:auth('A'),app:{appId:settings.appId},data:{method:'save',input:command(data([evidence()]))}};
 await assert.rejects(handle(request),{code:'permission-denied'});assert.equal(f.objects.size,0);f.grant();await handle(request);
 const closed=createHandler({db:f.db,service:f.service,settings,env});await assert.rejects(closed(request),{code:'unavailable'});
 const index=require('node:fs').readFileSync(path.join(out,'index.cjs'),'utf8');assert.match(index,/service:createMediaService\(/);assert.equal(settings.deploymentAuthorized,false);assert.equal(settings.remoteEnabled,false);
});
test('inventory retains source identities while excluding only image bytes from text accounting',()=>{
 const d=data([evidence()]),before=JSON.stringify(d),i=inventory(before);assert.equal(JSON.stringify(d),before);assert.equal(i.sources.size,1);assert.equal(Object.values(i.bindings)[0].logKey,'removed-event@2030-01-01');assert.equal(i.textBytes,Buffer.byteLength(before)-Buffer.byteLength(IMAGE));
});
test('historical unique-image and byte quotas include retired references, not only the current backup',()=>{
 const grant={version:1,uid:'A',tier:'premium',source:'payments-backend',status:'active',revision:'verified',validFromMs:NOW-1,validUntilMs:NOW+1},base=inventory(JSON.stringify(data())),candidate=inventory(JSON.stringify(data([evidence()]))),template=Object.values(candidate.bindings)[0];
 const make=(n,bytes)=>{const bindings={};for(let i=0;i<n;i++){const b={...template,id:'historical-'+i,sha256:require('node:crypto').createHash('sha256').update(String(i)).digest('hex'),bytes};bindings[require('node:crypto').createHash('sha256').update(JSON.stringify([b.logKey,b.id])).digest('hex')]=b;}return {version:1,complete:true,bindings};};
 const args={candidate,base,uid:'A',ms:NOW,grant};assert.throws(()=>evaluate({...args,ledger:make(100,100)}),{code:'resource-exhausted'});
 const bytes=Buffer.alloc(300000,65);bytes.set([255,216,255]);const large=inventory(JSON.stringify(data([evidence('new-large','data:image/jpeg;base64,'+bytes.toString('base64'))])));
 assert.throws(()=>evaluate({...args,candidate:large,ledger:make(87,600000)}),{code:'resource-exhausted'});
 // Prior over-quota facts are retained; a text-only edit does not add media.
 assert.equal(evaluate({...args,candidate:base,ledger:make(100,600000),grant:null}).ledger.complete,true);
});
test('a downgrade permits non-growing text already confirmed above the Free quota',async()=>{
 const f=fixture();f.grant();const d=data([], 'x'.repeat(QUOTAS.freeTextBytes+100)),c=command(d);await f.save(c);f.docs.delete('billingEntitlements/A');
 const next=command(data([],d.logs['removed-event@2030-01-01'].note.slice(1)),c.operationId);await f.save(next);assert.equal((await f.service.read(auth('A'),{revisionId:null})).backup,next.backup);
});
