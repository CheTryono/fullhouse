'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const sdk=process.env.FULLHOUSE_GCLOUD_SDK_ROOT;if(!sdk)throw Error('Falta SDK oficial 592.0.0: no se declara la prueba aprobada.');
const g=require('./remote-staging-gcloud.cjs'),{snapshot}=require('../tests/helpers/recovery.cjs'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-recovery-sdk-')),plan=g.prepare({env:{}});g.verifyPlan(plan);
const planFile=path.join(tmp,'plan.json'),snapshotFile=path.join(tmp,'synthetic.json');fs.writeFileSync(planFile,JSON.stringify(plan));fs.writeFileSync(snapshotFile,JSON.stringify(snapshot()));
const env={CLOUDSDK_CONFIG:path.join(tmp,'empty-config'),PATH:process.env.PATH,CLOUDSDK_CORE_DISABLE_USAGE_REPORTING:'1',CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK:'1',CLOUDSDK_CORE_DISABLE_PROMPTS:'1'};
const output=execFileSync('python3',[path.resolve(__dirname,'../tests/diagnostics/gcloud-592-recovery.py'),sdk,planFile,snapshotFile],{env,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024}),result=JSON.parse(output);
assert.equal(result.networkAttempts,0);assert.equal(result.patches,1);assert.equal(result.request.name,require('./remote-staging-build-identity.cjs').FUNCTION);console.log(JSON.stringify({...result,verified:true,limitations:'No real API acceptance, missing-Run repair or effective IAM proven; requires an authorized closed trial.'},null,2));
