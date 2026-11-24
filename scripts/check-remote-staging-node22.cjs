'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
assert.equal(process.versions.node.split('.')[0],'22','Ejecuta esta comprobación con Node 22.');
require('./build-remote-staging.cjs').build();
const env={...process.env,GCLOUD_PROJECT:'fullhouse-staging',NODE_PATH:path.resolve(__dirname,'../remote/node_modules')};
for(const k of Object.keys(env))if(/EMULATOR/.test(k)||['GOOGLE_CLOUD_PROJECT','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','FIREBASE_CONFIG','FULLHOUSE_REMOTE_STAGING_ENABLED'].includes(k))delete env[k];
const source=`
 const assert=require('node:assert/strict'),http=require('node:http'),express=require('express'),fn=require('./dist-remote-staging/index.cjs').remoteV1;
 (async()=>{
  assert.equal(fn.__endpoint.platform,'gcfv2');assert.equal(fn.__endpoint.maxInstances,1);assert.equal(fn.__endpoint.minInstances,0);assert.equal(fn.__endpoint.concurrency,1);
  await assert.rejects(fn.run({}),{code:'unavailable'});
  const app=express();app.use(express.json());app.post('/',fn);const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:{method:'read',input:{revisionId:null}}})});assert.equal(response.status,401);assert.equal((await response.json()).error.status,'UNAUTHENTICATED');}
  finally{await new Promise(r=>server.close(r));}
  console.log('PASS Node '+process.versions.node+': SDK gcfv2, backend desactivado y App Check ausente rechazado; solo HTTP loopback.');
 })().catch(e=>{console.error(e);process.exitCode=1;});`;
const result=spawnSync(process.execPath,['-e',source],{cwd:path.resolve(__dirname,'..'),env,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
