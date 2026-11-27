'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
assert.equal(process.versions.node.split('.')[0],'22','Ejecuta esta comprobación con Node 22.');
const gcloud=require('./remote-staging-gcloud.cjs'),plan=gcloud.prepare({env:{}}),env={...process.env,...gcloud.ENV,GCLOUD_PROJECT:'fullhouse-staging',NODE_PATH:path.resolve(__dirname,'../remote/node_modules')};
for(const key of Object.keys(env))if(/EMULATOR/.test(key)||key.startsWith('FIREBASE_DEBUG')||['GOOGLE_CLOUD_PROJECT','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','NODE_OPTIONS'].includes(key))delete env[key];
const r=spawnSync(process.execPath,[path.resolve(__dirname,'../tests/diagnostics/gcloud-artifact.cjs'),plan.artifact],{env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
