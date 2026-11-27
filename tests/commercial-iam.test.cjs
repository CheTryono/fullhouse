'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const iam=require('../scripts/audit-remote-staging-iam.cjs'),probe=require('../scripts/probe-remote-staging-runtime.cjs'),{prepare}=require('../scripts/prepare-remote-staging-closed.cjs');
const {memoryPorts}=require('./helpers/remote.cjs'),settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');
const runId='11111111-2222-4333-8444-555555555555',member='serviceAccount:'+iam.RUNTIME,role='projects/fullhouse-staging/roles/testFirestore',storageRole='projects/fullhouse-staging/roles/testStorage';
function fixture(){return {account:{email:iam.RUNTIME,projectId:iam.PROJECT,disabled:false},projectPolicy:{version:3,bindings:[{role,members:[member]}]},bucketPolicy:{version:3,bindings:[{role:storageRole,members:[member],condition:{title:'users',expression:`resource.name.startsWith("${iam.PREFIX}")`}}]},roles:{[role]:{stage:'GA',includedPermissions:[...iam.FIRESTORE]},[storageRole]:{stage:'BETA',includedPermissions:[...iam.STORAGE]}},database:{name:'projects/fullhouse-staging/databases/(default)',databaseEdition:'STANDARD',type:'FIRESTORE_NATIVE',locationId:'us-central1'},bucket:{name:iam.BUCKET,location:'US-CENTRAL1',storageClass:'STANDARD',iamConfiguration:{uniformBucketLevelAccess:{enabled:true},publicAccessPrevention:'enforced'}}};}
function fakeHttp(f=fixture(),patch=()=>null){return async(url,options)=>{let data;
 if(url.includes('cloudresourcemanager.googleapis.com/v3/'))data={projectId:iam.PROJECT,name:'projects/'+iam.NUMBER};
 else if(url.endsWith(':testIamPermissions'))data={permissions:[]};
 else if(url.endsWith(':getIamPolicy'))data=f.projectPolicy;
 else if(url.includes('/iam?'))data=f.bucketPolicy;
 else if(url.includes(':getIamPolicy?'))data={version:3,bindings:[]};
 else if(url.includes('/roles/'))data=f.roles[url.split('/v1/')[1]];
 else if(url.includes('serviceusage.googleapis.com'))data={name:'projects/'+iam.NUMBER+'/services/'+url.split('/services/')[1],state:'ENABLED'};
 else if(url.includes('/serviceAccounts/'))data=f.account;
 else if(url.includes('firestore.googleapis.com'))data=f.database;
 else if(url.includes('storage.googleapis.com'))data=f.bucket;
 else if(url.includes('/functions/'))data={name:'projects/fullhouse-staging/locations/us-central1/functions/remoteV1',serviceConfig:{serviceAccountEmail:iam.RUNTIME},buildConfig:{runtime:'nodejs22'}};
 else data={serviceAccountEmail:iam.NUMBER+'-compute@developer.gserviceaccount.com'};
 return patch(url,options)||{ok:true,json:async()=>data};};}
