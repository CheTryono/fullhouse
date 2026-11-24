'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build,sources}=require('../scripts/build-remote-staging.cjs'),out=build(),settings=require('../remote-staging/settings.json');
const {settingsCheck,runtimeCheck,createHandler}=require(path.join(out,'policy.cjs')),{createService}=require('../remote/service.cjs'),{memoryPorts}=require('./helpers/remote.cjs');
const {load}=require('./helpers/remote-client.cjs'),{stagingWorkspace}=load('staging.ts'),{IDBFactory}=require('fake-indexeddb'),{emptyData}=require('./helpers/app.cjs');
const web=require('../staging/remote-config.example.json'),project='fullhouse-staging',env={GCLOUD_PROJECT:project,FULLHOUSE_REMOTE_STAGING_ENABLED:'1',FULLHOUSE_STAGING_TEST_UIDS:'A,B'};
const tokenFor=uid=>({token:'synthetic-'+uid,claims:{aud:project,iss:'https://securetoken.google.com/'+project,sub:uid}});
const config=()=>({...web,enabled:true,appCheckSiteKey:'synthetic-public-site-key'}),op=()=>crypto.randomUUID(),raw=note=>JSON.stringify({...emptyData(),note});
const auth=uid=>({uid,token:{email_verified:true}}),command=(backup=raw('test'),operationId=op(),baseRevision=null)=>({operationId,baseRevision,backup});
function setup(patch={}){const ports=memoryPorts(),s={...settings,remoteEnabled:true,...patch};ports.docs.set('stagingControl/remoteV1',{enabled:true,writesEnabled:true});for(const uid of ['A','B'])ports.docs.set('stagingAccess/'+uid,{enabled:true});const service=createService(ports),handle=createHandler({db:ports.db,service,settings:s,env,clock:()=>200000});return{...ports,s,service,handle,request:(method,input,uid='A')=>handle({auth:auth(uid),app:{appId:settings.appId},data:{method,input}})};}
test('3C.1 deploy/config remain blocked for every target, even with project/consent variables',()=>{
 assert.equal(settings.deploymentAuthorized,false);assert.equal(settings.remoteEnabled,false);assert.equal(web.enabled,false);assert.throws(()=>require('../scripts/check-remote-staging-deploy.cjs').check({...env,FULLHOUSE_AUTHORIZE_STAGING_DEPLOY:project},'22.23.5'),/bloqueado/);
 const cfg=require('../firebase.remote-staging.json');assert.equal(cfg.hosting,undefined);for(const target of [cfg.functions[0],cfg.firestore[0],cfg.storage[0]])assert.deepEqual(target.predeploy,['node scripts/check-remote-staging-deploy.cjs']);assert.equal(cfg.functions[0].runtime,'nodejs22');
});
test('settings/runtime reject cross-project, emulator, wrong Node and relaxed limits',()=>{
 settingsCheck(settings);runtimeCheck(env,settings,'22.23.5');for(const e of [{...env,GCLOUD_PROJECT:'demo-fullhouse-remote'},{...env,GOOGLE_CLOUD_PROJECT:'other'},{...env,FUNCTIONS_EMULATOR:'true'},{...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8088'}])assert.throws(()=>runtimeCheck(e,settings,'22.23.5'));
 assert.throws(()=>runtimeCheck(env,settings,'24.22.1'));for(const s of [{...settings,projectId:'other'},{...settings,bucket:'other'},{...settings,origins:['http://localhost']},{...settings,limits:{...settings.limits,rpcPerMinute:61}}])assert.throws(()=>settingsCheck(s));
});
test('artifact uses pinned Node22 backend dependencies and exact shared v1 service, no local secrets/Hosting',()=>{
 const manifest=require(path.join(out,'build.json'));assert.deepEqual(Object.keys(manifest.files).sort(),Object.keys(sources).sort());for(const [target,source]of Object.entries(sources))assert.deepEqual(fs.readFileSync(path.join(out,target)),fs.readFileSync(path.resolve(__dirname,'..',source)));assert.equal(require(path.join(out,'package.json')).engines.node,'22');assert.equal(fs.existsSync(path.join(out,'firebase-config.local.json')),false);assert.equal(fs.existsSync(path.join(out,'app.js')),false);
});
test('disabled backend never touches database or invokes the existing service',async()=>{
 const handle=createHandler({db:{get doc(){throw Error('must not access DB');}},service:{},settings,env});await assert.rejects(handle({}),{code:'unavailable'});
});
test('verified Auth, exact App Check app and explicit allowlist are all required',async()=>{
 const f=setup();for(const request of [{},{auth:auth('A')},{auth:auth('A'),app:{appId:'wrong'}},{auth:{uid:'A',token:{email_verified:false}},app:{appId:settings.appId}}])await assert.rejects(f.handle({...request,data:{method:'read',input:{revisionId:null}}}));
 await assert.rejects(f.request('read',{revisionId:null},'unknown'),{code:'permission-denied'});f.docs.set('stagingControl/remoteV1',{enabled:false});await assert.rejects(f.request('read',{revisionId:null}),{code:'permission-denied'});assert.equal(f.objects.size,0);
});
test('v1 save/inspect/restore retain identities and photo bytes, B cannot restore A',async()=>{
 const f=setup(),data={...emptyData(),logs:{'old@2030-01-01':{completed:true,checkedSteps:['old-step'],note:'original',evidences:[{id:'photo',kind:'image',caption:'synthetic',src:'data:image/jpeg;base64,YQ==',createdAt:'2030-01-01'}]}}},c=command(JSON.stringify(data)),saved=await f.request('save',c);assert.equal(saved.revisionId,c.operationId);assert.deepEqual(await f.request('inspect',{operationId:c.operationId}),saved);assert.equal((await f.request('read',{revisionId:null})).backup,c.backup);assert.equal(await f.request('read',{revisionId:null},'B'),null);
 await assert.rejects(f.request('restore',{operationId:op(),baseRevision:null,restoreRevision:c.operationId},'B'),{code:'not-found'});await f.request('restore',{operationId:op(),baseRevision:saved.revisionId,restoreRevision:saved.revisionId});assert.equal((await f.request('read',{revisionId:null})).backup,c.backup);
});
test('stable retries reserve once and cannot reuse an ID with another command',async()=>{
 const f=setup(),c=command(),first=await f.request('save',c),usage={...f.docs.get('stagingAccess/A').usage};assert.deepEqual(await f.request('save',c),first);assert.equal(f.docs.get('stagingAccess/A').usage.reservedBytes,usage.reservedBytes);assert.equal(f.docs.get('stagingAccess/A').usage.totalOperations,1);await assert.rejects(f.request('save',{...c,backup:raw('different')}),{code:'already-exists'});assert.equal((await f.request('read',{revisionId:null})).revisionId,first.revisionId);
});
test('concurrent bases remain CAS conflicts and no candidate is merged automatically',async()=>{
 const f=setup(),results=await Promise.allSettled([f.request('save',command(raw('one'))),f.request('save',command(raw('two')))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'failed-precondition');assert.equal([...f.docs.keys()].filter(k=>k.startsWith('users/A/revisions/')).length,1);
});
test('rate, operation and capacity limits block before uploading; no automatic purge',async()=>{
 const f=setup({limits:{...settings.limits,rpcPerMinute:1}});await f.request('read',{revisionId:null});await assert.rejects(f.request('read',{revisionId:null}),{code:'resource-exhausted'});
 const download=setup({limits:{...settings.limits,downloadBytesPerDay:1}});await assert.rejects(download.request('read',{revisionId:null}),{code:'resource-exhausted'});
 const small=setup({limits:{...settings.limits,reservedBytes:1}});await assert.rejects(small.request('save',command()),{code:'resource-exhausted'});assert.equal(small.objects.size,0);
 const ops=setup({limits:{...settings.limits,operationsTotal:1}}),c=command();await ops.request('save',c);const bytes=ops.objects.size;await assert.rejects(ops.request('save',command(raw('next'),op(),c.operationId)),{code:'resource-exhausted'});assert.equal(ops.objects.size,bytes);await ops.request('save',c);
});
test('malformed backup, excess size, injected UID and corrupted quota fail safely',async()=>{
 const f=setup();for(const c of [command('{'),command(raw('x'.repeat(8*1024*1024))),{...command(),uid:'B'}])await assert.rejects(f.request('save',c));assert.equal(f.objects.size,0);assert.equal([...f.docs.keys()].some(k=>k.startsWith('users/')),false);f.docs.set('stagingAccess/A',{enabled:true,usage:{reservedBytes:-1}});await assert.rejects(f.request('read',{revisionId:null}),{code:'data-loss'});
});
test('staging client cannot start with off/default config, demo project, wrong bucket or origin',()=>{
 const make=(c,origin='https://fullhouse-staging.web.app')=>stagingWorkspace(c,origin,'A',()=>null,async()=>'',new IDBFactory(),()=>{throw Error('must not call network');});for(const c of [web,{...config(),projectId:'demo-fullhouse-remote'},{...config(),storageBucket:'other'},{...config(),emulatorUrl:'http://127.0.0.1'}])assert.throws(()=>make(c));for(const origin of ['http://localhost','https://chetryono.github.io','https://other.web.app'])assert.throws(()=>make(config(),origin));
});
test('prepared staging workspace keeps UID/project/base, durable retries and rejects demo recovery',async()=>{
 const f=setup(),factory=new IDBFactory();let current={uid:'A',emailVerified:true,getIdTokenResult:async()=> tokenFor('A')},lose=true;
 const request=async(url,options)=>{assert.equal(url,'https://us-central1-fullhouse-staging.cloudfunctions.net/remoteV1');assert.equal(options.headers['X-Firebase-AppCheck'],'synthetic-appcheck');const input=JSON.parse(options.body).data;try{const result=await f.request(input.method,input.input,current.uid);if(input.method==='save'&&lose){lose=false;throw Error('lost ack');}return new Response(JSON.stringify({result}));}catch(e){if(e.message==='lost ack')throw e;return new Response(JSON.stringify({error:{status:e.code?.toUpperCase().replaceAll('-','_')}}));}};
 const make=uid=>stagingWorkspace(config(),'https://fullhouse-staging.web.app',uid,()=>current,async()=> 'synthetic-appcheck',factory,request),a=make('A');await a.session.open();a.session.stage(raw('pending'));const id=a.session.pending.operationId;await a.session.retry();assert.equal(a.session.phase,'error');assert.equal(a.session.durability,'durable');const packet=a.session.exportPending();assert.equal(JSON.parse(packet).project,project);a.store.close();
 const next=make('A');await next.session.open();assert.equal(next.session.pending.operationId,id);await next.session.retry();assert.equal(next.session.phase,'confirmed');assert.equal(next.session.confirmed.revisionId,id);
 current={uid:'B',emailVerified:true,getIdTokenResult:async()=> tokenFor('B')};const b=make('B');await b.session.open();assert.equal(b.session.confirmed,null);await assert.rejects(b.session.recoverPacket(packet,true));assert.equal(b.store.length,0);current={uid:'A',emailVerified:true,getIdTokenResult:async()=> tokenFor('A')};const changed=JSON.parse(packet);changed.project='demo-fullhouse-remote';await assert.rejects(next.session.recoverPacket(JSON.stringify(changed),true));next.store.close();b.store.close();
});
test('session changes while obtaining App Check prevent dispatch entirely',async()=>{
 let current={uid:'A',emailVerified:true,getIdTokenResult:async()=> tokenFor('A')},release,calls=0;const workspace=stagingWorkspace(config(),'https://fullhouse-staging.web.app','A',()=>current,()=>new Promise(r=>{release=r;}),new IDBFactory(),()=>{calls++;throw Error('must not dispatch');});const opening=workspace.session.open();while(!release)await new Promise(r=>setImmediate(r));current={uid:'B',emailVerified:true,getIdTokenResult:async()=> tokenFor('B')};release('synthetic-appcheck');await opening;assert.equal(calls,0);assert.equal(workspace.session.ready,false);workspace.store.close();
});

test('read-only recovery switch stops saves without disabling receipt inspection and reads',async()=>{
 const f=setup(),c=command();await f.request('save',c);f.docs.set('stagingControl/remoteV1',{enabled:true,writesEnabled:false});const size=f.objects.size;await assert.rejects(f.request('save',command(raw('later'),op(),c.operationId)),{code:'unavailable'});assert.equal((await f.request('inspect',{operationId:c.operationId})).revisionId,c.operationId);assert.equal((await f.request('read',{revisionId:null})).backup,c.backup);assert.equal(f.objects.size,size);
});

test('an Auth token from a demo/other project cannot be dispatched to real staging',async()=>{
 let calls=0;const user={uid:'A',emailVerified:true,getIdTokenResult:async()=>({...tokenFor('A'),claims:{...tokenFor('A').claims,aud:'demo-fullhouse-remote'}})},w=stagingWorkspace(config(),'https://fullhouse-staging.web.app','A',()=>user,async()=> 'app-token',new IDBFactory(),()=>{calls++;throw Error('must not dispatch');});await w.session.open();assert.equal(calls,0);assert.equal(w.session.ready,false);w.store.close();
});
