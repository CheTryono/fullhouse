'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const fixture=require('./helpers/gcloud-closed.cjs'),{snapshot}=require('./helpers/recovery.cjs'),id=require('../scripts/remote-staging-build-identity.cjs');
const isolated=fixture.isolatedAuthorizedModule(),g=isolated.module,r=require(path.join(isolated.dir,'scripts/remote-staging-recovery.cjs'));
const field=(d,name)=>d.checks.find(row=>row.field===name);
function omittedAccount(){const s=snapshot();delete s.audit.function.runtimeServiceAccount;delete s.fn.serviceConfig.serviceAccountEmail;return s;}
test('owner-reported missing runtime identity is not classified as an incorrect account or inferred from the builder',()=>{
 const s=omittedAccount(),d=r.diagnoseSnapshot(s);assert.equal(field(d,'audit.function.runtimeServiceAccount').status,'missing');assert.equal(field(d,'function.serviceConfig.serviceAccountEmail').status,'missing');assert.equal(d.summary.mismatch,0);assert.equal(d.update.status,'blocked');assert.equal(d.update.authorized,false);assert.equal(d.update.recoveryHash,null);assert.throws(()=>r.assertSnapshot(s));
 assert.equal(d.recreation.executable,false);assert.equal(d.recreation.dataAbsence,'NOT_INSPECTED');
 assert.equal(d.recreation.metadataStatus,'identity-and-state-verifiable');assert.equal(d.recreation.permissions,'DELETE_AND_CREATE_NOT_CHECKED');
});
test('one diagnostic lists all absent service configuration, environment and other metadata preconditions',()=>{
 const s=omittedAccount();delete s.fn.serviceConfig;delete s.fn.buildConfig.environmentVariables;delete s.fn.labels;delete s.fn.createTime;delete s.previousBuild.sourceProvenance;
 const d=r.diagnoseSnapshot(s);
 for(const name of ['function.serviceConfig.serviceAccountEmail','function.serviceConfig.availableMemory','function.serviceConfig.availableCpu','function.serviceConfig.maxInstanceCount','function.serviceConfig.maxInstanceRequestConcurrency','function.serviceConfig.timeoutSeconds','function.serviceConfig.ingressSettings','function.serviceConfig.environmentVariables.FIREBASE_CONFIG','function.serviceConfig.environmentVariables.FULLHOUSE_STAGING_TEST_UIDS','function.buildConfig.environmentVariables.GOOGLE_NODE_RUN_SCRIPTS','function.labels.fullhouse-release','function.createTime','previousBuild.resolvedSource.generation'])assert.equal(field(d,name)?.status,'missing',name);
 assert.equal(d.update.status,'blocked');assert(d.summary.verified>0);assert(d.summary.missing>15);assert(!d.checks.some(row=>row.status==='verified'));
});
test('present contradictions remain mismatches and sensitive values never enter the diagnostic',()=>{
 const s=snapshot();s.fn.serviceConfig.serviceAccountEmail='private-wrong-account@example.invalid';s.fn.serviceConfig.environmentVariables.PRIVATE_KEY='PRIVATE-SECRET-DO-NOT-PRINT';s.previousBuild.results.images[0].digest='private-corrupt-image';
 const d=r.diagnoseSnapshot(s),text=JSON.stringify(d);assert.equal(field(d,'function.serviceConfig.serviceAccountEmail').status,'mismatch');assert.equal(field(d,'function.serviceConfig.environmentVariables.keys').status,'mismatch');assert.equal(field(d,'previousBuild.images').status,'mismatch');
 for(const secret of ['private-wrong-account','PRIVATE-SECRET','private-corrupt-image'])assert(!text.includes(secret));assert.equal(d.update.status,'blocked');
});
test('complete metadata still requires the original strict contract and separate inspection approval',()=>{
 const s=snapshot(),d=r.diagnoseSnapshot(s);assert.equal(d.update.status,'preconditions-complete');assert.equal(d.update.authorized,false);assert.equal(d.update.recoveryHash,null);assert.deepEqual(d.checks,[]);assert.doesNotThrow(()=>r.assertSnapshot(s));
 const p=g.prepare({env:{}}),proof=r.seal(s,p);assert.match(proof.recoveryHash,/^[a-f0-9]{64}$/);assert.match(proof.controls['remote-staging-recovery-diagnostic.cjs'],/^[a-f0-9]{64}$/);
});
test('missing runtime and diagnostic output cannot authorize the existing update route',async()=>{
 const valid=snapshot(),p=g.prepare({env:{}}),proof=r.seal(valid,p),env={FULLHOUSE_AUTHORIZE_FAILED_RECOVERY:id.PROJECT,FULLHOUSE_RECOVERY_EXCLUSIVE_WINDOW:id.PROJECT,FULLHOUSE_APPROVED_GCLOUD_RELEASE:p.releaseHash,FULLHOUSE_APPROVED_FAILED_RECOVERY:proof.recoveryHash};let mutations=0;
 await assert.rejects(r.recover({env,nodeVersion:'22.23.5',read:async()=>omittedAccount(),execute:(_,args)=>{if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return '{}';mutations++;throw Error('No mutation authorized');}}));assert.equal(mutations,0);
});
function fetcherFor(s,{failParts=[],runExists=false,changeLast=false,incompletePages=false}={}){
 let reads=0;const calls=[];return {calls,fetcher:async(url,options)=>{
  calls.push({url,method:options.method});
  if(failParts.some(part=>url.includes(part)))return {ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:'Bearer PRIVATE-ERROR-TOKEN'}})};
  if(url.includes(':testIamPermissions'))return {ok:true,status:200,json:async()=>({permissions:r.REQUIRED})};
  if(url.includes('/operations?'))return {ok:true,status:200,json:async()=>({operations:s.operations,...(incompletePages?{nextPageToken:'same'}:{})})};
  if(url.includes('/functions/')){reads++;return {ok:true,status:200,json:async()=>changeLast&&reads>1?{...s.fn,updateTime:'2026-11-29T00:00:00Z'}:s.fn};}
  if(url.includes('/builds/'))return {ok:true,status:200,json:async()=>s.previousBuild};
  if(runExists)return {ok:true,status:200,json:async()=>{throw Error('Raw Run metadata must not be decoded or printed');}};
  return {ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND'}})};
 }};
}
test('diagnostic collection reads all sources despite 403 and emits unknown, never fabricated absence',async()=>{
 const s=omittedAccount(),f=fetcherFor(s,{failParts:['/services/','/builds/']});const data=await r.readLive({token:'synthetic',fetcher:f.fetcher,readAudit:async()=>structuredClone(s.audit),diagnostic:true}),d=r.diagnoseSnapshot(data);
 assert.equal(field(d,'read.run').http,403);assert.equal(field(d,'read.previousBuild').http,403);assert.equal(field(d,'run.http').status,'missing');assert(f.calls.some(c=>c.url.includes('/operations?')));assert.equal(f.calls.filter(c=>c.url.includes('/functions/')).length,2);assert(!JSON.stringify(d).includes('PRIVATE-ERROR-TOKEN'));assert.equal(d.update.status,'blocked');
});
test('changed metadata, existing Run, and incomplete pagination are summarized as blockers while strict reads still reject',async()=>{
 for(const options of [{runExists:true},{changeLast:true},{incompletePages:true}]){
  const s=snapshot(),f=fetcherFor(s,options);const data=await r.readLive({token:'synthetic',fetcher:f.fetcher,readAudit:async()=>structuredClone(s.audit),diagnostic:true}),d=r.diagnoseSnapshot(data);assert.equal(d.update.status,'blocked');assert(d.summary.unverified>0);
  if(options.incompletePages)assert.equal(field(d,'operations.complete').status,'missing');
  const strict=fetcherFor(s,options);await assert.rejects(r.readLive({token:'synthetic',fetcher:strict.fetcher,readAudit:async()=>structuredClone(s.audit)}));
 }
});
test('malformed or wholly unavailable metadata yields all missing checks without throwing or granting permission',()=>{
 for(const s of [{},{audit:{},fn:{serviceConfig:null},previousBuild:{},operations:null},{audit:null,fn:null,run:null,readIssues:[{source:'credentials',status:'unverified'}]}]){const d=r.diagnoseSnapshot(s);assert.equal(d.update.status,'blocked');assert(d.summary.missing>0);assert.equal(d.recreation.deleteAuthorized,false);assert.equal(d.recreation.createAuthorized,false);assert.equal(d.update.recoveryHash,null);}
});
test('known omitted optional defaults do not become invented required historical facts',()=>{
 const s=snapshot();delete s.fn.serviceConfig.service;delete s.fn.serviceConfig.minInstanceCount;delete s.previousBuild.id;delete s.previousBuild.projectId;assert.doesNotThrow(()=>r.assertSnapshot(s));assert.equal(r.diagnoseSnapshot(s).update.status,'preconditions-complete');
 delete s.fn.serviceConfig;assert.equal(r.diagnoseSnapshot(s).update.status,'blocked');
});
test('recreation proposal distinguishes incomplete target identity/Run inspection from missing previous service metadata',()=>{
 const s=omittedAccount();delete s.fn.serviceConfig;const report=r.diagnoseSnapshot(s);assert.equal(report.recreation.metadataStatus,'identity-and-state-verifiable');assert.equal(report.recreation.deleteAuthorized,false);
 for(const mutate of [v=>delete v.fn.createTime,v=>v.fn.state='ACTIVE',v=>v.run.http=403,v=>v.operations.push({done:false,metadata:{target:id.FUNCTION}})]){const changed=structuredClone(s);mutate(changed);const d=r.diagnoseSnapshot(changed);assert.equal(d.recreation.metadataStatus,'blocked');assert(d.recreation.blockingChecks.length>0);}
});
test('CLI emits valid blocked diagnostic JSON with exit2, no raw metadata, and no deploy/delete route',()=>{
 const s=omittedAccount(),preload=path.join(isolated.dir,'synthetic-preload.cjs'),file=path.join(isolated.dir,'synthetic.json');fs.writeFileSync(file,JSON.stringify(s));
 fs.writeFileSync(preload,`const fs=require('node:fs'),Module=require('node:module'),s=JSON.parse(fs.readFileSync(${JSON.stringify(file)})),load=Module._load;
 Module._load=function(name,...args){if(name==='./audit-remote-staging-iam.cjs'){const actual=load.call(this,name,...args);return {...actual,localToken:()=> 'synthetic',audit:async()=>structuredClone(s.audit)};}return load.call(this,name,...args);};
 require('node:child_process').execFileSync=()=>{throw Error('External CLI forbidden');};
 global.fetch=async url=>{if(url.includes(':testIamPermissions'))return {ok:true,json:async()=>({permissions:s.audit.recoveryPermissions})};if(url.includes('/operations?'))return {ok:true,json:async()=>({operations:s.operations})};if(url.includes('/functions/'))return {ok:true,json:async()=>s.fn};if(url.includes('/builds/'))return {ok:true,json:async()=>s.previousBuild};return {ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND'}})};};`);
 const script=path.join(isolated.dir,'scripts/remote-staging-recovery.cjs'),result=spawnSync(process.execPath,['--require',preload,script,'--diagnose'],{env:{},encoding:'utf8',timeout:10000});assert.equal(result.status,2,result.stderr);assert.equal(result.stderr,'');const d=JSON.parse(result.stdout);assert.equal(d.update.status,'blocked');assert.equal(d.update.recoveryHash,null);
 const deletion=spawnSync(process.execPath,[script,'--delete'],{env:{},encoding:'utf8'});assert.equal(deletion.status,2);assert.match(deletion.stderr,/no flags libres/);
});
