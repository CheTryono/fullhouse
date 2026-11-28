'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const fixture=require('./helpers/gcloud-closed.cjs'),{snapshot}=require('./helpers/recovery.cjs'),id=require('../scripts/remote-staging-build-identity.cjs');
const isolated=fixture.isolatedAuthorizedModule(),g=isolated.module,m=require(path.join(isolated.dir,'scripts/remote-staging-recreate.cjs'));
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-single-delete-')),release=()=>g.prepare({env:{}});
function facts(phase='delete'){
 const old=snapshot();delete old.fn.serviceConfig;delete old.previousBuild.results;delete old.previousBuild.sourceProvenance;
 old.fn.buildConfig.source.storageSource.bucket=m.MANAGED_SOURCE;
 const fn=phase==='delete'?{http:200,data:old.fn}:{http:404,rpcStatus:'NOT_FOUND'};
 return {project:{http:200,data:{projectId:id.PROJECT,name:'projects/'+id.NUMBER,state:'ACTIVE'}},permissions:{http:200,data:{permissions:[...new Set([...m.DELETE_PERMISSIONS,...m.CREATE_PERMISSIONS])]}},fn,recheck:structuredClone(fn),run:{http:404,rpcStatus:'NOT_FOUND'},previousBuild:phase==='delete'?{http:200,data:old.previousBuild}:undefined,operations:{complete:true,items:[{done:true,metadata:{target:id.FUNCTION}}]},...(phase==='create'?{createAudit:fixture.audit()}:{})};
}
function approval(phase,s=facts(phase),p=release()){
 const proof=m.seal(s,p);return {FULLHOUSE_RECREATE_EXCLUSIVE_WINDOW:id.PROJECT,FULLHOUSE_ACK_RECREATE_DATA_REVIEW:id.PROJECT,FULLHOUSE_APPROVED_GCLOUD_RELEASE:p.releaseHash,...(phase==='delete'?{FULLHOUSE_AUTHORIZE_SINGLE_FUNCTION_DELETE:id.PROJECT,FULLHOUSE_APPROVED_DELETE_PLAN:proof.planHash}:{FULLHOUSE_AUTHORIZE_RECREATE_CREATE:id.PROJECT,FULLHOUSE_APPROVED_CREATE_PLAN:proof.planHash,FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY:id.PROJECT})};
}
const cli=(args)=>args[0]==='version'?JSON.stringify({'Google Cloud SDK':'592.0.0'}):'{}';
const successOp=(done=true)=>({name:`projects/${id.PROJECT}/locations/${id.REGION}/operations/delete-synthetic`,metadata:{target:id.FUNCTION,operationType:'DELETE_FUNCTION'},done,...(done?{response:{'@type':'type.googleapis.com/google.protobuf.Empty'}}:{})});
function wire(responses=[successOp()]){const calls=[];return {calls,fetcher:async(url,opts)=>{calls.push({url,method:opts.method});assert.equal(opts.headers.authorization,'Bearer synthetic');assert.equal(opts.headers['x-goog-user-project'],id.PROJECT);return {ok:true,status:200,json:async()=>responses.shift()||successOp(false)};}};}
test('delete has its own minimal contract and accepts absent serviceConfig, build images and provenance without inventing them',()=>{
 const s=facts(),report=m.report(s,release());assert.deepEqual(m.assess(s),{phase:'delete',issues:[]});assert.equal(report.readyForReview,true);assert.match(report.deletePlanHash,/^[a-f0-9]{64}$/);assert.equal(report.createPlanHash,null);assert.equal(report.authorized,false);
 assert.equal(report.limitations.buildImages,'NOT_RETURNED_NOT_REQUIRED_FOR_DELETE');assert.equal(report.limitations.buildProvenance,'NOT_RETURNED_NOT_REQUIRED_FOR_DELETE');assert.equal(report.limitations.userData,'NOT_READ_NOT_ASSUMED_EMPTY');
 assert.throws(()=>require(path.join(isolated.dir,'scripts/remote-staging-recovery.cjs')).assertSnapshot({...snapshot(),fn:s.fn.data,previousBuild:s.previousBuild.data}));
});
test('wrong name, generation, state, dates, build, permissions, active Run or incomplete operations block deletion',()=>{
 for(const mutate of [s=>s.project.data.projectId='other',s=>s.project.http=403,s=>s.fn.data.name=id.FUNCTION+'Wrong',s=>s.fn.data.environment='GEN_1',s=>s.fn.data.state='ACTIVE',s=>s.fn.data.state='DELETING',s=>delete s.fn.data.createTime,s=>s.fn.data.buildConfig.build='other',s=>s.fn.data.eventTrigger={},s=>s.previousBuild.data.status='WORKING',s=>s.previousBuild.data.name='other',s=>s.run={http:200},s=>s.run={http:403},s=>s.run.reason='SERVICE_DISABLED',s=>s.operations.complete=false,s=>s.operations.items=[null],s=>s.operations.items.push({done:false,metadata:{target:id.FUNCTION}}),s=>s.recheck.data.updateTime='2026-11-28T00:00:00Z']){const s=facts();mutate(s);assert(m.assess(s).issues.length>0);assert.equal(m.report(s,release()).deletePlanHash,null);}
 for(const permission of m.DELETE_PERMISSIONS){const s=facts();s.permissions.data.permissions=s.permissions.data.permissions.filter(p=>p!==permission);assert(m.assess(s).issues.includes('permission.'+permission));}
});
test('source bucket mismatch is reported without arbitrary acceptance or reuse as a future source',()=>{
 const s=facts(),unknown='different-owned-name-not-attested';s.fn.data.buildConfig.source.storageSource.bucket=unknown;s.recheck=structuredClone(s.fn);
 const report=m.report(s,release());assert.equal(report.readyForReview,true);assert.equal(report.observed.source.bucket,unknown);assert.equal(report.observed.source.classification,'UNVERIFIED_PRESERVED');assert.equal(report.observed.source.usedAsNewSource,false);assert.equal(report.observed.source.usedAsDeletionTarget,false);assert.equal(report.observed.source.futureCreationSource,id.SOURCE_BUCKET);
});
test('managed bucket name alone is not provenance; official Function provenance plus exact bucket ownership is required for corroboration',()=>{
 const f=facts().fn.data,metadata={http:200,data:{name:m.MANAGED_SOURCE,projectNumber:id.NUMBER,location:'US-CENTRAL1'}};
 assert.equal(m.sourceEvidence(f,undefined).classification,'RECOGNIZED_NAME_OWNERSHIP_UNVERIFIED');assert.equal(m.sourceEvidence(f,metadata).classification,'OWNED_BUCKET_PRIOR_PROVENANCE_UNVERIFIED');
 f.buildConfig.sourceProvenance={resolvedStorageSource:{...f.buildConfig.source.storageSource,generation:'123'}};assert.equal(m.sourceEvidence(f,metadata).classification,'FUNCTION_PROVENANCE_AND_BUCKET_VERIFIED');
 metadata.data.projectNumber='other';assert.equal(m.sourceEvidence(f,metadata).classification,'RECOGNIZED_NAME_OWNERSHIP_UNVERIFIED');assert.equal(m.sourceEvidence(f,metadata).bytesVerified,false);
});
test('separate delete/create consent, data review, exclusive window, Node22 and both full hashes gate every real access',async()=>{
 const env=approval('delete');let calls=0;const never=()=>{calls++;throw Error('No access');};
 for(const patch of [{FULLHOUSE_AUTHORIZE_SINGLE_FUNCTION_DELETE:undefined},{FULLHOUSE_RECREATE_EXCLUSIVE_WINDOW:undefined},{FULLHOUSE_ACK_RECREATE_DATA_REVIEW:undefined},{FULLHOUSE_APPROVED_DELETE_PLAN:'short'},{FULLHOUSE_APPROVED_GCLOUD_RELEASE:'short'},{FULLHOUSE_AUTHORIZE_SINGLE_FUNCTION_DELETE:'other'}])await assert.rejects(m.deleteFailed({env:{...env,...patch},nodeVersion:'22.23.5',execute:never,getToken:never,read:never,fetcher:never}));
 await assert.rejects(m.deleteFailed({env,nodeVersion:'24.22.1',execute:never,getToken:never,read:never,fetcher:never}));await assert.rejects(m.createClosed({env,nodeVersion:'22.23.5',execute:never,getToken:never,read:never,deploy:never}));assert.equal(calls,0);
});
test('wrong release, wrong approval phase or changed resource prevent the DELETE request',async()=>{
 const s=facts(),env=approval('delete',s);let calls=0;const never=()=>{calls++;throw Error('No mutation');};
 for(const patch of [{FULLHOUSE_APPROVED_DELETE_PLAN:'a'.repeat(64)},{FULLHOUSE_APPROVED_GCLOUD_RELEASE:'a'.repeat(64)}])await assert.rejects(m.deleteFailed({env:{...env,...patch},nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,fetcher:never,receiptsDir:temp()}));
 let reads=0;const changed=structuredClone(s);changed.fn.data.updateTime='2026-11-28T00:00:00Z';changed.recheck=structuredClone(changed.fn);await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>++reads===1?s:changed,fetcher:never,receiptsDir:temp()}),/Estado cambiado/);assert.equal(calls,0);
});
test('successful delete sends exactly one DELETE to one function and confirms completed operation plus function/Run absence',async()=>{
 const s=facts(),env=approval('delete',s),w=wire(),folder=temp(),announced=[];let reads=0;
 const result=await m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async options=>{reads++;if(reads===3)assert.equal(options.includeCreateAudit,false);return reads<3?s:facts('create');},fetcher:w.fetcher,receiptsDir:folder,onOperation:value=>announced.push(value),pause:async()=>{}});
 assert.equal(result.mode,'SINGLE_FUNCTION_DELETION_VERIFIED');assert.equal(result.noCreationPerformed,true);assert.equal(w.calls.length,1);assert.deepEqual(w.calls[0],{url:m.FUNCTION_URL,method:'DELETE'});assert.equal(reads,3);assert.equal(announced.length,1);
 const receipt=JSON.parse(fs.readFileSync(result.receipt));assert.equal(receipt.phase,'absence-verified');assert.equal(receipt.deletePlanHash,env.FULLHOUSE_APPROVED_DELETE_PLAN);assert(!JSON.stringify(receipt).includes('Bearer synthetic'));assert.equal(Object.hasOwn(receipt,'token'),false);assert.equal(fs.statSync(result.receipt).mode&0o777,0o600);
});
test('operation polling performs only GET after the single DELETE, without redeploy or chained creation',async()=>{
 const s=facts(),env=approval('delete',s),w=wire([successOp(false),successOp()]);let reads=0;
 await m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>++reads<3?s:facts('create'),fetcher:w.fetcher,receiptsDir:temp(),pause:async()=>{}});assert.equal(w.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(w.calls[1].method,'GET');assert(w.calls[1].url.includes('/operations/delete-synthetic'));
});
test('missing acknowledgement is uncertain, keeps an intent receipt and refuses replay of the same approved attempt',async()=>{
 const s=facts(),env=approval('delete',s),folder=temp();let mutations=0;const options={env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,receiptsDir:folder,fetcher:async()=>{mutations++;throw Error('network lost');}};
 await assert.rejects(m.deleteFailed(options),/Borrado incierto/);const [name]=fs.readdirSync(folder);assert.equal(JSON.parse(fs.readFileSync(path.join(folder,name))).phase,'uncertain');assert.equal(mutations,1);
 await assert.rejects(m.deleteFailed(options),/EEXIST/);assert.equal(mutations,1);
});
test('local receipt capacity failure prevents sending the DELETE',async t=>{
 const s=facts(),env=approval('delete',s);let calls=0;t.mock.method(fs,'fsyncSync',()=>{throw Object.assign(Error('synthetic quota'),{code:'ENOSPC'});});
 await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,fetcher:async()=>{calls++;throw Error('No request expected');},receiptsDir:temp()}),/synthetic quota/);assert.equal(calls,0);
});
test('HTTP errors on DELETE remain uncertain without leaking response bodies or retrying',async()=>{
 const s=facts(),env=approval('delete',s);
 for(const status of [403,429,503]){let calls=0;await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,fetcher:async()=>{calls++;return {ok:false,status,json:async()=>({error:{status:'PERMISSION_DENIED',message:'private credential material'}})};},receiptsDir:temp()}),e=>{assert.match(e.message,/Borrado incierto/);assert(!e.message.includes('private credential'));return true;});assert.equal(calls,1);}
});
test('operation errors, wrong operation target/type/name, missing Empty response and exhausted polling remain uncertain',async()=>{
 const s=facts(),env=approval('delete',s);
 const invalid=[{...successOp(),error:{code:13,message:'private failure'}},{...successOp(),name:'projects/other/locations/us-central1/operations/wrong'},{...successOp(),metadata:{target:id.FUNCTION+'Other'}},{...successOp(),metadata:{target:id.FUNCTION,operationType:'CREATE_FUNCTION'}},{...successOp(),response:{}},successOp(false)];
 for(const op of invalid){const w=wire([op]);await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,fetcher:w.fetcher,receiptsDir:temp(),pause:async()=>{},pollLimit:1}),/Borrado incierto/);assert.equal(w.calls.filter(c=>c.method==='DELETE').length,1);}
});
test('residual Run, unqualified 404 or pending operation after deletion never authorizes creation',async()=>{
 const s=facts(),env=approval('delete',s);
 for(const mutate of [a=>a.run={http:200},a=>a.fn={http:404,rpcStatus:'PERMISSION_DENIED'},a=>a.operations.items.push({done:false,metadata:{target:id.FUNCTION}})]){const after=facts('create');mutate(after);let reads=0;const w=wire();await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>++reads<3?s:after,fetcher:w.fetcher,receiptsDir:temp(),pause:async()=>{}}),/Borrado incierto/);assert.equal(w.calls.length,1);}
});
test('read failure after a completed delete is uncertain and preserves the operation identifier',async()=>{
 const s=facts(),env=approval('delete',s);let reads=0;const w=wire();await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>{if(++reads===3)throw Error('postread unavailable');return s;},fetcher:w.fetcher,receiptsDir:temp()}),e=>{assert.match(e.message,/Borrado incierto/);assert.equal(e.operation,successOp().name);return true;});assert.equal(w.calls.length,1);
});
test('creation requires actual qualified absence, idle operations and unchanged original first-create preflight',()=>{
 const s=facts('create'),p=release();assert.deepEqual(m.assess(s),{phase:'create',issues:[]});const report=m.report(s,p);assert.match(report.createPlanHash,/^[a-f0-9]{64}$/);assert.equal(report.deletePlanHash,null);g.assertAudit(s.createAudit);
 for(const mutate of [v=>v.fn={http:403},v=>v.fn={http:404},v=>v.run={http:200},v=>v.createAudit.function={name:id.FUNCTION},v=>v.createAudit.gcloudResources.basicInputsVerified=false]){const bad=structuredClone(s);mutate(bad);assert(m.assess(bad).issues.length>0);assert.equal(m.report(bad,p).createPlanHash,null);}
});
test('creation delegates to the original executor without fabricating or injecting an audit',async()=>{
 const s=facts('create'),env=approval('create',s);let calls=0,reads=0;
 const result=await m.createClosed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>{reads++;return s;},deploy:async options=>{calls++;assert.equal(Object.hasOwn(options,'readAudit'),false);assert.equal(options.env.FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY,id.PROJECT);return {mode:'CLOSED_RELEASE_METADATA_VERIFIED',releaseHash:env.FULLHOUSE_APPROVED_GCLOUD_RELEASE};}});assert.equal(calls,1);assert.equal(reads,2);assert.equal(result.noDeletionPerformed,true);
});
test('creation rejects delete approval, missing original consent, state reappearance and uncertain delegate result',async()=>{
 const s=facts('create'),env=approval('create',s);let deploys=0;const deploy=async()=>{deploys++;return {};};
 await assert.rejects(m.createClosed({env:{...env,FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY:undefined},nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,deploy}));
 await assert.rejects(m.createClosed({env:approval('delete'),nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,deploy}));
 let reads=0;await assert.rejects(m.createClosed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>++reads===1?s:facts(),deploy}));assert.equal(deploys,0);
 await assert.rejects(m.createClosed({env,nodeVersion:'22.23.5',execute:cli,getToken:()=> 'synthetic',read:async()=>s,deploy}),/Creación no confirmada/);assert.equal(deploys,1);
});
test('unknown SDK/config and unsafe credentials stop before metadata or deletion',async()=>{
 const env=approval('delete');let reads=0;const never=()=>{reads++;throw Error('No access');};
 await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:()=>JSON.stringify({'Google Cloud SDK':'other'}),getToken:never,read:never,fetcher:never}),/SDK no revisado/);
 await assert.rejects(m.deleteFailed({env,nodeVersion:'22.23.5',execute:args=>args[0]==='version'?cli(args):JSON.stringify({auth:{impersonate_service_account:'other'}}),getToken:never,read:never,fetcher:never}),/Configuración CLI/);
 await assert.rejects(m.deleteFailed({env:{...env,GOOGLE_APPLICATION_CREDENTIALS:'/not-read'},nodeVersion:'22.23.5',execute:never,getToken:never,read:never,fetcher:never}));assert.equal(reads,0);
});
test('plan hashes are deterministic, phase-specific and change with metadata or controller code',()=>{
 const s=facts(),p=release(),proof=m.seal(s,p);assert.equal(m.seal(structuredClone(s),p).planHash,proof.planHash);assert.notEqual(m.seal(facts('create'),p).planHash,proof.planHash);
 const changed=structuredClone(s);changed.fn.data.updateTime='2026-11-28T00:00:00Z';changed.recheck=structuredClone(changed.fn);assert.notEqual(m.seal(changed,p).planHash,proof.planHash);
 fs.appendFileSync(path.join(isolated.dir,'scripts/remote-staging-recreate.cjs'),'\n// synthetic control change\n');assert.notEqual(m.seal(s,p).planHash,proof.planHash);
});
function live(s,{sourceUnknown=false,pages=false,runDenied=false}={}){const calls=[];return {calls,fetcher:async(url,options)=>{calls.push({url,method:options.method});assert.equal(options.headers.authorization,'Bearer synthetic');
 if(url.includes('/v3/projects/'))return {ok:true,status:200,json:async()=>s.project.data};
 if(url.includes(':testIamPermissions'))return {ok:true,status:200,json:async()=>s.permissions.data};
 if(url.includes('/operations?'))return {ok:true,status:200,json:async()=>({operations:s.operations.items,...(pages?{nextPageToken:'repeat'}:{})})};
 if(url.includes('/functions/'))return s.fn.http===200?{ok:true,status:200,json:async()=>s.fn.data}:{ok:false,status:s.fn.http,json:async()=>({error:{status:s.fn.rpcStatus}})};
 if(url.includes('/builds/'))return {ok:true,status:200,json:async()=>s.previousBuild.data};
 if(url.includes('storage.googleapis.com'))return {ok:true,status:200,json:async()=>({name:m.MANAGED_SOURCE,projectNumber:id.NUMBER,location:'US-CENTRAL1'})};
 return {ok:false,status:runDenied?403:404,json:async()=>({error:{status:runDenied?'PERMISSION_DENIED':'NOT_FOUND'}})};
 }};}
