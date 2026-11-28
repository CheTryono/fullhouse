'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const id=require('../scripts/remote-staging-build-identity.cjs'),fixture=require('./helpers/gcloud-closed.cjs'),{snapshot}=require('./helpers/recovery.cjs');
// Keep artifacts private to this file: the general suite runs files in parallel.
const isolated=fixture.isolatedAuthorizedModule(),g=isolated.module,r=require(path.join(isolated.dir,'scripts/remote-staging-recovery.cjs'));
function approved(s=snapshot(),module=r,release=g.prepare({env:{}})){
 return {FULLHOUSE_AUTHORIZE_FAILED_RECOVERY:id.PROJECT,FULLHOUSE_RECOVERY_EXCLUSIVE_WINDOW:id.PROJECT,FULLHOUSE_APPROVED_GCLOUD_RELEASE:release.releaseHash,FULLHOUSE_APPROVED_FAILED_RECOVERY:module.seal(s,release).recoveryHash};
}
function executor(release,{fail=false,badReadback=false}={}){
 const calls=[],saved=fixture.readback(release);saved.fn.createTime=snapshot().fn.createTime;
 return {calls,execute:(program,args)=>{
  calls.push({program,args});assert.equal(program,'gcloud');
  if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return '{}';
  if(args[0]==='functions'){if(fail)throw Error('synthetic interrupted update');return JSON.stringify(saved.fn);}
  if(args[0]==='builds'){if(badReadback)throw Error('synthetic read failure');return JSON.stringify(saved.build);}return JSON.stringify(saved.invoker);
 }};
}
test('recovery inspection binds the entire verified snapshot and unchanged release to a deterministic control hash',()=>{
 const s=snapshot(),p=g.prepare({env:{}}),proof=r.seal(s,p);assert.equal(proof.releaseHash,p.releaseHash);assert.match(proof.recoveryHash,/^[a-f0-9]{64}$/);assert.deepEqual(r.seal(structuredClone(s),p),proof);
 const ordered=Object.fromEntries(Object.entries(s).reverse());assert.equal(r.seal(ordered,p).recoveryHash,proof.recoveryHash);
 const changed=structuredClone(s);changed.fn.updateTime='2026-11-27T12:00:01Z';assert.notEqual(r.seal(changed,p).recoveryHash,proof.recoveryHash);
 const report=r.report(s,p);assert.equal(report.mode,'READ_ONLY_RECOVERY_INSPECTION');assert.equal(report.observed.build,s.fn.buildConfig.build);assert.equal(report.observed.run.http,404);
 assert.throws(()=>g.assertAudit(s.audit),/Solo primer ensayo cerrado/);
});
test('every identity, state, capacity, source, environment, previous build and pending-operation precondition fails closed',()=>{
 const mutations=[s=>s.fn.name=id.FUNCTION+'Extra',s=>s.fn.environment='GEN_1',s=>s.fn.state='ACTIVE',s=>s.fn.state='DEPLOYING',s=>s.fn.state='UNKNOWN',s=>s.fn.buildConfig.build=s.fn.buildConfig.build.replace(r.PREVIOUS_BUILD,'other'),s=>s.fn.buildConfig.serviceAccount='compute@developer.gserviceaccount.com',s=>s.fn.buildConfig.runtime='nodejs24',s=>s.fn.buildConfig.dockerRepository='other',s=>s.fn.buildConfig.source.storageSource.bucket='other',s=>s.fn.serviceConfig.serviceAccountEmail=id.BUILD_EMAIL,s=>s.fn.serviceConfig.maxInstanceCount=2,s=>s.fn.serviceConfig.availableCpu='1',s=>s.fn.serviceConfig.environmentVariables.FULLHOUSE_REMOTE_STAGING_ENABLED='1',s=>s.fn.serviceConfig.environmentVariables.FULLHOUSE_STAGING_TEST_UIDS='A',s=>s.fn.serviceConfig.environmentVariables.EXTRA='unexpected',s=>s.fn.serviceConfig.secretEnvironmentVariables=[{}],s=>s.fn.eventTrigger={},s=>delete s.fn.createTime,s=>s.previousBuild.status='FAILURE',s=>s.previousBuild.serviceAccount='other',s=>s.previousBuild.sourceProvenance.resolvedStorageSource.bucket='external',s=>s.run.http=403,s=>s.run.reason='SERVICE_DISABLED',s=>s.operations.push({done:false,metadata:{target:id.FUNCTION}}),s=>s.operations.push({done:false,metadata:{target:{}}})];
 for(const mutate of mutations){const s=snapshot();mutate(s);assert.throws(()=>r.assertSnapshot(s));}
});
test('minimal IAM remains mandatory and update/inspection permissions are all checked without requiring create',()=>{
 for(const permission of r.REQUIRED){const s=snapshot();s.audit.recoveryPermissions=s.audit.recoveryPermissions.filter(p=>p!==permission);assert.throws(()=>r.assertSnapshot(s),/permisos/);}
 for(const mutate of [s=>s.audit.assessment.directPolicy='review-required',s=>s.audit.gcloudResources.basicInputsVerified=false,s=>s.audit.buildSelection.dedicated.operatorActAsVerified=false,s=>s.audit.buildSelection.dedicated.ownerOrEditorDirectGrant=true,s=>s.audit.deployer.runtimeActAsVerified=false,s=>s.audit.managedIdentities.functions.directProjectRoles=[]]){const s=snapshot();mutate(s);assert.throws(()=>r.assertSnapshot(s));}
 assert.equal(r.REQUIRED.includes('cloudfunctions.functions.create'),false);assert.doesNotThrow(()=>r.assertSnapshot(snapshot()));
});
test('independent authorization, exact hashes, exclusive window and Node22 are required before any CLI or audit access',async()=>{
 let calls=0;const never=()=>{calls++;throw Error('No external access expected');};
 const env=approved();for(const patch of [{FULLHOUSE_AUTHORIZE_FAILED_RECOVERY:undefined},{FULLHOUSE_RECOVERY_EXCLUSIVE_WINDOW:undefined},{FULLHOUSE_AUTHORIZE_FAILED_RECOVERY:'other'},{FULLHOUSE_APPROVED_GCLOUD_RELEASE:'short'},{FULLHOUSE_APPROVED_FAILED_RECOVERY:'short'}])await assert.rejects(r.recover({env:{...env,...patch},nodeVersion:'22.23.5',execute:never,read:never}));
 await assert.rejects(r.recover({env,nodeVersion:'24.22.1',execute:never,read:never}));
 await assert.rejects(r.recover({env:{...env,GOOGLE_APPLICATION_CREDENTIALS:'/not-read'},nodeVersion:'22.23.5',execute:never,read:never}));assert.equal(calls,0);
});
test('repository gate false remains closed and recovery code changes invalidate previous inspection approval',async()=>{
 const isolated=fixture.isolatedAuthorizedModule({deploymentAuthorized:false}),m=require(path.join(isolated.dir,'scripts/remote-staging-recovery.cjs'));let calls=0;const never=()=>{calls++;throw Error('No access');};
 await assert.rejects(m.recover({env:{},nodeVersion:'22.23.5',execute:never,read:never}),/repositorio cerrada/);assert.equal(calls,0);
 const p=isolated.module.prepare({env:{}}),before=m.seal(snapshot(),p).recoveryHash;fs.appendFileSync(path.join(isolated.dir,'scripts/remote-staging-recovery.cjs'),'\n// synthetic code change\n');const after=m.seal(snapshot(),p).recoveryHash;assert.notEqual(after,before);fs.appendFileSync(path.join(isolated.dir,'scripts/probe-remote-staging-runtime.cjs'),'\n// synthetic guard change\n');assert.notEqual(m.seal(snapshot(),p).recoveryHash,after);
});
test('wrong release, stale approved inspection and missing permissions never reach a mutating command',async()=>{
 const p=g.prepare({env:{}}),s=snapshot(),env=approved(s,r,p);
 for(const patch of [{FULLHOUSE_APPROVED_GCLOUD_RELEASE:'a'.repeat(64)},{FULLHOUSE_APPROVED_FAILED_RECOVERY:'a'.repeat(64)}]){const e=executor(p);await assert.rejects(r.recover({env:{...env,...patch},nodeVersion:'22.23.5',execute:e.execute,read:async()=>s}));assert.equal(e.calls.length,2);}
 const e=executor(p),bad=structuredClone(s);bad.audit.recoveryPermissions=[];await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>bad}));assert.equal(e.calls.length,2);
});
test('resource changes between fresh inspections stop before upload/update',async()=>{
 const s=snapshot(),p=g.prepare({env:{}}),env=approved(s,r,p),e=executor(p);let reads=0;
 const changed=structuredClone(s);changed.fn.updateTime='2026-11-27T12:00:02Z';
 await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>++reads===1?s:changed}),/Estado modificado/);assert.equal(reads,2);assert.equal(e.calls.length,2);
});
test('unreviewed SDK or CLI credential/endpoint overrides stop before inspection or upload',async()=>{
 const env=approved();let inspections=0,mutations=0;
 for(const config of [{auth:{impersonate_service_account:'other'}},{api_endpoint_overrides:{cloudfunctions:'https://other.invalid'}},{core:{log_http:true}}]){
  await assert.rejects(r.recover({env,nodeVersion:'22.23.5',read:async()=>{inspections++;return snapshot();},execute:(_,args)=>{if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return JSON.stringify(config);mutations++;throw Error('No mutation');}}),/Configuración CLI/);
 }
 await assert.rejects(r.recover({env,nodeVersion:'22.23.5',read:async()=>{inspections++;return snapshot();},execute:()=>JSON.stringify({'Google Cloud SDK':'other'})}),/Versión gcloud/);assert.equal(inspections,0);assert.equal(mutations,0);
});
test('successful simulation updates only the fixed target with dedicated identities and verifies the new build and closed service',async()=>{
 const s=snapshot(),p=g.prepare({env:{}}),env=approved(s,r,p),e=executor(p);let reads=0;
 const result=await r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>{reads++;return structuredClone(s);}});
 assert.equal(result.mode,'CLOSED_RECOVERY_METADATA_VERIFIED');assert.equal(result.recoveryHash,env.FULLHOUSE_APPROVED_FAILED_RECOVERY);assert.equal(reads,2);assert.equal(e.calls.length,5);assert.deepEqual(e.calls[2].args,p.args);assert(!JSON.stringify(e.calls).includes('compute@developer'));
 assert.equal(e.calls.some(c=>c.args.includes('delete')),false);assert.equal(require('../remote-staging/settings.json').remoteEnabled,false);assert.equal(require('../staging/remote-config.example.json').enabled,false);
});
test('failed update, lost acknowledgement and readback failures are uncertain, without redeploy or cleanup',async()=>{
 const s=snapshot(),p=g.prepare({env:{}}),env=approved(s,r,p);
 for(const options of [{fail:true},{badReadback:true}]){const e=executor(p,options);await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>s}),/confirmación incierta/);assert.equal(e.calls.filter(c=>c.args[0]==='functions').length,1);assert.equal(e.calls.some(c=>c.args.includes('delete')),false);}
 const e=executor(p);await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>{throw Error('inspection interrupted');}}),/inspection interrupted/);assert.equal(e.calls.length,2);
});
test('recreated or still-failed functions are rejected by post-deployment verification',async()=>{
 const s=snapshot(),p=g.prepare({env:{}}),env=approved(s,r,p),e=executor(p),execute=e.execute;
 e.execute=(program,args)=>{const result=execute(program,args);if(args[0]!=='functions')return result;const fn=JSON.parse(result);fn.createTime='2026-11-28T00:00:00Z';return JSON.stringify(fn);};
 await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:e.execute,read:async()=>s}),/confirmación incierta/);assert.equal(e.calls.length,3);
 const next=executor(p),original=next.execute;next.execute=(program,args)=>{const result=original(program,args);if(args[0]!=='functions')return result;const fn=JSON.parse(result);fn.state='FAILED';return JSON.stringify(fn);};await assert.rejects(r.recover({env,nodeVersion:'22.23.5',execute:next.execute,read:async()=>s}),/confirmación incierta/);
});
function liveFetcher(s,{failure,changeLast=false,pages=false}={}){
 let functions=0;const calls=[];
 return {calls,fetcher:async(url,options)=>{
  calls.push({url,method:options.method});assert.equal(options.headers.authorization,'Bearer synthetic');
  if(failure&&url.includes(failure.part))return {ok:false,status:failure.http,json:async()=>({error:{status:failure.status,...(failure.reason?{details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:failure.reason}]}:{})}})};
  if(url.includes(':testIamPermissions'))return {ok:true,json:async()=>({permissions:[...r.REQUIRED]})};
  if(url.includes('/operations?'))return {ok:true,json:async()=>({operations:s.operations,...(pages?{nextPageToken:'repeated'}:{})})};
  if(url.includes('/functions/')){functions++;return {ok:true,json:async()=>changeLast&&functions>1?{...s.fn,updateTime:'2026-11-28T01:00:00Z'}:s.fn};}
  if(url.includes('/builds/'))return {ok:true,json:async()=>s.previousBuild};
  return {ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND'}})};
 }};
}
test('live inspection port uses only metadata GETs and testIamPermissions POST; distinguishes explicit Run NOT_FOUND',async()=>{
 const s=snapshot(),f=liveFetcher(s);const result=await r.readLive({token:'synthetic',readAudit:async()=>structuredClone(s.audit),fetcher:f.fetcher});r.assertSnapshot(result);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.calls.filter(c=>c.url.includes('/functions/')).length,2);
});
test('403, unqualified 404, disabled APIs, inconsistent live metadata and incomplete pagination remain blocked',async()=>{
 const s=snapshot();for(const options of [{failure:{part:'/services/',http:403,status:'PERMISSION_DENIED'}},{failure:{part:'/services/',http:404,status:'UNKNOWN'}},{failure:{part:'/services/',http:404,status:'NOT_FOUND',reason:'SERVICE_DISABLED'}},{failure:{part:'/functions/',http:404,status:'NOT_FOUND'}},{failure:{part:'/builds/',http:403,status:'PERMISSION_DENIED'}},{changeLast:true},{pages:true}]){const f=liveFetcher(s,options);await assert.rejects(r.readLive({token:'synthetic',readAudit:async()=>s.audit,fetcher:f.fetcher}));}
});
test('CLI default is a local plan and free-form destinations are rejected without cloud access',()=>{
 const file=path.resolve(__dirname,'../scripts/remote-staging-recovery.cjs');const result=spawnSync(process.execPath,[file],{env:{},encoding:'utf8'});assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).mode,'PLAN_ONLY');
 const bad=spawnSync(process.execPath,[file,'--recover','--project=other'],{env:{},encoding:'utf8'});assert.equal(bad.status,2);assert.match(bad.stderr,/no flags libres/);
});
