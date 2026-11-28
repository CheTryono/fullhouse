'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/build-remote-staging.cjs'),path=require('node:path');
const {runtimeCheck}=require(path.join(build(),'policy.cjs')),settings=require('../remote-staging/settings.json');
const {ENV}=require('../scripts/remote-staging-gcloud.cjs');
const check=env=>runtimeCheck(env,settings,'22.23.5');
test('actual gcloud environment starts without an injected GCLOUD_PROJECT',()=>{
 assert.equal(Object.hasOwn(ENV,'GCLOUD_PROJECT'),false);
 assert.equal(Object.hasOwn(ENV,'GOOGLE_CLOUD_PROJECT'),false);
 assert.doesNotThrow(()=>check({...ENV}));
});
test('explicit inline Firebase identity and optional legacy project aliases must all agree',()=>{
 for(const env of [{GCLOUD_PROJECT:settings.projectId},{GOOGLE_CLOUD_PROJECT:settings.projectId},{FIREBASE_CONFIG:JSON.stringify({projectId:settings.projectId})},{...ENV,GCLOUD_PROJECT:settings.projectId,GOOGLE_CLOUD_PROJECT:settings.projectId}])assert.doesNotThrow(()=>check(env));
 for(const name of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT'])for(const value of ['other','demo-fullhouse-remote','',settings.projectId+' '])assert.throws(()=>check({...ENV,[name]:value}),/proyecto/i);
});
test('missing, malformed, file-based and contradictory Firebase configuration fail closed',()=>{
 assert.throws(()=>check({}),/proyecto/i);
 for(const value of ['',null,'/not-read/config.json','{','null','[]','42','"fullhouse-staging"','{}',JSON.stringify({projectId:'other'}),JSON.stringify({projectId:settings.projectId,storageBucket:'other'}),JSON.stringify({projectId:settings.projectId,storageBucket:null})])assert.throws(()=>check({GCLOUD_PROJECT:settings.projectId,FIREBASE_CONFIG:value}),/configuración|proyecto/i);
});
test('valid project identity cannot bypass emulation, unsafe Firebase debugging or the Node22 requirement',()=>{
 for(const key of ['FUNCTIONS_EMULATOR','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','STORAGE_EMULATOR_HOST','FIREBASE_DEBUG_MODE','FIREBASE_DEBUG_FEATURES'])assert.throws(()=>check({...ENV,[key]:'true'}),/emulación|depuración/i);
 assert.throws(()=>runtimeCheck(ENV,settings,'24.22.1'),/Node 22/);
});