test('one live inspection uses only metadata GETs/testIamPermissions; no user data or arbitrary source bucket access',async()=>{
 const s=facts(),f=live(s),data=await m.readLive({token:'synthetic',fetcher:f.fetcher});assert.deepEqual(m.assess(data).issues,[]);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert(!f.calls.some(c=>c.url.includes('firestore.googleapis.com')||c.url.includes('/o/')));
 const unknown=facts();unknown.fn.data.buildConfig.source.storageSource.bucket='unknown-source-bucket';const next=live(unknown);await m.readLive({token:'synthetic',fetcher:next.fetcher});assert(!next.calls.some(c=>c.url.includes('storage.googleapis.com')));
});
test('live creation inspection obtains real first-create audit instead of manufacturing function absence',async()=>{
 const s=facts('create'),f=live(s);let audits=0;const data=await m.readLive({token:'synthetic',fetcher:f.fetcher,readCreateAudit:async()=>{audits++;return fixture.audit();}});assert.equal(audits,1);assert.deepEqual(m.assess(data).issues,[]);assert(!f.calls.some(c=>c.url.includes('/builds/')));
});
test('read-only inspector emits the minimal packet once and reports missing future create permissions separately',async()=>{
 const s=facts();s.permissions.data.permissions=s.permissions.data.permissions.filter(p=>p!=='cloudfunctions.functions.create');let reads=0,tokens=0;
 const order=[];const report=await m.inspect({env:{},execute:args=>{order.push(args[0]);return cli(args);},getToken:()=>{tokens++;order.push('token');return 'synthetic';},read:async({token})=>{assert.equal(token,'synthetic');reads++;return s;}});assert.equal(reads,1);assert.equal(tokens,1);assert.deepEqual(order,['version','config','token']);assert.equal(report.readyForReview,true);assert(report.creationChecks.permissionsMissing.includes('cloudfunctions.functions.create'));assert.equal(report.creationChecks.fullFirstCreateAudit,'DEFERRED_UNTIL_ACTUAL_ABSENCE');
 await assert.rejects(m.inspect({env:{},execute:args=>args[0]==='version'?cli(args):JSON.stringify({auth:{credential_file_override:'/not-read'}}),getToken:()=>{tokens++;throw Error('No token expected');}}),/Configuración CLI/);assert.equal(tokens,1);
});
test('CLI inspection produces a concise deletion review packet for the reported FAILED shape without mutating anything',()=>{
 const s=facts(),file=path.join(isolated.dir,'recreate-facts.json'),preload=path.join(isolated.dir,'recreate-ports.cjs'),script=path.join(isolated.dir,'scripts/remote-staging-recreate.cjs');s.fn.data.description='PRIVATE-DO-NOT-PRINT';fs.writeFileSync(file,JSON.stringify(s));
 fs.writeFileSync(preload,`const Module=require('node:module'),fs=require('node:fs'),s=JSON.parse(fs.readFileSync(${JSON.stringify(file)})),load=Module._load;
 Module._load=function(name,...args){const value=load.call(this,name,...args);return name==='./audit-remote-staging-iam.cjs'?{...value,localToken:()=> 'synthetic'}:value;};
 require('node:child_process').execFileSync=(program,args)=>{if(program==='gcloud'&&args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(program==='gcloud'&&args[0]==='config')return '{}';throw Error('External CLI forbidden');};
 global.fetch=async(url,opts)=>{if(opts.method==='DELETE')throw Error('No mutations allowed');if(url.includes('/v3/projects/'))return {ok:true,status:200,json:async()=>s.project.data};if(url.includes(':testIamPermissions'))return {ok:true,status:200,json:async()=>s.permissions.data};if(url.includes('/operations?'))return {ok:true,status:200,json:async()=>({operations:s.operations.items})};if(url.includes('/functions/'))return {ok:true,status:200,json:async()=>s.fn.data};if(url.includes('/builds/'))return {ok:true,status:200,json:async()=>s.previousBuild.data};if(url.includes('storage.googleapis.com'))return {ok:true,status:200,json:async()=>({name:${JSON.stringify(m.MANAGED_SOURCE)},projectNumber:${JSON.stringify(id.NUMBER)},location:'US-CENTRAL1'})};return {ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND'}})};};`);
 const output=spawnSync(process.execPath,['--require',preload,script,'--inspect'],{env:{},encoding:'utf8',timeout:10000});assert.equal(output.status,0,output.stderr);const report=JSON.parse(output.stdout);assert.equal(report.phase,'delete');assert.equal(report.readyForReview,true);assert.equal(report.authorized,false);assert.equal(report.limitations.buildImages,'NOT_RETURNED_NOT_REQUIRED_FOR_DELETE');assert(!output.stdout.includes('PRIVATE-DO-NOT-PRINT'));assert.equal(fs.existsSync(m.RECEIPTS),false);
});
test('unqualified absence, denied Run inspection and incomplete operation pagination cannot produce approval hashes',async()=>{
 for(const options of [{runDenied:true},{pages:true}]){const s=facts(),f=live(s,options),data=await m.readLive({token:'synthetic',fetcher:f.fetcher});assert.equal(m.report(data,release()).deletePlanHash,null);}
 const bad=facts('create');bad.fn={http:404};bad.recheck=bad.fn;assert.equal(m.report(bad,release()).createPlanHash,null);
});
test('default CLI is a local plan and does not chain delete/create or accept arbitrary destinations',()=>{
 const file=path.join(isolated.dir,'scripts/remote-staging-recreate.cjs');const plan=spawnSync(process.execPath,[file],{env:{},encoding:'utf8'});assert.equal(plan.status,0);assert.equal(JSON.parse(plan.stdout).automaticChain,false);
 for(const args of [['--delete','--create'],['--delete','--project=other'],['--create','--force']]){const result=spawnSync(process.execPath,[file,...args],{env:{},encoding:'utf8'});assert.equal(result.status,2);assert.match(result.stderr,/flags libres/);}
});
