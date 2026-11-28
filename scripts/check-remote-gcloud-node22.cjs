'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
assert.equal(process.versions.node.split('.')[0],'22','Ejecuta esta comprobación con Node 22.');
const startup=spawnSync(process.execPath,['--test',path.resolve(__dirname,'../tests/runtime/staging-startup.test.cjs')],{env:{PATH:process.env.PATH},stdio:'inherit'});
if(startup.error)throw startup.error;if(startup.status!==0){process.exitCode=startup.status??1;return;}
// Do not inject GCLOUD_PROJECT: exercise exactly the closed release environment.
const gcloud=require('./remote-staging-gcloud.cjs'),plan=gcloud.prepare({env:{}}),env={...gcloud.ENV,NODE_PATH:path.resolve(__dirname,'../remote/node_modules')};
const r=spawnSync(process.execPath,[path.resolve(__dirname,'../tests/diagnostics/gcloud-artifact.cjs'),plan.artifact],{env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
