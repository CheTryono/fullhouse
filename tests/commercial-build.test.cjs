'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const build=require('../scripts/remote-staging-build-identity.cjs'),iam=require('../scripts/audit-remote-staging-iam.cjs');
function explicitRequest(){return {name:build.FUNCTION,buildConfig:{runtime:'nodejs22',serviceAccount:build.BUILD_RESOURCE},serviceConfig:{serviceAccountEmail:build.RUNTIME}};}
test('pinned Firebase converter omits build identity, including guessed fields; runtime identity remains distinct',()=>{
 const r=build.inspectFirebaseTransport();assert.equal(r.version,'15.37.0');assert.equal(r.explicitBuildIdentityForwarded,false);assert.equal(r.request.buildConfig.serviceAccount,undefined);assert.equal(r.request.serviceConfig.serviceAccountEmail,build.RUNTIME);assert.throws(()=>build.assertBuildIdentity(r.request),/dedicada explícita/);
 const command=fs.readFileSync(require.resolve('firebase-tools/lib/commands/deploy'),'utf8');assert(!command.includes('--build-service-account'));
 const schema=require('firebase-tools/schema/firebase-config.json');assert.equal(schema.definitions.LocalFunctionConfig.additionalProperties,false);assert.equal(schema.definitions.LocalFunctionConfig.properties.buildServiceAccount,undefined);
});
test('Firebase readback also loses externally selected builder; preserveExternalChanges is not a safe selection path',()=>{
 const api=require('firebase-tools/lib/gcp/cloudfunctionsv2'),readback=api.endpointFromFunction(explicitRequest());const serialized=api.functionFromEndpoint(readback);
 assert.equal(serialized.buildConfig.serviceAccount,undefined);assert.throws(()=>build.assertBuildIdentity(serialized),/dedicada explícita/);
});
test('selection guard only accepts exact function, Node22, dedicated builder and separate runtime; no empty/default/cross-project fallback',()=>{
 assert.equal(build.assertBuildIdentity(explicitRequest()),true);
 for(const value of [undefined,null,'',`${build.NUMBER}-compute@developer.gserviceaccount.com`,`projects/${build.PROJECT}/serviceAccounts/${build.NUMBER}-compute@developer.gserviceaccount.com`,`projects/${build.PROJECT}/serviceAccounts/${build.NUMBER}@cloudbuild.gserviceaccount.com`,`projects/${build.PROJECT}/serviceAccounts/${build.RUNTIME}`,build.BUILD_EMAIL,build.BUILD_RESOURCE.replace(build.PROJECT,'other')]){const r=explicitRequest();r.buildConfig.serviceAccount=value;assert.throws(()=>build.assertBuildIdentity(r));}
 for(const mutate of [r=>r.name=build.FUNCTION.replace('us-central1','us-east1'),r=>r.buildConfig.runtime='nodejs24',r=>r.serviceConfig.serviceAccountEmail=build.BUILD_EMAIL]){const r=explicitRequest();mutate(r);assert.throws(()=>build.assertBuildIdentity(r));}
});
test('deployment flag alone cannot open unsupported Firebase transport, even with project/consent/environment overrides',()=>{
 const filename=path.resolve(__dirname,'../scripts/check-remote-staging-deploy.cjs'),localRequire=createRequire(filename),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:p=>p==='../remote-staging/settings.json'?{...require('../remote-staging/settings.json'),deploymentAuthorized:true}:localRequire(p),__dirname:path.dirname(filename),process,console},{filename});
 assert.throws(()=>module.exports.check({GCLOUD_PROJECT:build.PROJECT,FULLHOUSE_AUTHORIZE_STAGING_DEPLOY:build.PROJECT,BUILD_SERVICE_ACCOUNT:build.BUILD_RESOURCE,GOOGLE_CLOUD_BUILD_SERVICE_ACCOUNT:build.BUILD_RESOURCE},'22.23.5'),/Ruta de deploy bloqueada/);
 assert.equal(require('../remote-staging/settings.json').deploymentAuthorized,false);assert.equal(require('../remote-staging/settings.json').remoteEnabled,false);assert.equal(require('../staging/remote-config.example.json').enabled,false);
});
test('dedicated IAM assessment cannot mistake metadata/actAs or direct bindings for effective build access',()=>{
 const evidence={account:{email:build.BUILD_EMAIL,projectId:build.PROJECT},projectPolicy:{bindings:[{role:'roles/logging.logWriter',members:['serviceAccount:'+build.BUILD_EMAIL]}]},accountPolicy:{bindings:[{role:'roles/iam.serviceAccountUser',members:['user:synthetic-private-operator']}]},operatorPermissions:['iam.serviceAccounts.actAs']};
 const r=build.assessDedicated(evidence);assert.equal(r.identityVerified,true);assert.equal(r.operatorActAsVerified,true);assert.equal(r.ownerOrEditorDirectGrant,false);assert.equal(r.readyForDeploy,false);assert(!JSON.stringify(r).includes('synthetic-private-operator'));assert.match(r.sourceAndRepositoryScopes,/UNVERIFIED/);
 evidence.projectPolicy.bindings.push({role:'roles/editor',members:['serviceAccount:'+build.BUILD_EMAIL]});assert.equal(build.assessDedicated(evidence).ownerOrEditorDirectGrant,true);
 assert.equal(build.assessDedicated({}).identityVerified,false);assert.equal(build.assessDedicated({}).operatorActAsVerified,null);assert.equal(build.assessDedicated({}).directProjectRoles,null);
 evidence.account.disabled=true;assert.equal(build.assessDedicated(evidence).identityVerified,false);
});
test('read-only audit separates Compute with Editor from the dedicated proposal; no grant/impersonation/deploy requests',async()=>{
 const calls=[],runtimeMember='serviceAccount:'+build.RUNTIME,compute=`${build.NUMBER}-compute@developer.gserviceaccount.com`;
 const r=await iam.audit({token:'synthetic',fetcher:async(url,options)=>{
  calls.push({url,options});let data={};
  if(url.includes('/v3/projects/'))data={projectId:build.PROJECT,name:'projects/'+build.NUMBER};
  else if(url.includes('cloudresourcemanager')&&url.endsWith(':getIamPolicy'))data={bindings:[{role:'roles/editor',members:['serviceAccount:'+compute]},{role:'projects/fullhouse-staging/roles/runtime',members:[runtimeMember]}]};
  else if(url.endsWith('/defaultServiceAccount'))data={serviceAccountEmail:compute};
  else if(url.includes('/functions/'))return {ok:false,status:404};
  else if(url.endsWith('/serviceAccounts/'+build.BUILD_EMAIL))data={email:build.BUILD_EMAIL,projectId:build.PROJECT};
  else if(url.includes(build.BUILD_EMAIL)&&url.endsWith(':testIamPermissions'))data={permissions:['iam.serviceAccounts.actAs']};
  else if(url.includes('serviceusage.googleapis.com'))data={name:'projects/'+build.NUMBER+'/services/'+url.split('/services/')[1],state:'ENABLED'};
  return {ok:true,json:async()=>data};
 }});
 assert.equal(r.buildSelection.defaultCandidate,compute);assert.equal(r.buildSelection.defaultHasOwnerOrEditor,true);assert.equal(r.buildSelection.identity,compute);assert.equal(r.buildSelection.verifiedForNextDeploy,false);assert.equal(r.buildSelection.dedicated.expectedEmail,build.BUILD_EMAIL);assert.equal(r.buildSelection.dedicated.identityVerified,true);assert.equal(r.buildSelection.dedicated.operatorActAsVerified,true);assert.equal(r.buildSelection.dedicated.readyForDeploy,false);assert.equal(r.function,null);assert.equal(r.observations.find(x=>x.name==='function').status,'unknown');
 assert(calls.some(x=>x.url.includes(build.BUILD_EMAIL)));for(const {url,options}of calls){assert(!/:setIamPolicy|:enable|:generateAccessToken|:generateServiceIdentity/.test(url));if(options.method==='POST')assert(/:(getIamPolicy|testIamPermissions)(?:\?|$)/.test(url));else assert.equal(options.method,'GET');}
});
test('dedicated identity 403/404 remain unknown; inaccessible bindings do not imply absent account or safe IAM',async()=>{
 const r=await iam.audit({token:'synthetic',fetcher:async(url)=>url.includes('/v3/projects/')?{ok:true,json:async()=>({projectId:build.PROJECT,name:'projects/'+build.NUMBER})}:{ok:false,status:url.includes(build.BUILD_EMAIL)?404:403}});
 assert.equal(r.complete,false);assert.equal(r.buildSelection.dedicated.identityVerified,false);assert.equal(r.buildSelection.dedicated.operatorActAsVerified,null);assert.equal(r.buildSelection.dedicated.readyForDeploy,false);assert.equal(r.observations.find(x=>x.name==='dedicatedBuildAccount').status,'unknown');
});
test('local builder plan is non-executable; --run rejected and all activation remains false',()=>{
 const r=build.plan();assert.equal(r.mode,'PLAN_ONLY');assert.equal(r.firebase.deployAllowed,false);assert.equal(r.firebase.explicitBuildIdentityForwarded,false);assert.equal(r.deploymentAuthorized,false);assert.equal(r.remoteEnabled,false);assert.equal(r.sourceBuckets,null);assert.equal(r.artifactRepository,null);
 const result=spawnSync(process.execPath,['scripts/remote-staging-build-identity.cjs','--run'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,2);assert.match(result.stderr,/Solo plan local/);
});
