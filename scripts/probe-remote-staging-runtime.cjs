'use strict';
// Prepared for a separately authorized synthetic IAM test. Never part of Hosting/Functions.
const {createRequire}=require('node:module'),path=require('node:path'),assert=require('node:assert/strict');
const {PROJECT,BUCKET,RUNTIME,localToken}=require('./audit-remote-staging-iam.cjs');
const {createService}=require('../remote/service.cjs');
const settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');
const remoteRequire=createRequire(path.resolve(__dirname,'../remote/package.json'));
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function closed(s=settings,c=client,env=process.env){
 if(s.projectId!==PROJECT||s.bucket!==BUCKET||s.region!=='us-central1'||s.database!=='(default)'||s.serviceAccount!==RUNTIME||s.remoteEnabled!==false||c.projectId!==PROJECT||c.enabled!==false)throw Error('El ensayo exige staging cerrado.');
 if(Object.keys(env).some(k=>(/EMULATOR/.test(k)||k.startsWith('FIREBASE_DEBUG'))&&env[k])||env.GOOGLE_APPLICATION_CREDENTIALS||env.FULLHOUSE_REMOTE_STAGING_ENABLED==='1'||env.FULLHOUSE_STAGING_TEST_UIDS||[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT].some(v=>v&&v!==PROJECT))throw Error('Entorno cruzado, activo o credenciales de archivo: prueba bloqueada.');
}
function identities(runId){if(!UUID.test(runId))throw Error('Proporciona un UUID v4 nuevo y conserva ese ID para reintentar.');return {runId,uid:'iam_probe_'+runId.replaceAll('-',''),first:'iam_probe_'+runId+'_a',second:'iam_probe_'+runId+'_b',stale:'iam_probe_'+runId+'_stale'};}
function plan(runId){const id=runId?identities(runId):null;return {mode:'PLAN_ONLY',project:PROJECT,bucket:BUCKET,runtime:RUNTIME,run:id,
 requires:'Separate owner authorization: FULLHOUSE_AUTHORIZE_IAM_PROBE=fullhouse-staging and --run --run-id UUID. This does not authorize deploy or users.',
 credentials:'Short-lived runtime token via IAMCredentials, 900 seconds, in RAM only; no JSON key or ADC fallback.',
 writes:['Synthetic v1 revisions, receipts, head, private 1x1 PNG, disabled stagingAccess for iam_probe_UID and scratch media metadata.','Negative create outside users/: if IAM is too broad, one tiny synthetic object may be created; report failure and retain for explicit owner cleanup.'],
 leaves:'No deletion. Preserve run ID and inspect receipts after uncertain results. No real Auth account, enabled control, entitlement, local data or personal information is created.'};}