test('minimal four/two role sets match only direct policies, never effective IAM approval',()=>{
 const f=fixture(),r=iam.assess(f);assert.equal(r.directPolicy,'matches-minimal-proposal');assert.match(r.effectiveAccess,/UNVERIFIED/);assert.equal(iam.FIRESTORE.length,4);assert.equal(iam.STORAGE.length,2);
 delete f.account.disabled;assert.equal(iam.assess(f).directPolicy,'matches-minimal-proposal');f.account.disabled=true;assert.equal(iam.assess(f).directPolicy,'review-required');
});
test('missing/extra/disabled role permissions, broad grants and conditional Firestore require review',()=>{
 for(const mutate of [f=>f.roles[role].includedPermissions.pop(),f=>f.roles[storageRole].includedPermissions.push('storage.objects.delete'),f=>f.roles[role].deleted=true,f=>f.roles[role].stage='DISABLED',f=>f.projectPolicy.bindings.push({role:'roles/editor',members:[member]}),f=>f.projectPolicy.bindings[0].condition={expression:'true'},f=>f.bucketPolicy.bindings.push({role:'roles/storage.admin',members:['allUsers']})]){const f=fixture();mutate(f);assert.equal(iam.assess(f).directPolicy,'review-required');}
});
test('CEL prefix is exact, preserves spaces inside literals, rejects OR and incomplete policy versions',()=>{
 assert(iam.conditionMatches({expression:` resource . name . startsWith ( '${iam.PREFIX}' ) `}));
 for(const expression of [`resource.name.startsWith("${iam.PREFIX.replace('users','us ers')}")`,`resource.name.startsWith("${iam.PREFIX}") || true`,`resource.name.startsWith("projects/_/buckets/${iam.BUCKET}/objects/")`,'true'])assert.equal(iam.conditionMatches({expression}),false);
 const f=fixture();f.bucketPolicy.version=1;assert.equal(iam.assess(f).directPolicy,'review-required');
});
test('wrong database/bucket/identity/privacy never passes the static audit',()=>{
 for(const mutate of [f=>f.account.email='other',f=>f.database.locationId='europe-west1',f=>f.database.databaseEdition='ENTERPRISE',f=>f.bucket.iamConfiguration.publicAccessPrevention='inherited',f=>f.bucket.iamConfiguration.uniformBucketLevelAccess.enabled=false]){const f=fixture();mutate(f);assert.equal(iam.assess(f).directPolicy,'review-required');}
});
test('owner-reported legacy REGIONAL bucket is Standard regional only with the required location and privacy',()=>{
 const f=fixture();f.bucket.storageClass='REGIONAL';f.bucket.softDeletePolicy={retentionDurationSeconds:'604800'};assert.equal(iam.assess(f).directPolicy,'matches-minimal-proposal');
 for(const storageClass of ['NEARLINE','COLDLINE','ARCHIVE','MULTI_REGIONAL']){f.bucket.storageClass=storageClass;assert.equal(iam.assess(f).directPolicy,'review-required');}
 f.bucket.storageClass='REGIONAL';f.bucket.location='EUROPE-WEST1';assert.equal(iam.assess(f).directPolicy,'review-required');f.bucket.location='US-CENTRAL1';f.bucket.iamConfiguration.publicAccessPrevention='inherited';assert.equal(iam.assess(f).directPolicy,'review-required');
});
test('service-account getIamPolicy uses the official POST endpoint; an old GET returning 404 is not proof of absence',async()=>{
 let seen;const http=fakeHttp(fixture(),(url,options)=>{if(url.includes('/serviceAccounts/')&&url.includes(':getIamPolicy?')){seen=options;return options.method==='POST'?{ok:true,json:async()=>({version:3,bindings:[]})}:{ok:false,status:404};}return null;});
 const result=await iam.audit({token:'synthetic',fetcher:http});assert.equal(seen.method,'POST');assert.equal(result.observations.find(x=>x.name==='accountPolicy').status,'observed');assert.deepEqual(result.runtimeImpersonationPolicy,{version:3,bindings:[]});
});
test('read-only audit uses fixed GET/getIamPolicy/testIamPermissions only, policy version 3 and redacted report',async()=>{
 const calls=[],http=fakeHttp(fixture(),()=>null),r=await iam.audit({token:'synthetic-secret',fetcher:async(url,options)=>{calls.push({url,options});return http(url,options);}});
 assert.equal(r.assessment.directPolicy,'matches-minimal-proposal');assert.equal(r.buildSelection.verifiedForNextDeploy,false);assert.equal(r.deployer.firstHttpsPolicyVerified,false);assert.equal(r.deployer.runtimeActAsVerified,false);assert(r.deployer.notGrantedAtProjectCheck.includes('cloudfunctions.functions.setIamPolicy'));
 for(const {url,options}of calls){assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert(!/:setIamPolicy|:enable|:generateAccessToken/.test(url));if(options.method==='POST')assert(/:(getIamPolicy|testIamPermissions)(?:\?|$)/.test(url));else assert.equal(options.method,'GET');}
 const policy=calls.find(x=>x.url.endsWith(':getIamPolicy'));assert.equal(JSON.parse(policy.options.body).options.requestedPolicyVersion,3);assert.equal(JSON.stringify(r).includes('synthetic-secret'),false);
});
test('403/404/unreadable data stay unknown, wrong project stops and external roles are not followed',async()=>{
 const f=fixture();f.projectPolicy.bindings.push({role:'projects/stellar-warriors/roles/external',members:[member]});const calls=[],base=fakeHttp(f,(u)=>u.includes('/iam?')?{ok:false,status:403}:null);
 const r=await iam.audit({token:'test',fetcher:async(u,o)=>{calls.push(u);return base(u,o);}});assert.equal(r.complete,false);assert.equal(r.assessment.bucketBindings,null);assert(calls.every(x=>!x.includes('stellar-warriors')));assert(r.observations.some(x=>x.http===403));
 const stopped=await iam.audit({token:'test',fetcher:async()=>({ok:true,json:async()=>({projectId:'other',name:'projects/1'})})});assert.equal(stopped.observations.length,1);
 const denied=await iam.audit({token:'never-print',fetcher:async()=>{throw Error('never-print');}});assert.equal(JSON.stringify(denied).includes('never-print'),false);
});
test('unverified service queries report safe ErrorInfo codes without turning 403 into resource absence',async()=>{
 const http=fakeHttp(fixture(),url=>{
  const service=url.includes('cloudfunctions.googleapis.com')?'cloudfunctions.googleapis.com':url.includes('cloudbuild.googleapis.com')?'cloudbuild.googleapis.com':url.includes('run.googleapis.com')?'run.googleapis.com':null;if(!service)return null;
  return {ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:'private diagnostic, token synthetic-do-not-print',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:service==='cloudfunctions.googleapis.com'?'SERVICE_DISABLED':'IAM_PERMISSION_DENIED',metadata:{service,consumer:'private-account',token:'synthetic-do-not-print'}}]}})};
 });
 const r=await iam.audit({token:'synthetic-do-not-print',fetcher:http});assert.equal(r.complete,false);assert.equal(r.observations.find(x=>x.name==='function').reason,'SERVICE_DISABLED');assert.equal(r.observations.find(x=>x.name==='buildDefault').reason,'IAM_PERMISSION_DENIED');
 for(const name of ['function','buildDefault','deployerRun']){const o=r.observations.find(x=>x.name===name);assert.equal(o.status,'unknown');assert.equal(o.http,403);assert.equal(o.rpcStatus,'PERMISSION_DENIED');}
 assert.equal(JSON.stringify(r).includes('synthetic-do-not-print'),false);assert.equal(JSON.stringify(r).includes('private-account'),false);
});
test('closed Functions API preflight is fixed to staging; enabled APIs never authorize deploy or choose a builder',async()=>{
 const r=await iam.audit({token:'synthetic',fetcher:fakeHttp()});const p=r.closedFunctionsPreparation;assert.equal(p.apiCheck,'all-observed-enabled');assert.equal(p.deploymentAuthorizedByAudit,false);assert.equal(r.buildSelection.verifiedForNextDeploy,false);assert.equal(p.apiStates.length,7);
 for(const request of iam.plan().requests.filter(x=>x.name.startsWith('api:'))){assert.equal(request.method,'GET');assert(request.url.startsWith(`https://serviceusage.googleapis.com/v1/projects/${iam.NUMBER}/services/`));}
});
test('disabled/inaccessible/incompatible API observations remain blockers, without inferring resource absence',async()=>{
 const http=fakeHttp(fixture(),url=>{
  if(url.endsWith('/services/cloudbuild.googleapis.com'))return {ok:true,json:async()=>({name:`projects/${iam.NUMBER}/services/cloudbuild.googleapis.com`,state:'DISABLED'})};
  if(url.endsWith('/services/run.googleapis.com'))return {ok:false,status:403};
  if(url.endsWith('/services/cloudfunctions.googleapis.com'))return {ok:true,json:async()=>({name:'projects/other/services/cloudfunctions.googleapis.com',state:'ENABLED'})};return null;
 });const r=await iam.audit({token:'synthetic',fetcher:http}),p=r.closedFunctionsPreparation;assert.equal(r.complete,false);assert.equal(p.apiCheck,'disabled-or-unverified');assert.equal(p.deploymentAuthorizedByAudit,false);
 assert.deepEqual(p.apiStates.map(x=>x.state),['ENABLED','DISABLED','UNKNOWN','UNKNOWN','ENABLED','ENABLED','ENABLED']);assert.equal(r.observations.find(x=>x.name==='api:cloudfunctions.googleapis.com').status,'unknown');
});
test('pinned CLI bootstraps Eventarc/PubSub even for HTTP-only gcfv2; preflight covers it without enabling services',async()=>{
 const api=require('firebase-tools/lib/ensureApiEnabled'),usage=require('firebase-tools/lib/gcp/serviceusage'),sdk=require('firebase-tools/lib/deploy/functions/prepare');
 const ensure=api.ensure,generate=usage.generateServiceIdentity,calls=[],identities=[];
 api.ensure=async(project,service)=>{assert.equal(project,iam.NUMBER);calls.push(new URL(service.startsWith('http')?service:'https://'+service).hostname);};
 usage.generateServiceIdentity=async(project,service)=>{assert.equal(project,iam.NUMBER);identities.push(service);};
 try{
  await sdk.ensureAllRequiredAPIsEnabled(iam.NUMBER,{requiredAPIs:[],endpoints:{'us-central1':{remoteV1:{platform:'gcfv2',callableTrigger:{}}}}});
  assert.deepEqual(calls.sort(),['eventarc.googleapis.com','pubsub.googleapis.com','run.googleapis.com','storage.googleapis.com']);
  assert.deepEqual(identities.sort(),['eventarc.googleapis.com','pubsub.googleapis.com']);assert(calls.every(service=>iam.CLOSED_APIS.includes(service)));
 }finally{api.ensure=ensure;usage.generateServiceIdentity=generate;}
});
test('real runtime probe is blocked by default and never accepts another project or an active/emulated environment',()=>{
 assert.equal(probe.plan().mode,'PLAN_ONLY');for(const id of ['../outside','short','11111111-2222-4333-7444-555555555555'])assert.throws(()=>probe.identities(id));
 for(const env of [{FIRESTORE_EMULATOR_HOST:'localhost:8088'},{GOOGLE_APPLICATION_CREDENTIALS:'/unused/file'},{GCLOUD_PROJECT:'other'},{FULLHOUSE_REMOTE_STAGING_ENABLED:'1'},{FULLHOUSE_STAGING_TEST_UIDS:'user'}])assert.throws(()=>probe.closed(settings,client,env));assert.throws(()=>probe.closed({...settings,remoteEnabled:true},client,{}));assert.throws(()=>probe.closed(settings,{...client,enabled:true},{}));
 const env={...process.env};delete env.FULLHOUSE_AUTHORIZE_IAM_PROBE;const r=spawnSync(process.execPath,['scripts/probe-remote-staging-runtime.cjs','--run','--run-id',runId],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/falta autorización/);
});
test('runtime token is short-lived, pinned to one identity, never a private key or ADC fallback',async()=>{
 let call;const grant=await probe.mint({operatorToken:'synthetic-operator',fetcher:async(url,options)=>{call={url,options};return {ok:true,json:async()=>({accessToken:'synthetic-runtime',expireTime:new Date(Date.now()+900000).toISOString()})};}});
 assert(call.url.includes(iam.RUNTIME+':generateAccessToken'));assert.equal(JSON.parse(call.options.body).lifetime,'900s');assert.equal(grant.token,'synthetic-runtime');assert.equal(call.options.redirect,'error');
 await assert.rejects(probe.mint({operatorToken:'synthetic',fetcher:async()=>({ok:false,status:403})}),{code:'IAM_TOKEN_403'});
});
test('pinned Firestore/Storage SDK clients share the explicit runtime auth, no ADC invocation',async()=>{
 const c=probe.clients({token:'synthetic-only-not-used',expires:Date.now()+900000});try{assert.equal(c.db._settings.auth,c.auth);assert.equal(c.bucket.storage.authClient,c.auth);assert.equal(c.db.projectId,iam.PROJECT);}finally{await c.close();}
});
function probePorts({outside='deny',list='deny',read='deny',fault}={}){
 const p=memoryPorts(),file=p.bucket.file;p.bucket.file=name=>{const f=file(name);return {...f,save:async(...args)=>{if(!name.startsWith('users/')&&outside==='deny')throw Object.assign(Error('deny'),{code:403});return f.save(...args);},getMetadata:async()=>{if(!name.startsWith('users/'))throw Object.assign(Error('outside'),{code:read==='deny'?403:404});return f.getMetadata();}};};p.bucket.getFiles=async()=>{if(list==='deny')throw Object.assign(Error('deny'),{code:403});return [[]];};if(fault)p.fault=fault;return p;
}
test('synthetic effective probe verifies transactions, rollback, immutable photo bytes, receipt/retry and denial; repeat stable',async()=>{
 const p=probePorts(),r=await probe.effectiveProbe(p,runId),objects=p.objects.size,docs=p.docs.size;assert.equal(r.status,'SYNTHETIC_IAM_PROBE_PASSED');assert.equal((await probe.effectiveProbe(p,runId)).receipt.revisionId,r.receipt.revisionId);assert.equal(p.objects.size,objects);assert.equal(p.docs.size,docs);
 assert.equal(p.docs.get('stagingAccess/'+r.run.uid).enabled,false);assert.equal(p.docs.has('stagingControl/remoteV1'),false);assert.equal(p.docs.has('billingEntitlements/'+r.run.uid),false);assert([...p.objects.keys()].every(k=>k.startsWith('users/'+r.run.uid+'/')));assert.equal([...p.objects.keys()].filter(k=>k.includes('/photos/')).length,1);
});
test('excess permission is failure; possible negative-test artifact is retained, never deleted automatically',async()=>{
 const p=probePorts({outside:'allow'});await assert.rejects(probe.effectiveProbe(p,runId));assert(p.objects.has('iam-probe-outside/'+runId+'.txt'));
 const wrong=probePorts({read:'not-found'});await assert.rejects(probe.effectiveProbe(wrong,runId));const list=probePorts({list:'allow'});await assert.rejects(probe.effectiveProbe(list,runId));
});
test('failed transaction/uncertain confirmation keep stable probe IDs for explicit inspection',async()=>{
 let failure='transaction';const p=probePorts({fault:async stage=>{if(stage===failure)throw Error('synthetic fault');}});await assert.rejects(probe.effectiveProbe(p,runId));const id=probe.identities(runId);assert.equal(p.docs.has(`users/${id.uid}/operations/${id.first}`),false);
 failure='after-commit';await assert.rejects(probe.effectiveProbe(p,runId));assert(p.docs.has(`users/${id.uid}/operations/${id.first}`));failure=null;assert.equal((await probe.effectiveProbe(p,runId)).receipt.revisionId,id.second);
});
test('local closed artifact preparation cannot authorize deploy or include active controls',()=>{
 const r=prepare({env:{}});assert.equal(r.remoteEnabled,false);assert.equal(r.clientEnabled,false);assert.equal(r.deploymentAuthorized,false);assert.match(r.manifestSha256,/^[a-f0-9]{64}$/);assert.throws(()=>prepare({env:{FULLHOUSE_REMOTE_STAGING_ENABLED:'1'}}));
 assert.throws(()=>require('../scripts/check-remote-staging-deploy.cjs').check({GCLOUD_PROJECT:iam.PROJECT,FULLHOUSE_AUTHORIZE_STAGING_DEPLOY:iam.PROJECT},'22.23.5'),/bloqueado/);
 assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../remote-staging/settings.json'))).deploymentAuthorized,false);
});
test('first HTTPS CLI check needs an operator permission, never added to the runtime',()=>{
 const policy=require('../remote-staging/iam.json');assert.deepEqual(policy.deployerFirstHttpsPolicy.includedPermissions,['cloudfunctions.functions.setIamPolicy']);assert(!iam.FIRESTORE.some(x=>/IamPolicy/.test(x)));assert(iam.DEPLOY.includes('cloudfunctions.functions.setIamPolicy'));
});
