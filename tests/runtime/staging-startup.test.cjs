'use strict';
// Real Functions Framework process, copied release and Node22. Loopback only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
assert.equal(process.versions.node.split('.')[0],'22','Run the startup suite with Node 22, not the web toolchain runtime.');
const g=require('../../scripts/remote-staging-gcloud.cjs'),settings=require('../../remote-staging/settings.json');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-startup-')),plan=g.prepare({out:path.join(temp,'artifact'),env:{}});
g.verifyPlan(plan,{expectedOut:plan.artifact});
const framework=path.join(path.dirname(require.resolve('@google-cloud/functions-framework')),'main.js'),guard=path.join(temp,'no-cloud.cjs');
// This process only accepts inbound loopback test requests. Never use ADC or data clients.
fs.writeFileSync(guard,`const net=require('node:net'),dns=require('node:dns'),Module=require('node:module');
net.Socket.prototype.connect=()=>{throw Error('Outbound networking forbidden in startup proof');};
dns.lookup=()=>{throw Error('DNS forbidden in startup proof');};
const load=Module._load;Module._load=function(id,...args){if(['firebase-admin/firestore','firebase-admin/storage'].includes(id))throw Error('Data client initialization forbidden in closed startup proof');return load.call(this,id,...args);};
`);
async function launch(patch={}){
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['--require',guard,framework,`--source=${plan.artifact}`,'--target=remoteV1','--signature-type=http',`--port=${port}`],{env:{...g.ENV,NODE_PATH:path.resolve(__dirname,'../../remote/node_modules'),...patch},stdio:['ignore','pipe','pipe']});
 let output='',ready;const serving=new Promise(resolve=>{ready=resolve;});
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{output+=bytes.toString();if(output.includes('Serving function...'))ready({serving:true});});
 const exited=new Promise(resolve=>{child.once('error',error=>resolve({error}));child.once('close',(code,signal)=>resolve({code,signal}));});
 return {url:`http://127.0.0.1:${port}`,get output(){return output;},async state(){let timer;try{return await Promise.race([serving,exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Startup timed out: '+output)),8000);})]);}finally{clearTimeout(timer);}},async stop(){if(child.exitCode===null&&child.signalCode===null)child.kill();await exited;}};
}
async function starts(t,patch){
 const app=await launch(patch);t.after(()=>app.stop());const state=await app.state();assert.equal(state.serving,true,app.output);
 const response=await fetch(app.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:{method:'read',input:{revisionId:null}}}),signal:AbortSignal.timeout(3000)});
 assert.equal(response.status,401);assert.equal((await response.json()).error.status,'UNAUTHENTICATED');
 const cors=await fetch(app.url,{method:'OPTIONS',headers:{origin:settings.origins[0],'access-control-request-method':'POST'},signal:AbortSignal.timeout(3000)});assert.equal(cors.headers.get('access-control-allow-origin'),settings.origins[0]);
}
async function refuses(t,patch,message){
 const app=await launch(patch);t.after(()=>app.stop());const state=await app.state();assert.equal(state.serving,undefined,app.output);assert.equal(state.code,1,app.output);assert.match(app.output,message);
}
test('Functions Framework boots the actual closed gcloud environment without GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT',async t=>{
 assert.equal(settings.remoteEnabled,false);assert.equal(g.ENV.FULLHOUSE_REMOTE_STAGING_ENABLED,'0');assert.equal(g.ENV.FULLHOUSE_STAGING_TEST_UIDS,'');await starts(t,{});
});
test('Functions Framework also accepts consistent legacy project aliases',async t=>starts(t,{GCLOUD_PROJECT:settings.projectId,GOOGLE_CLOUD_PROJECT:settings.projectId}));
for(const [name,patch]of Object.entries({wrongGcloud:{GCLOUD_PROJECT:'other'},emptyGcloud:{GCLOUD_PROJECT:''},wrongGoogleCloud:{GOOGLE_CLOUD_PROJECT:'other'},wrongConfig:{FIREBASE_CONFIG:JSON.stringify({projectId:'other'})},wrongBucket:{FIREBASE_CONFIG:JSON.stringify({projectId:settings.projectId,storageBucket:'other'})},malformedConfig:{FIREBASE_CONFIG:'{'},missingIdentity:{FIREBASE_CONFIG:undefined}}))test('Functions Framework refuses '+name,async t=>{
 // spawn omits undefined entries; no implicit inherited environment supplies identity.
 await refuses(t,patch,/Identidad de proyecto|Configuración Firebase/);
});
for(const key of ['FUNCTIONS_EMULATOR','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','STORAGE_EMULATOR_HOST','FIREBASE_DEBUG_MODE','FIREBASE_DEBUG_FEATURES'])test('Functions Framework refuses '+key+' even with a valid project config',async t=>refuses(t,{[key]:'true'},/emulación|depuración/));
