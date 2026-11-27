'use strict';
// Actual copied callable over loopback. Only JWT verifiers are synthetic ports.
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),{createRequire}=require('node:module');
const remoteRequire=createRequire(path.resolve(__dirname,'../../remote/package.json'));
const app=remoteRequire('firebase-admin/app').initializeApp({projectId:'fullhouse-staging',credential:{getAccessToken:async()=>{throw Error('Credential access forbidden in local proof.');}}});
remoteRequire('firebase-admin/auth').getAuth(app).verifyIdToken=async token=>{if(token!=='synthetic-auth')throw Error('synthetic invalid auth');return {uid:'synthetic-only',email_verified:true};};
remoteRequire('firebase-admin/app-check').getAppCheck(app).verifyToken=async token=>{if(token!=='synthetic-app')throw Error('synthetic invalid App Check');return {appId:'1:664973716762:web:c8407ddc2d0dc3ef8090a3',token:{}};};
const fn=require(path.join(process.argv[2],'index.cjs')).remoteV1,express=remoteRequire('express'),serverApp=express();serverApp.use(express.json());serverApp.post('/',fn);serverApp.options('/',fn);
(async()=>{
 assert.equal(process.versions.node.split('.')[0],'22');assert.equal(fn.__endpoint.serviceAccountEmail,'fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com');assert.equal(fn.__endpoint.cpu,'gcf_gen1');assert.equal(fn.__endpoint.availableMemoryMb,512);assert.equal(fn.__endpoint.maxInstances,1);assert.equal(fn.__endpoint.minInstances,0);assert.equal(fn.__endpoint.concurrency,1);assert.equal(fn.__endpoint.timeoutSeconds,60);
 const server=http.createServer(serverApp);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 try{
  const post=async(auth,appcheck)=>{const headers={'content-type':'application/json'};if(auth)headers.authorization='Bearer '+auth;if(appcheck)headers['x-firebase-appcheck']=appcheck;return fetch(url,{method:'POST',headers,body:JSON.stringify({data:{method:'read',input:{revisionId:null}}})});};
  assert.equal((await post()).status,401);assert.equal((await post('synthetic-auth')).status,401);assert.equal((await post('synthetic-auth','invalid-app')).status,401);assert.equal((await post('invalid-auth','synthetic-app')).status,401);
  const closed=await post('synthetic-auth','synthetic-app');assert.equal(closed.status,503);assert.equal((await closed.json()).error.status,'UNAVAILABLE');
  for(const origin of ['https://fullhouse-staging.web.app','https://fullhouse-staging.firebaseapp.com','https://other.invalid']){const r=await fetch(url,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}});assert.equal(r.headers.get('access-control-allow-origin'),origin.endsWith('other.invalid')?null:origin);}
  assert(!Object.keys(require.cache).some(p=>/firebase-admin[\\/]lib[\\/](firestore|storage)[\\/]/.test(p)));
  console.log('PASS copied gcloud artifact Node22: capacity, App Check required, invalid Auth rejected, CORS preserved, backend UNAVAILABLE; no data clients. JWT ports synthetic, loopback only.');
 }finally{await new Promise(resolve=>server.close(resolve));await remoteRequire('firebase-admin/app').deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
