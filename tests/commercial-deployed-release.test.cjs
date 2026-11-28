'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup,fixture,zipFiles}=require('./helpers/deployed-release.cjs');
const {verifySourceZip,MAX_ZIP}=require('../scripts/remote-staging-source-zip.cjs');
const x=setup(),v=x.v;
after(()=>fs.rmSync(x.dir,{recursive:true,force:true}));
const check=(report,name)=>report.checks.find(c=>c.name===name);
const blocked=(e,name,status)=>{const r=v.diagnose(e,x.local);assert.equal(r.status,'blocked');assert.equal(check(r,name).status,status);return r;};
const sync=e=>{e.end=structuredClone({fn:e.fn,service:e.service,revision:e.revision,policy:e.policy});return e;};

test('issue #34: old readback rejects managed source; retrospective path verifies exact source + official revision/digest chain',()=>{
 const e=fixture(x);
 assert.throws(()=>x.plan&&require('../scripts/remote-staging-gcloud.cjs').verifyReadback({...e,invoker:e.policy,plan:x.plan}));
 const result=v.diagnose(e,x.local);assert.equal(result.status,'verified');assert.deepEqual(result.blocked,[]);
 assert.equal(result.evidence.sourceVerification.files,11);assert.equal(check(result,'build.results.images').status,'missing');
 assert.equal(check(result,'build.sourceProvenance').status,'missing');assert.equal(check(result,'provenance.signedAttestation').status,'not equivalent');
 assert.equal(check(result,'auth.appCheck').status,'unverified');assert.equal(result.userActivationAuthorized,false);
 assert.equal(e.build.results,undefined);assert.deepEqual(e.build.sourceProvenance,{});
});
test('release remains the exact deployed approved hash; labels alone cannot approve source bytes',()=>{
 assert.equal(x.local.releaseHash,'1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af');
 const e=fixture(x);delete e.zip;blocked(e,'source.bytes','unverified');
});
test('wrong build/project/builder/runtime/repository and changed local release all block',()=>{
 for(const mutate of [e=>e.fn.buildConfig.build+='-other',e=>e.build.id='other',e=>e.build.serviceAccount='664973716762-compute@developer.gserviceaccount.com',e=>e.fn.buildConfig.runtime='nodejs24',e=>e.fn.buildConfig.dockerRepository+='other',e=>e.project.projectId='other']){
  const e=fixture(x);mutate(e);assert.equal(v.diagnose(sync(e),x.local).status,'blocked');
 }
 assert.equal(v.diagnose(fixture(x),{...x.local,releaseHash:'0'.repeat(64)}).status,'blocked');
});
test('foreign bucket, generation, object ownership and different source bytes block',()=>{
 for(const mutate of [e=>e.fn.buildConfig.sourceProvenance.resolvedStorageSource.bucket='foreign',e=>e.fn.buildConfig.sourceProvenance.resolvedStorageSource.generation='1',e=>e.bucket.projectNumber='123',e=>e.object.generation='1',e=>e.fn.buildConfig.source.storageSource.object='other']){
  const e=fixture(x);mutate(e);assert.equal(v.diagnose(sync(e),x.local).status,'blocked');
 }
 const e=fixture(x),files=x.files.map(([n,b],i)=>[n,i?b:Buffer.from('other')]);e.zip=zipFiles(files);e.object.size=String(e.zip.length);blocked(e,'source.bytes','mismatch');
});
test('source ZIP stored/deflated and streaming descriptor variants compare the same 11 hashes',()=>{
 for(const options of [{},{compressed:true},{compressed:true,descriptor:true}])assert.equal(verifySourceZip(zipFiles(x.files,options),x.local.files).files,11);
});
test('ZIP corruption, truncation, extra/duplicate/traversal entries, overlap and excessive size fail closed',()=>{
 const zip=zipFiles(x.files),bad=Buffer.from(zip);bad[50]^=1;
 const overlap=Buffer.from(zip),end=overlap.length-22,central=overlap.readUInt32LE(end+16);overlap.writeUInt32LE(1,central+42);
 for(const b of [bad,zip.subarray(0,-1),Buffer.concat([zip,Buffer.from('extra')]),overlap,zipFiles([...x.files,['secret.json',Buffer.from('{}')]]),zipFiles(x.files.map((r,i)=>i===1?x.files[0]:r)),zipFiles(x.files.map((r,i)=>i===0?['../index.cjs',r[1]]:r)),Buffer.alloc(MAX_ZIP+1)])assert.throws(()=>verifySourceZip(b,x.local.files));
});
test('Run digest and Artifact Registry identity must match exactly; tags/names are not evidence',()=>{
 for(const mutate of [e=>e.revision.status.imageDigest=e.revision.status.imageDigest.replace('fullhouse-staging/','other/'),e=>e.revision.status.imageDigest=e.revision.spec.containers[0].image,e=>e.image.uri=e.image.uri.replace('a'.repeat(64),'b'.repeat(64)),e=>e.image.name+='other',e=>e.revision.spec.containers[0].image='foreign/image:latest']){
  const e=fixture(x);mutate(e);assert.equal(v.diagnose(sync(e),x.local).status,'blocked');
 }
 const e=fixture(x);e.revision.status.imageDigest=e.revision.status.imageDigest.replace('/remotev1@','/functions/remotev1@');
 e.revision.spec.containers[0].image=e.revision.status.imageDigest;e.image.uri=e.revision.status.imageDigest;
 const image=v.imageIdentity(e.image.uri);e.image.name=image.name.replace('functions/remotev1@','functions%2Fremotev1@');
 assert.equal(v.diagnose(sync(e),x.local).status,'verified');
});
test('missing Function build → revision association cannot be inferred from latest revision/labels/times',()=>{
 const e=fixture(x);delete e.fn.serviceConfig.revision;blocked(sync(e),'provenance.functionRevision','missing');
 const other=fixture(x);other.fn.serviceConfig.revision='remotev1-00002-def';blocked(sync(other),'provenance.functionRevision','mismatch');
 for(const prefix of ['projects/fullhouse-staging/locations/us-central1/services/remotev1/revisions/','namespaces/664973716762/revisions/']){
  const e=fixture(x);e.fn.serviceConfig.revision=prefix+e.revision.metadata.name;assert.equal(v.diagnose(sync(e),x.local).status,'verified');
 }
});
test('not Ready, non-reconciled, split traffic, tags and pending replacement block',()=>{
 for(const mutate of [e=>e.service.status.conditions[0].status='False',e=>e.service.status.observedGeneration=0,e=>e.revision.status.conditions[0].status='False',e=>e.service.status.traffic.push({revisionName:'remotev1-00002-abc',percent:0}),e=>e.service.status.traffic[0].tag='old',e=>e.service.status.latestCreatedRevisionName='remotev1-00002-abc']){
  const e=fixture(x);mutate(e);assert.equal(v.diagnose(sync(e),x.local).status,'blocked');
 }
});
test('unexpected config, activation, emulator, project overrides, sidecars, secrets and public non-invoker grants block',()=>{
 for(const mutate of [e=>e.fn.serviceConfig.maxInstanceCount=2,e=>e.fn.serviceConfig.environmentVariables.FULLHOUSE_REMOTE_STAGING_ENABLED='1',e=>e.revision.spec.containers[0].env.push({name:'FIREBASE_AUTH_EMULATOR_HOST',value:'localhost'}),e=>e.revision.spec.containers[0].env.push({name:'GOOGLE_CLOUD_PROJECT',value:'other'}),e=>e.revision.spec.containers.push({image:'other'}),e=>e.fn.serviceConfig.secretVolumes=[{}],e=>e.policy.bindings.push({role:'roles/editor',members:['allUsers']})]){
  const e=fixture(x);mutate(e);assert.equal(v.diagnose(sync(e),x.local).status,'blocked');
 }
});
test('contradictory optional Cloud Build evidence is never ignored',()=>{
 const e=fixture(x);e.build.results={images:[{name:'foreign/image',digest:'sha256:'+'b'.repeat(64)}]};blocked(e,'build.results.images','mismatch');
 const other=fixture(x);other.build.sourceProvenance.resolvedStorageSource={bucket:'foreign'};blocked(other,'build.sourceProvenance','mismatch');
 const input=fixture(x);input.build.source={storageSource:{bucket:'foreign'}};blocked(input,'build.sourceInput','mismatch');
 const r=fixture(x);r.revision.metadata.annotations['run.googleapis.com/build-name']='projects/other/locations/us-central1/builds/other';blocked(sync(r),'provenance.run.googleapis.com/build-name','mismatch');
});
test('PR35: build-id resource form must identify the same approved project, region and UUID',()=>{
 for(const project of ['fullhouse-staging','664973716762']){
  const e=fixture(x);e.revision.metadata.annotations['run.googleapis.com/build-id']=`projects/${project}/locations/us-central1/builds/${v.EXPECTED.buildId}`;
  assert.equal(v.diagnose(sync(e),x.local).status,'verified');
 }
});
test('PR35: automatic scaling with explicit inactive manual count zero retains min0/max1',()=>{
 const e=fixture(x);Object.assign(e.service.metadata.annotations,{'run.googleapis.com/scalingMode':'automatic','run.googleapis.com/manualInstanceCount':'0','run.googleapis.com/minScale':'0','run.googleapis.com/maxScale':'1'});
 assert.equal(v.diagnose(sync(e),x.local).status,'verified');
});
test('PR35: EnvVar.value omission means empty string, never a missing required variable',()=>{
 const e=fixture(x),entry=e.revision.spec.containers[0].env.find(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS');delete entry.value;
 assert.equal(v.diagnose(sync(e),x.local).status,'verified');
});
test('PR35: unknown environment additions fail closed and their values are never printed',()=>{
 const e=fixture(x);e.revision.spec.containers[0].env.push({name:'UNRECOGNIZED_SETTING',value:'SECRET_NEVER_PRINT_PR35'});
 const r=blocked(sync(e),'run.environment','mismatch');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35'));
});
test('PR35: one diagnostic explains all three blockers using existing metadata without exposing env values',()=>{
 const e=fixture(x),wrong='00000000-0000-0000-0000-000000000000';
 e.revision.metadata.annotations['run.googleapis.com/build-id']=wrong;
 Object.assign(e.service.metadata.annotations,{'run.googleapis.com/scalingMode':'manual','run.googleapis.com/manualInstanceCount':'1'});
 e.revision.spec.containers[0].env.push({name:'NODE_OPTIONS',value:'SECRET_NEVER_PRINT_PR35_OPTIONS'});
 const r=v.diagnose(sync(e),x.local),d=r.diagnostics;
 assert.deepEqual(r.blocked,['provenance.run.googleapis.com/build-id','run.serviceScaling','run.environment']);
 assert.equal(d.buildAnnotations['run.googleapis.com/build-id'].observed,wrong);assert.equal(d.buildAnnotations['run.googleapis.com/build-id'].idMatch,false);
 assert.equal(d.scaling.service['run.googleapis.com/scalingMode'].observed,'manual');assert.equal(d.scaling.effective.maxInstances,null);
 const row=d.environment.variables.find(x=>x.name==='NODE_OPTIONS');assert.equal(row.classification,'forbidden');assert.equal(row.comparison,'mismatch');
 assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35_OPTIONS'));assert.equal(check(r,'source.bytes').status,'verified');
});
test('PR35: full build references never accept a different project, region or UUID',()=>{
 for(const [project,region,uuid]of [['other-project','us-central1',v.EXPECTED.buildId],['fullhouse-staging','europe-west1',v.EXPECTED.buildId],['fullhouse-staging','us-central1','00000000-0000-0000-0000-000000000000']]){
  const e=fixture(x);e.revision.metadata.annotations['run.googleapis.com/build-id']=`projects/${project}/locations/${region}/builds/${uuid}`;
  blocked(sync(e),'provenance.run.googleapis.com/build-id','mismatch');
 }
 const e=fixture(x);e.revision.metadata.annotations['run.googleapis.com/build-id']='SECRET_NEVER_PRINT_PR35_ANNOTATION?token=private';
 const r=blocked(sync(e),'provenance.run.googleapis.com/build-id','mismatch');assert.equal(r.diagnostics.buildAnnotations['run.googleapis.com/build-id'].format,'unsupported');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35_ANNOTATION'));
});
test('PR35: scaling defaults and inert manual zero cannot conceal changed bounds or manual mode',()=>{
 for(const mutate of [e=>e.service.metadata.annotations['run.googleapis.com/scalingMode']='manual',e=>e.service.metadata.annotations['run.googleapis.com/scalingMode']='AUTO',e=>e.service.metadata.annotations['run.googleapis.com/manualInstanceCount']='1',e=>e.service.metadata.annotations['run.googleapis.com/minScale']='1',e=>e.service.metadata.annotations['run.googleapis.com/maxScale']='2',e=>e.service.metadata.annotations['run.googleapis.com/maxScale']='0',e=>e.service.metadata.annotations['run.googleapis.com/minScale']=0,e=>e.revision.metadata.annotations['autoscaling.knative.dev/maxScale']='2',e=>e.fn.serviceConfig.maxInstanceCount=2]){
  const e=fixture(x);mutate(e);const r=blocked(sync(e),'run.serviceScaling','mismatch');assert.equal(r.diagnostics.scaling.effective.maxInstances,null);assert(r.diagnostics.scaling.issues.length>0);
 }
 const e=fixture(x);e.service.metadata.annotations['run.googleapis.com/manualInstanceCount']='0';const r=v.diagnose(sync(e),x.local);
 assert.equal(r.status,'verified');assert.equal(r.diagnostics.scaling.effective.minInstances,0);assert.equal(r.diagnostics.scaling.effective.maxInstances,1);
 assert.equal(r.diagnostics.scaling.service['run.googleapis.com/maxScale'].present,false);
});
test('PR35: expected variable comparisons distinguish omitted empty value, absent row, duplicate and secret reference',()=>{
 for(const mutate of [rows=>rows.splice(rows.findIndex(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS'),1),rows=>rows.push({...rows[0]}),rows=>{const e=rows.find(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS');delete e.value;e.valueFrom={secretKeyRef:{name:'SECRET_NEVER_PRINT_PR35_REF'}};},rows=>{rows.find(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS').value=null;}]){
  const e=fixture(x);mutate(e.revision.spec.containers[0].env);const r=blocked(sync(e),'run.environment','mismatch');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35_REF'));
 }
 const e=fixture(x);delete e.revision.spec.containers[0].env.find(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS').value;
 const d=v.diagnose(sync(e),x.local).diagnostics.environment.variables.find(x=>x.name==='FULLHOUSE_STAGING_TEST_UIDS');
 assert.equal(d.comparison,'match');assert.equal(d.representation,'default-empty-string');assert(!Object.hasOwn(d,'value'));
});
test('PR35: inline Firebase JSON can vary only in formatting/key order, with no extra or contradictory fields',()=>{
 const e=fixture(x),entry=e.revision.spec.containers[0].env.find(x=>x.name==='FIREBASE_CONFIG');
 entry.value=JSON.stringify({storageBucket:'fullhouse-staging.firebasestorage.app',projectId:'fullhouse-staging'},null,2);
 const r=v.diagnose(sync(e),x.local);assert.equal(r.status,'verified');assert.equal(r.diagnostics.environment.variables.find(x=>x.name==='FIREBASE_CONFIG').representation,'equivalent-inline-json');
 for(const value of ['{}','[]','not-json',JSON.stringify({projectId:'other',storageBucket:'fullhouse-staging.firebasestorage.app'}),JSON.stringify({projectId:'fullhouse-staging',storageBucket:'other'}),JSON.stringify({projectId:'fullhouse-staging',storageBucket:'fullhouse-staging.firebasestorage.app',extra:'SECRET_NEVER_PRINT_PR35_JSON'})]){
  const e=fixture(x);e.revision.spec.containers[0].env.find(x=>x.name==='FIREBASE_CONFIG').value=value;const r=blocked(sync(e),'run.environment','mismatch');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35_JSON'));
 }
});
test('PR35: known platform names require exact identities; unknown, dangerous and malformed entries stay blocked',()=>{
 const platform={GCLOUD_PROJECT:'fullhouse-staging',GOOGLE_CLOUD_PROJECT:'fullhouse-staging',FUNCTION_TARGET:'remoteV1',FUNCTION_SIGNATURE_TYPE:'http',K_SERVICE:'remotev1',K_CONFIGURATION:'remotev1',K_REVISION:fixture(x).revision.metadata.name,PORT:'8080'};
 const e=fixture(x);e.revision.spec.containers[0].env.push(...Object.entries(platform).map(([name,value])=>({name,value})));assert.equal(v.diagnose(sync(e),x.local).status,'verified');
 for(const [name]of Object.entries(platform)){
  const e=fixture(x);e.revision.spec.containers[0].env.push({name,value:'SECRET_NEVER_PRINT_PR35_PLATFORM'});const r=blocked(sync(e),'run.environment','mismatch');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35_PLATFORM'));
 }
 for(const addition of [null,{name:'NODE_TLS_REJECT_UNAUTHORIZED',value:'0'},{name:'FIREBASE_AUTH_EMULATOR_HOST',value:''},{name:'UNEXPECTED_KEY',value:{secret:'SECRET_NEVER_PRINT_PR35_NESTED'}},{name:'INVALID NAME SECRET_NEVER_PRINT_PR35_NAME',value:'private'}]){
  const e=fixture(x);e.revision.spec.containers[0].env.push(addition);const r=blocked(sync(e),'run.environment','mismatch');assert(!JSON.stringify(r).includes('SECRET_NEVER_PRINT_PR35'));
 }
});
test('changing any final control snapshot blocks; diagnostic reports all failures together without secrets',()=>{
 const e=fixture(x);e.end.fn.updateTime='changed';e.end.service.metadata.generation=2;e.end.policy.bindings=[];e.end.revision.metadata.uid='changed';
 e.fn.serviceConfig.environmentVariables.PRIVATE_KEY='do-not-print';e.build.status='FAILURE';
 const r=v.diagnose(e,x.local);assert.equal(r.status,'blocked');assert(r.blocked.length>=6);assert(!JSON.stringify(r).includes('do-not-print'));
});
function responses(e){
 const src=`https://storage.googleapis.com/storage/v1/b/${v.EXPECTED.bucket}`,obj=`${src}/o/${encodeURIComponent(v.EXPECTED.object)}?generation=${v.EXPECTED.generation}`;
 return new Map([[`https://cloudresourcemanager.googleapis.com/v3/projects/fullhouse-staging`,e.project],[v.FUNCTION_URL,e.fn],[v.BUILD_URL,e.build],[v.SERVICE_URL,e.service],[v.POLICY_URL,e.policy],[`${v.RUN_BASE}/revisions/${e.revision.metadata.name}`,e.revision],[src+'?projection=noAcl',e.bucket],[obj,e.object],[obj+'&alt=media',e.zip],[v.imageIdentity(e.revision.status.imageDigest).url,e.image]]);
}
test('single diagnostic uses only bounded GETs to exact sources; API omissions remain explicit',async()=>{
 const e=fixture(x),map=responses(e),calls=[];
 const data=await v.readEvidence({token:'synthetic-token',fetcher:async(url,opts)=>{
  calls.push(url);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert(map.has(url),url);
  const value=map.get(url);return new Response(Buffer.isBuffer(value)?value:JSON.stringify(value),{status:200});
 }});
 assert.equal(v.diagnose(data,x.local).status,'verified');assert.equal(calls.length,14);
 assert(calls.every(url=>!url.includes('/users/')&&!url.includes(':setIamPolicy')&&!url.includes(':generateUploadUrl')));
});
test('403, unavailable ZIP, malformed JSON, interrupted streams and oversize responses produce one blocked report',async()=>{
 for(const failure of ['denied','invalid-json','interrupted','oversize']){
  const e=fixture(x),map=responses(e);let count=0;
  const data=await v.readEvidence({token:'synthetic-token',fetcher:async(url)=>{
   count++;if(url.includes('alt=media')){
    if(failure==='denied')return new Response('permission denied',{status:403});
    if(failure==='interrupted')return new Response(new ReadableStream({start(c){c.error(Error('lost'));}}));
    return new Response('x',{headers:{'content-length':String(MAX_ZIP+1)}});
   }
   if(failure==='invalid-json'&&url===v.BUILD_URL)return new Response('invalid');
   return new Response(JSON.stringify(map.get(url)));
  }});
  const r=v.diagnose(data,x.local);assert.equal(r.status,'blocked');assert(count>=13);assert(data.observations.some(o=>o.status==='unverified'));
 }
});
test('foreign source/image metadata never authorizes fetching foreign resources',async()=>{
 const e=fixture(x),map=responses(e);e.fn.buildConfig.sourceProvenance.resolvedStorageSource.bucket='foreign';e.revision.status.imageDigest=e.revision.status.imageDigest.replace('fullhouse-staging/','foreign/');
 const calls=[],data=await v.readEvidence({token:'synthetic-token',fetcher:async(url)=>{calls.push(url);assert(map.has(url));return new Response(JSON.stringify(map.get(url)));}});
 assert.equal(v.diagnose(data,x.local).status,'blocked');assert(!calls.some(url=>url.startsWith('https://storage.googleapis.com/')||url.startsWith('https://artifactregistry.googleapis.com/')));
});
test('wrong project identity stops further cloud reads, without considering errors an absent function',async()=>{
 let calls=0;const e=await v.readEvidence({token:'synthetic-token',fetcher:async()=>{calls++;return new Response('{}',{status:403});}});
 assert.equal(calls,1);assert.equal(v.diagnose(e,x.local).status,'blocked');assert.equal(e.observations[0].http,403);
});
test('CLI profile, SDK and dangerous environment are checked before requesting token',async()=>{
 for(const options of [{env:{GOOGLE_APPLICATION_CREDENTIALS:'do-not-read'},sdk:'592.0.0',cfg:{}},{env:{},sdk:'591.0.0',cfg:{}},{env:{},sdk:'592.0.0',cfg:{auth:{impersonate_service_account:'other'}}},{env:{},sdk:'592.0.0',cfg:{api_endpoint_overrides:{run:'http://localhost'}}}]){
  let tokens=0;await assert.rejects(v.inspect({env:options.env,execute:args=>JSON.stringify(args[0]==='version'?{'Google Cloud SDK':options.sdk}:options.cfg),getToken:()=>{tokens++;throw Error('forbidden');}}));assert.equal(tokens,0);
 }
});
test('complete inspector rechecks local approved bytes and issues no deploy or mutation command',async()=>{
 const map=responses(fixture(x)),commands=[];let tokens=0;
 const r=await v.inspect({env:{},execute:args=>{commands.push(args);return JSON.stringify(args[0]==='version'?{'Google Cloud SDK':'592.0.0'}:{});},getToken:()=>{tokens++;return 'synthetic-token';},fetcher:async(url,opts)=>{
  assert.equal(opts.method,'GET');assert(map.has(url));const value=map.get(url);return new Response(Buffer.isBuffer(value)?value:JSON.stringify(value));
 }});
 assert.equal(r.status,'verified');assert.equal(tokens,1);assert.deepEqual(commands,[['version','--format=json'],['config','list','--format=json']]);
});
test('malformed control metadata does not prevent reporting independent failures',()=>{
 const e=fixture(x);e.service.status.traffic=[null];e.bucket.location=42;e.fn.serviceConfig.environmentVariables=null;e.build.results={images:'invalid'};
 const r=v.diagnose(e,x.local);assert.equal(r.status,'blocked');assert(r.blocked.length>=4);
});
test('plan-only path cannot deploy and preserves all release/backend/client barriers',()=>{
 const plan=v.planned();assert.equal(plan.mode,'READ_ONLY_PLAN');assert.equal(plan.releaseHash,x.plan.releaseHash);
 const settings=JSON.parse(fs.readFileSync(require('node:path').join(x.dir,'remote-staging/settings.json')));
 const client=JSON.parse(fs.readFileSync(require('node:path').join(x.dir,'staging/remote-config.example.json')));
 assert.equal(settings.remoteEnabled,false);assert.equal(client.enabled,false);assert.equal(client.appCheckSiteKey,null);
 const text=fs.readFileSync(require('node:path').join(x.dir,'scripts/verify-remote-staging-release.cjs'),'utf8');
 assert(!text.includes('deployClosed('));assert(!text.includes('deleteFailed('));
});
