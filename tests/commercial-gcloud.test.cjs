'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const g=require('../scripts/remote-staging-gcloud.cjs'),id=require('../scripts/remote-staging-build-identity.cjs'),fixture=require('./helpers/gcloud-closed.cjs');
const temp=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-gcloud-plan-')),'artifact');
test('closed gcloud plan fixes all identities/source/repo/endpoint controls and packages only reviewed files',()=>{
 const p=g.prepare({out:temp(),env:{}});g.verifyPlan(p,{expectedOut:p.artifact});assert.equal(p.sdkVersion,'592.0.0');assert.equal(p.remoteEnabled,false);assert.equal(p.clientEnabled,false);
 for(const arg of [`--build-service-account=${id.BUILD_RESOURCE}`,`--run-service-account=${id.RUNTIME}`,`--docker-repository=${id.REPOSITORY}`,`--stage-bucket=${id.SOURCE_BUCKET}`,'--runtime=nodejs22','--cpu=0.3333','--concurrency=1','--allow-unauthenticated','--quiet'])assert(p.args.includes(arg));
 assert.equal(Object.keys(p.hashes).length,11);assert(!Object.keys(p.hashes).some(x=>/node_modules|laboratory|credential/.test(x)));assert.equal(p.args.includes('--clear-build-service-account'),false);assert(fs.readFileSync(path.join(p.artifact,'.gcloudignore'),'utf8').includes('!.\n'));
 assert.deepEqual(JSON.parse(fs.readFileSync(p.envFile)),g.ENV);
});
test('altered argv/base/identities cannot reuse a prepared release; verification does not repair tampered bytes',()=>{
 const p=g.prepare({out:temp(),env:{}});for(const arg of ['--clear-build-service-account',`--build-service-account=projects/${id.PROJECT}/serviceAccounts/${id.NUMBER}-compute@developer.gserviceaccount.com`,'--project=other']){const changed=structuredClone(p);changed.args.push(arg);assert.throws(()=>g.verifyPlan(changed,{expectedOut:p.artifact}),/Plan alterado/);}
 const file=path.join(p.artifact,'index.cjs');fs.appendFileSync(file,'\n// altered synthetic fixture\n');const altered=fs.readFileSync(file);assert.throws(()=>g.verifyPlan(p,{expectedOut:p.artifact}),/alterado/);assert.deepEqual(fs.readFileSync(file),altered);
});
test('foreign files, symlinks, and activation-file edits are rejected and preserved',()=>{
 const p=g.prepare({out:temp(),env:{}}),foreign=path.join(p.artifact,'private.json');fs.writeFileSync(foreign,'synthetic-preserved');assert.throws(()=>g.prepare({out:p.artifact,env:{}}),/archivo ajeno/);assert.equal(fs.readFileSync(foreign,'utf8'),'synthetic-preserved');
 const q=g.prepare({out:temp(),env:{}});fs.writeFileSync(q.envFile,'{"FULLHOUSE_REMOTE_STAGING_ENABLED":"1"}');assert.throws(()=>g.verifyPlan(q,{expectedOut:q.artifact}),/Variables alteradas/);assert.throws(()=>g.prepare({out:q.artifact,env:{}}),/sin sobrescribir/);
 const r=g.prepare({out:temp(),env:{}}),file=path.join(r.artifact,'index.cjs');fs.renameSync(file,file+'.kept');fs.symlinkSync(file+'.kept',file);assert.throws(()=>g.verifyPlan(r,{expectedOut:r.artifact}),/archivo ajeno/);
});
test('repository permission alone cannot deploy: missing owner consent or exact release hash stops before credentials, audit and gcloud',async()=>{
 let calls=0;const never=()=>{calls++;throw Error('No se debería llamar a gcloud/auditor');};
 await assert.rejects(g.deployClosed({env:{FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY:id.PROJECT},nodeVersion:'22.23.5',execute:never,readAudit:never}),/Falta hash exacto/);
 await assert.rejects(g.deployClosed({env:{FULLHOUSE_APPROVED_GCLOUD_RELEASE:'a'.repeat(64)},nodeVersion:'22.23.5',execute:never,readAudit:never}),/Falta Node 22 o autorización/);
 assert.equal(calls,0);
 const s=require('../remote-staging/settings.json'),c=require('../staging/remote-config.example.json');for(const env of [{GOOGLE_APPLICATION_CREDENTIALS:'/synthetic/not-read'},{GCLOUD_PROJECT:'other'},{CLOUDSDK_API_ENDPOINT_OVERRIDES_STORAGE:'https://other.invalid'},{CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT:'other'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost'},{FULLHOUSE_REMOTE_STAGING_ENABLED:'1'}])assert.throws(()=>g.closed(s,c,env));
 assert.throws(()=>g.closed({...s,remoteEnabled:true},c,{}));assert.throws(()=>g.closed(s,{...c,enabled:true},{}));
});
test('resource preflight separates uploader from builder and never requires an extra run.builder grant by role name',()=>{
 const data=fixture.resources(),r=g.assessResources(data);assert.equal(r.basicInputsVerified,true);assert.equal(r.runBuilderRequiredByThisCheck,false);assert.equal(r.readyForDeploy,false);assert.match(r.internalSources,/UNVERIFIED/);
 for(const mutate of [v=>v.operatorSourcePermissions.permissions=[],v=>v.buildSources.projectNumber='other',v=>v.buildSources.iamConfiguration.publicAccessPrevention='inherited',v=>v.buildSourcesPolicy.bindings=[],v=>v.buildRepository.name='other',v=>v.buildRepositoryPolicy.bindings=[],v=>v.projectPolicy.bindings=[]]){const v=structuredClone(data);mutate(v);assert.equal(g.assessResources(v).basicInputsVerified,false);}
 assert.equal(g.assessResources({}).basicInputsVerified,false);assert.equal(g.assessResources({}).runBuilderPermissions,null);
});
test('first-trial preflight blocks unknown agents, missing upload/actAs, divergent project and an existing function',()=>{
 g.assertAudit(fixture.audit());for(const mutate of [a=>a.project='other',a=>a.gcloudResources.basicInputsVerified=false,a=>a.buildSelection.dedicated.operatorActAsVerified=false,a=>a.buildSelection.dedicated.ownerOrEditorDirectGrant=true,a=>a.managedIdentities.buildAgent.directProjectRoles=[],a=>a.function={name:id.FUNCTION},a=>a.observations[0].http=403,a=>a.deployer.projectPermissions=[]]){const a=fixture.audit();mutate(a);assert.throws(()=>g.assertAudit(a));}
});
test('Functions standard service agent role reported by the owner is accepted exactly',()=>{
 const a=fixture.audit();a.managedIdentities.functions.directProjectRoles=[{role:'roles/cloudfunctions.standardServiceAgent',condition:null}];assert.doesNotThrow(()=>g.assertAudit(a));
});
test('Functions agent without an observed role remains blocked',()=>{
 for(const roles of [undefined,null,[]]){const a=fixture.audit();a.managedIdentities.functions.directProjectRoles=roles;assert.throws(()=>g.assertAudit(a),/Agentes administrados no verificados/);}
 const a=fixture.audit();delete a.managedIdentities.functions;assert.throws(()=>g.assertAudit(a),/Agentes administrados no verificados/);
});
test('legacy, broad, unrelated and lookalike roles cannot replace the current Functions service agent role',()=>{
 for(const role of ['roles/cloudfunctions.serviceAgent','roles/cloudfunctions.admin','roles/owner','roles/editor','roles/viewer','roles/run.serviceAgent','roles/cloudbuild.serviceAgent','roles/cloudfunctions.standardServiceAgentExtra',`projects/${id.PROJECT}/roles/cloudfunctions.standardServiceAgent`]){const a=fixture.audit();a.managedIdentities.functions.directProjectRoles=[{role}];assert.throws(()=>g.assertAudit(a),/Agentes administrados no verificados/,role);}
});
test('standard role must be unconditional and attached to the Functions agent; Build and Run checks stay mandatory',()=>{
 const current=()=>{const a=fixture.audit();a.managedIdentities.functions.directProjectRoles=[{role:'roles/cloudfunctions.standardServiceAgent'}];return a;};
 const conditional=current();conditional.managedIdentities.functions.directProjectRoles[0].condition='true';assert.throws(()=>g.assertAudit(conditional),/Agentes administrados no verificados/);
 const misplaced=current();misplaced.managedIdentities.functions.directProjectRoles=[];misplaced.managedIdentities.buildAgent.directProjectRoles.push({role:'roles/cloudfunctions.standardServiceAgent'});assert.throws(()=>g.assertAudit(misplaced),/Agentes administrados no verificados/);
 for(const kind of ['buildAgent','run']){const a=current();a.managedIdentities[kind].directProjectRoles=[];assert.throws(()=>g.assertAudit(a),/Agentes administrados no verificados/);}
});
test('readback verifies both function and actual Build identity, capacity, closed variables, release and public callable policy',()=>{
 const p=g.prepare({out:temp(),env:{}});assert.equal(g.verifyReadback(fixture.readback(p)).mode,'CLOSED_RELEASE_METADATA_VERIFIED');
 for(const mutate of [v=>delete v.build.serviceAccount,v=>v.build.serviceAccount=`projects/${id.PROJECT}/serviceAccounts/${id.NUMBER}-compute@developer.gserviceaccount.com`,v=>v.fn.buildConfig.dockerRepository='other',v=>v.fn.serviceConfig.serviceAccountEmail=id.BUILD_EMAIL,v=>v.fn.serviceConfig.availableCpu='1',v=>v.fn.serviceConfig.environmentVariables.FULLHOUSE_REMOTE_STAGING_ENABLED='1',v=>v.fn.labels['fullhouse-release']='other',v=>v.build.status='FAILURE',v=>v.invoker.bindings=[],v=>v.build.results.images[0].name='other',v=>v.build.results.images[0].digest='invalid',v=>v.build.sourceProvenance.resolvedStorageSource.generation='0']){const v=fixture.readback(p);mutate(v);assert.throws(()=>g.verifyReadback(v));}
});
test('authorized simulation sends only fixed dedicated gcloud command then verifies actual-job/read-policy responses',async()=>{
 const {module:m}=fixture.isolatedAuthorizedModule(),calls=[],env={FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY:id.PROJECT};let response;
 env.FULLHOUSE_APPROVED_GCLOUD_RELEASE=m.prepare({env}).releaseHash;
 const result=await m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute:args=>{calls.push(args);if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return '{}';if(args[0]==='functions'){response=fixture.readback(m.prepare({env}));return JSON.stringify(response.fn);}if(args[0]==='builds')return JSON.stringify(response.build);return JSON.stringify(response.invoker);}});
 assert.equal(result.mode,'CLOSED_RELEASE_METADATA_VERIFIED');assert.equal(calls.length,5);assert(calls[2].includes(`--build-service-account=${id.BUILD_RESOURCE}`));assert(calls[2].includes(`--billing-project=${id.PROJECT}`));assert(!JSON.stringify(calls).includes('compute@developer'));assert.equal(require('../remote-staging/settings.json').deploymentAuthorized,true);
});
test('simulation stops before upload on failed preflight/version; acknowledgement/readback failure is uncertain and never retried',async()=>{
 const {module:m}=fixture.isolatedAuthorizedModule(),env={FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY:id.PROJECT};let mutations=0;
 env.FULLHOUSE_APPROVED_GCLOUD_RELEASE=m.prepare({env}).releaseHash;
 const execute=args=>{if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return '{}';mutations++;throw Error('synthetic lost response');};
 const bad=fixture.audit();bad.gcloudResources.basicInputsVerified=false;await assert.rejects(m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>bad,execute}),/Preflight/);assert.equal(mutations,0);
 await assert.rejects(m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute:()=>JSON.stringify({'Google Cloud SDK':'other'})}),/Versión/);assert.equal(mutations,0);
 await assert.rejects(m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute:args=>args[0]==='version'?JSON.stringify({'Google Cloud SDK':'592.0.0'}):JSON.stringify({api_endpoint_overrides:{storage:'https://synthetic.invalid'}})}),/Configuración CLI/);assert.equal(mutations,0);
 await assert.rejects(m.deployClosed({env:{...env,FULLHOUSE_APPROVED_GCLOUD_RELEASE:'a'.repeat(64)},nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute}),/Release distinta/);assert.equal(mutations,0);
 await assert.rejects(m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute}),/podrían existir/);assert.equal(mutations,1);
 let calls=0;await assert.rejects(m.deployClosed({env,nodeVersion:'22.23.5',readAudit:async()=>fixture.audit(),execute:args=>{if(args[0]==='version')return JSON.stringify({'Google Cloud SDK':'592.0.0'});if(args[0]==='config')return '{}';calls++;if(args[0]==='functions')return JSON.stringify(fixture.readback(m.prepare({env})).fn);throw Error('synthetic readback failure');}}),/podrían existir/);assert.equal(calls,2);
});