async function mint({operatorToken,fetcher=fetch}){
 const url=`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${RUNTIME}:generateAccessToken`;
 let r;try{r=await fetcher(url,{method:'POST',headers:{authorization:'Bearer '+operatorToken,'content-type':'application/json'},body:JSON.stringify({scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'900s'}),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('No se pudo solicitar el token temporal; no se cambia IAM ni se habilitan APIs.');}
 if(!r.ok)throw Object.assign(Error('Impersonación no autorizada/disponible, HTTP '+r.status+'. Revisar getAccessToken sobre la identidad runtime; no se amplían permisos automáticamente.'),{code:'IAM_TOKEN_'+r.status});
 const x=await r.json(),expires=Date.parse(x.expireTime);if(typeof x.accessToken!=='string'||!x.accessToken||/[\r\n]/.test(x.accessToken)||!Number.isFinite(expires)||expires<Date.now()+60000||expires>Date.now()+960000)throw Error('Token temporal incompatible.');return {token:x.accessToken,expires};
}
function clients({token,expires}){
 const {GoogleAuth,OAuth2Client}=remoteRequire('google-auth-library'),{Firestore,Timestamp}=remoteRequire('@google-cloud/firestore'),{Storage}=remoteRequire('@google-cloud/storage');
 const oauth=new OAuth2Client({eagerRefreshThresholdMillis:30000});oauth.setCredentials({access_token:token,expiry_date:expires});
 const auth=new GoogleAuth({projectId:PROJECT,authClient:oauth});
 const db=new Firestore({projectId:PROJECT,databaseId:'(default)',auth}),storage=new Storage({projectId:PROJECT,authClient:auth});
 return {db,bucket:storage.bucket(BUCKET),now:()=>Timestamp.now(),auth,close:()=>db.terminate()};
}
async function effectiveProbe(ports,runId,progress=()=>{}){
 const id=identities(runId),{db,bucket}=ports,actor={uid:id.uid,token:{email_verified:true}},service=createService(ports);
 const image={id:'iam-probe-image',kind:'image',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGVEAAAAASUVORK5CYII=',caption:'Synthetic IAM test',createdAt:'2026-01-01T00:00:00Z'};
 const data={version:1,goals:[],routines:[],events:[],logs:{['iam-probe@2026-01-01']:{completed:false,checkedSteps:[],note:'Synthetic',evidences:[image]}}},raw=JSON.stringify(data);
 // No personal/control values are printed or changed. These paths require get.
 progress('read-controls');for(const key of ['stagingControl/remoteV1','stagingAccess/'+id.uid,'billingEntitlements/'+id.uid,`users/${id.uid}/mediaUsage/head`])await db.doc(key).get();
 const current=await service.read(actor,{revisionId:null});if(current&&!([id.first,id.second].includes(current.revisionId)))throw Error('La identidad de ensayo ya contiene otra base. No se sobrescribe.');
 const access=db.doc('stagingAccess/'+id.uid),scratch=db.doc(`users/${id.uid}/mediaUsage/iam-probe`);
 progress('scratch-transaction');await db.runTransaction(async tx=>{const [a,s]=await tx.getAll(access,scratch);if(a.exists&&(a.data().enabled!==false||a.data().iamProbeRunId!==runId)||s.exists&&s.data().iamProbeRunId!==runId)throw Error('Datos de prueba no reconocidos.');if(!a.exists)tx.create(access,{enabled:false,iamProbeRunId:runId});if(!s.exists)tx.create(scratch,{iamProbeRunId:runId,state:'prepared'});});
 progress('first-revision-photo');const first=await service.save(actor,{operationId:id.first,baseRevision:null,backup:raw});
 const secondRaw=JSON.stringify({...data,logs:{...data.logs,'iam-probe@2026-01-01':{...data.logs['iam-probe@2026-01-01'],note:'Synthetic text update'}}});
 progress('second-revision-retry-confirm');const command={operationId:id.second,baseRevision:id.first,backup:secondRaw},second=await service.save(actor,command);
 assert.deepEqual(await service.save(actor,command),second);assert.deepEqual(await service.inspect(actor,{operationId:id.first}),first);assert.equal((await service.read(actor,{revisionId:id.first})).backup,raw);assert.equal((await service.read(actor,{revisionId:null})).backup,secondRaw);
 await assert.rejects(service.save(actor,{operationId:id.stale,baseRevision:id.first,backup:raw}),{code:'failed-precondition'});assert.equal(await service.inspect(actor,{operationId:id.stale}),null);
 progress('rollback');await assert.rejects(db.runTransaction(async tx=>{await tx.get(scratch);tx.set(scratch,{iamProbeRunId:runId,state:'must-not-commit'});throw Object.assign(Error('Synthetic rollback'),{code:'IAM_PROBE_ROLLBACK'});}),{code:'IAM_PROBE_ROLLBACK'});
 assert.equal((await scratch.get()).data().state,'prepared');
 // These negative calls only target the explicit synthetic run; 404 is NOT denial.
 const outside='iam-probe-outside/'+runId+'.txt';
 progress('outside-create-denial');await assert.rejects(bucket.file(outside).save(Buffer.from('Synthetic IAM probe'),{resumable:false,preconditionOpts:{ifGenerationMatch:0}}),e=>Number(e.code)===403,'outside create must be denied; if it succeeded, preserve the tiny object for owner cleanup');
 progress('outside-read-denial');await assert.rejects(bucket.file(outside).getMetadata(),e=>Number(e.code)===403,'outside get: only 403 demonstrates denial; 404 is inconclusive');
 progress('list-denial');await assert.rejects(bucket.getFiles({prefix:'users/'+id.uid+'/',maxResults:1,autoPaginate:false,fields:'kind'}),e=>Number(e.code)===403,'runtime must not list bucket objects');
 return {project:PROJECT,runtime:RUNTIME,run:id,status:'SYNTHETIC_IAM_PROBE_PASSED',receipt:second,keptForExplicitCleanup:{firestore:[`users/${id.uid}/storage/head`,`users/${id.uid}/operations/${id.first}`,`users/${id.uid}/operations/${id.second}`,`users/${id.uid}/revisions/${id.first}`,`users/${id.uid}/revisions/${id.second}`,`users/${id.uid}/mediaUsage/iam-probe`,'stagingAccess/'+id.uid],storagePrefix:'users/'+id.uid+'/'},notTested:['Auth/App Check enforcement','Premium entitlement flow','IAM inherited grants for other resources','Costs/quotas under load']};
}
async function main(args){
 if(!args.length||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify(plan(),null,2));return;}
 if(args.length!==3||args[0]!=='--run'||args[1]!=='--run-id')throw Error('Uso: --plan o --run --run-id UUID-v4.');
 identities(args[2]);if(process.env.FULLHOUSE_AUTHORIZE_IAM_PROBE!==PROJECT)throw Error('Prueba real bloqueada: falta autorización separada del propietario.');
 if(process.versions.node.split('.')[0]!=='22')throw Error('La prueba real requiere Node 22.');closed();
 console.log(JSON.stringify({...plan(args[2]),mode:'AUTHORIZED_SYNTHETIC_WRITE_PROBE',status:'STARTING_SYNTHETIC_PROBE'}));let ports,phase='mint-runtime-token';
 try{ports=clients(await mint({operatorToken:localToken()}));console.log(JSON.stringify(await effectiveProbe(ports,args[2],step=>{phase=step;console.log(JSON.stringify({phase}));}),null,2));}
 catch(e){console.error(JSON.stringify({status:'INCOMPLETE_OR_FAILED',phase,run:identities(args[2]),code:typeof e.code==='number'||typeof e.code==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(e.code)?e.code:null,message:'La prueba no terminó. Puede haber commits/objetos. Conservar ID e inspeccionar recibos; no afirmar rollback ni borrar datos.'}));process.exitCode=2;}
 finally{await ports?.close();}
}
module.exports={closed,identities,plan,mint,clients,effectiveProbe};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=2;});
