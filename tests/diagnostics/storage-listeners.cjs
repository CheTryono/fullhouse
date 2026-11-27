'use strict';
// Loopback only, synthetic data/token. No Firebase resource, credentials or SDK limits.
const http=require('node:http'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const remoteRequire=createRequire(path.resolve(__dirname,'../../remote/package.json'));
const {Storage,CRC32C}=remoteRequire('@google-cloud/storage'),{GoogleAuth,OAuth2Client}=remoteRequire('google-auth-library');
async function diagnose({rounds=20,delayBodyMs=10}={}){
 if(process.env.STORAGE_EMULATOR_HOST)throw Error('Remove STORAGE_EMULATOR_HOST: this diagnostic only uses its own loopback server.');
 if(!Number.isInteger(rounds)||rounds<1||rounds>30||![0,10].includes(delayBodyMs))throw Error('Bounded loopback diagnostic only.');
 const payload=Buffer.from('synthetic-loopback-image-bytes'),crc=new CRC32C();crc.update(payload);const crcValue=crc.toString();
 const warnings=[],seen=new WeakSet(),refs=[];let calls=0;
 const limitBefore=require('node:events').defaultMaxListeners,listenersBefore=process.listenerCount('warning');
 const onWarning=w=>{if(w.name==='MaxListenersExceededWarning'){
  if(w.emitter&&!seen.has(w.emitter)){seen.add(w.emitter);refs.push(new WeakRef(w.emitter));}
  warnings.push({event:w.type,count:w.count,emitter:w.emitter?.constructor.name,origin:w.stack?.match(/teeny-request\/build\/src\/index\.js:\d+:\d+/)?.[0]||'unidentified'});
 }};process.on('warning',onWarning);
 const server=http.createServer((request,response)=>{
  calls++;const url=new URL(request.url,'http://127.0.0.1');request.resume();request.on('end',()=>{
   if(url.searchParams.get('alt')==='media'){
    response.writeHead(200,{'content-type':'application/octet-stream','x-goog-stored-content-encoding':'identity','x-goog-hash':'crc32c='+crcValue});
    if(delayBodyMs){response.flushHeaders();setTimeout(()=>response.end(payload),delayBodyMs);}else response.end(payload);
   }else{const name=url.searchParams.get('name')||decodeURIComponent(url.pathname.split('/o/')[1]||'test');response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({name,bucket:'fullhouse-loopback-only',size:String(payload.length),crc32c:crcValue}));}
  });
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const oauth=new OAuth2Client({eagerRefreshThresholdMillis:30000});oauth.setCredentials({access_token:'synthetic-loopback-only',expiry_date:Date.now()+900000});
  const auth=new GoogleAuth({projectId:'demo-fullhouse-listeners',authClient:oauth});
  const storage=new Storage({projectId:'demo-fullhouse-listeners',authClient:auth,apiEndpoint:'http://127.0.0.1:'+server.address().port,useAuthWithCustomEndpoint:true}),bucket=storage.bucket('fullhouse-loopback-only');
  for(let i=0;i<rounds;i++){const file=bucket.file('test-'+i);await file.save(payload,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0}});await file.getMetadata();assert.deepEqual((await file.download())[0],payload);}
  await new Promise(resolve=>setImmediate(resolve));
  const observed=refs.map(ref=>{const e=ref.deref();return e?{closed:e.closed,destroyed:e.destroyed,errorListeners:e.listenerCount('error'),closeListeners:e.listenerCount('close')}:null;});
  for(let i=0;i<4;i++){await new Promise(resolve=>setImmediate(resolve));global.gc?.();}
  const packageFile=path.resolve(path.dirname(remoteRequire.resolve('@google-cloud/storage')),'../../..','package.json');
  return {node:process.version,storageSdk:JSON.parse(fs.readFileSync(packageFile,'utf8')).version,scope:'loopback only; no Firebase calls',rounds,delayBodyMs,calls,dataAndCRCVerified:true,warnings:warnings.length,warningStreams:refs.length,warningKinds:[...new Set(warnings.map(w=>w.event))].sort(),maxWarningCount:Math.max(0,...warnings.map(w=>w.count)),firstWarning:warnings[0]||null,openObservedStreams:observed.filter(e=>e&&!e.closed).length,maxListenersOnCompletedStream:Math.max(0,...observed.flatMap(e=>e?[e.errorListeners,e.closeListeners]:[])),gcExposed:typeof global.gc==='function',collectedWarningStreams:global.gc?refs.filter(ref=>!ref.deref()).length:null,listenerLimitBefore:limitBefore,listenerLimitAfter:require('node:events').defaultMaxListeners,processWarningListenersBefore:listenersBefore};
 }finally{process.off('warning',onWarning);await new Promise(resolve=>server.close(resolve));assert.equal(process.listenerCount('warning'),listenersBefore);}
}
module.exports={diagnose};if(require.main===module)diagnose().then(r=>console.log(JSON.stringify(r,null,2)),e=>{console.error(e.message);process.exitCode=1;});
