'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {buildRemoteLab}=require('./build-remote-lab.cjs');
(async()=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-fullhouse-remote');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');
 const backendRequire=require('node:module').createRequire(path.resolve(__dirname,'../remote/package.json'));
 const {initializeApp,deleteApp}=backendRequire('firebase-admin/app'),{getAuth}=backendRequire('firebase-admin/auth');
 const admin=initializeApp({projectId:'demo-fullhouse-remote'},'remote-planner-lab'),auth=getAuth(admin);
 for(const uid of ['lab_A','lab_B']){try{await auth.createUser({uid,email:uid+'@example.test',password:'Synthetic-Password-2030!',emailVerified:true});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;}}
 const simulated=process.argv.includes('--simulated-data'),servers=[];
 if(simulated){
  const {createService}=require('../remote/service.cjs'),{memoryPorts}=require('../tests/helpers/remote.cjs'),service=createService(memoryPorts());
  console.log('DATA BACKEND IS SIMULATED; ONLY AUTH USES A REAL EMULATOR. NO FIRESTORE/STORAGE VALIDATION.');
  const api=http.createServer(async(req,res)=>{
   res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5012');res.setHeader('Access-Control-Allow-Headers','authorization,content-type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('content-type','application/json');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   try{
    assert.equal(req.method,'POST');const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const decoded=await auth.verifyIdToken(token);
    const names={saveRemoteV1:'save',readRemoteV1:'read',restoreRemoteV1:'restore',inspectRemoteV1:'inspect'},name=req.url.split('/').pop();if(!Object.hasOwn(names,name))throw Error('Invalid endpoint');
    let raw='';for await(const part of req){raw+=part.toString();if(Buffer.byteLength(raw)>10*1024*1024)throw Error('Request too large');}
    const result=await service[names[name]]({uid:decoded.uid,token:decoded},JSON.parse(raw).data);res.end(JSON.stringify({result}));
   }catch(e){res.statusCode=400;res.end(JSON.stringify({error:{status:String(e.code||'unavailable').toUpperCase().replaceAll('-','_'),message:'Operación no confirmada en backend simulado'}}));}
  });await new Promise(resolve=>api.listen(5002,'127.0.0.1',resolve));servers.push(api);
 }
 const root=await buildRemoteLab(),mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
 const web=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('cache-control','no-store');fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>web.listen(5012,'127.0.0.1',resolve));servers.push(web);console.log('Laboratorio privado: http://127.0.0.1:5012 · lab_A@example.test / lab_B@example.test · contraseña sintética: Synthetic-Password-2030!');
 if(process.argv.includes('--serve')){console.log('Solo datos sintéticos. Ctrl+C para cerrar.');return;}
 try{
  const files=process.argv.includes('--browser')?['tests/browser/remote-planner.cjs']:['--test','--test-concurrency=1','tests/remote/planner.cjs'];
  const child=spawn(process.execPath,files,{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,FULLHOUSE_REMOTE_DATA_MODE:simulated?'simulated':'emulators'}});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});process.exitCode=code??1;
 }finally{for(const s of servers)await new Promise(resolve=>s.close(resolve));await deleteApp(admin);}
})().catch(e=>{console.error(e);process.exitCode=1;});
