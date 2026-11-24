'use strict';
const {identity,fields,operation,packBackup,isId,hash,fail,LIMITS}=require('./contract.cjs');
const PROJECT='fullhouse-staging',APP='1:664973716762:web:c8407ddc2d0dc3ef8090a3';
function settingsCheck(s){
 if(s.projectId!==PROJECT||s.appId!==APP||s.bucket!==PROJECT+'.firebasestorage.app'||s.region!=='us-central1'||s.runtime!=='nodejs22'||s.database!=='(default)'||s.edition!=='STANDARD'||s.serviceAccount!==`fullhouse-remote-runtime@${PROJECT}.iam.gserviceaccount.com`)throw Error('Configuración de staging incompatible.');
 if(JSON.stringify(s.origins)!==JSON.stringify([`https://${PROJECT}.web.app`,`https://${PROJECT}.firebaseapp.com`])||typeof s.deploymentAuthorized!=='boolean'||typeof s.remoteEnabled!=='boolean')throw Error('Activación/orígenes de staging incompatibles.');
 const caps={rpcPerMinute:60,rpcPerDay:1000,operationsPerDay:100,operationsTotal:500,reservedBytes:64*1024*1024,downloadBytesPerDay:128*1024*1024};
 fields(s.limits,Object.keys(caps));for(const [key,cap] of Object.entries(caps))if(!Number.isSafeInteger(s.limits[key])||s.limits[key]<1||s.limits[key]>cap)throw Error('Límites de staging fuera de contrato.');return s;
}
function runtimeCheck(env,s,version=process.versions.node){
 settingsCheck(s);if(version.split('.')[0]!=='22')throw Error('El backend real requiere Node 22.');
 if(env.GCLOUD_PROJECT!==PROJECT||(env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_CLOUD_PROJECT!==PROJECT)||Object.keys(env).some(k=>(/EMULATOR/.test(k)||k.startsWith('FIREBASE_DEBUG'))&&env[k]))throw Error('No se permite cruzar staging con emulación o depuración que altere la verificación de tokens.');
}
function preflight(method,input){
 if(method==='save'||method==='restore'){
  operation(input,method);
  if(method==='restore')return {id:input.operationId,bytes:LIMITS.backupBytes+LIMITS.snapshotBytes,fingerprint:hash(JSON.stringify({method,id:input.operationId,base:input.baseRevision,restore:input.restoreRevision}))};
  const p=packBackup(input.backup);return {id:input.operationId,bytes:p.snapshot.length+[...p.photos.values()].reduce((n,b)=>n+b.length,0),fingerprint:hash(JSON.stringify({method,id:input.operationId,base:input.baseRevision,backup:p.backupHash}))};
 }
 const key=method==='read'?'revisionId':'operationId';fields(input,[key]);if(!(method==='read'&&input[key]===null)&&!isId(input[key]))fail('invalid-argument','Identidad incompatible.');return null;
}
// Only request auth supplies the UID. No client quota/owner claims are accepted.
function createHandler({db,service,settings:s,env,clock=Date.now}){
 settingsCheck(s);
 return async request=>{
  if(!s.remoteEnabled||env.FULLHOUSE_REMOTE_STAGING_ENABLED!=='1')fail('unavailable','El guardado remoto de staging todavía está desactivado.');
  const uid=identity(request.auth);
  if(request.app?.appId!==APP||request.app.alreadyConsumed)fail('permission-denied','La aplicación no supera App Check.');
  const testers=String(env.FULLHOUSE_STAGING_TEST_UIDS||'').split(',').filter(Boolean);
  if(!testers.length||testers.length>3||new Set(testers).size!==testers.length||testers.some(id=>!/^[A-Za-z0-9_-]{1,128}$/.test(id))||!testers.includes(uid))fail('permission-denied','Cuenta fuera del ensayo de staging autorizado.');
  fields(request.data,['method','input']);const {method,input}=request.data;if(!['save','restore','read','inspect'].includes(method))fail('invalid-argument','Operación no disponible.');
  const control=db.doc('stagingControl/remoteV1'),access=db.doc('stagingAccess/'+uid);
  const ms=clock();if(!Number.isSafeInteger(ms)||ms<0)fail('unavailable','Reloj de servicio no disponible.');const minute=Math.floor(ms/60000),day=Math.floor(ms/86400000),l=s.limits;
  const checked=snap=>{
   const [c,a]=snap;if(!c.exists||c.data().enabled!==true||!a.exists||a.data().enabled!==true)fail('permission-denied','Acceso de staging no autorizado.');
   if(['save','restore'].includes(method)&&c.data().writesEnabled!==true)fail('unavailable','Staging está en modo de recuperación; no se permiten guardados.');
   const value=a.data(),q=value.usage??{},keys=['minute','minuteRpc','day','dayRpc','dayOperations','totalOperations','reservedBytes','dayReadBytes'];
   if(value.usage!==undefined&&(!value.usage||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length!==keys.length||keys.some(k=>!Object.hasOwn(q,k))))fail('data-loss','El control de capacidad está incompleto; no se reiniciará.');
   for(const k of keys)if(q[k]!==undefined&&(!Number.isSafeInteger(q[k])||q[k]<0))fail('data-loss','El control de capacidad requiere revisión.');
   return {value,usage:{minute,minuteRpc:q.minute===minute?q.minuteRpc||0:0,day,dayRpc:q.day===day?q.dayRpc||0:0,dayOperations:q.day===day?q.dayOperations||0:0,totalOperations:q.totalOperations||0,reservedBytes:q.reservedBytes||0,dayReadBytes:q.day===day?q.dayReadBytes||0:0}};
  };
  // Charge request admission before parsing/hashing large backups. Failures count.
  await db.runTransaction(async tx=>{
   const {value,usage}=checked(await tx.getAll(control,access));usage.minuteRpc++;usage.dayRpc++;
   if(usage.minuteRpc>l.rpcPerMinute||usage.dayRpc>l.rpcPerDay)fail('resource-exhausted','Demasiadas solicitudes. Conserva el candidato y espera antes de reintentar.');tx.set(access,{...value,usage});
  });
  const reservation=preflight(method,input);
  if(reservation)await db.runTransaction(async tx=>{
   const op=db.doc(`stagingAccess/${uid}/reservations/${reservation.id}`),snap=await tx.getAll(control,access,op),{value,usage}=checked(snap),prior=snap[2];
   if(prior.exists&&(prior.data().fingerprint!==reservation.fingerprint||prior.data().bytes!==reservation.bytes))fail('already-exists','Esta identidad ya está reservada para otro comando.');
   if(!prior.exists){usage.dayOperations++;usage.totalOperations++;usage.reservedBytes+=reservation.bytes;}
   if(usage.dayOperations>l.operationsPerDay||usage.totalOperations>l.operationsTotal||usage.reservedBytes>l.reservedBytes)fail('resource-exhausted','Se alcanzó un límite de staging. Conserva el candidato y contacta con soporte.');
   if(!prior.exists){tx.set(access,{...value,usage});tx.create(op,{fingerprint:reservation.fingerprint,bytes:reservation.bytes});}
  });
  const result=await service[method](request.auth,input);
  if(method==='read')await db.runTransaction(async tx=>{
   const {value,usage}=checked(await tx.getAll(control,access));usage.dayReadBytes+=Buffer.byteLength(JSON.stringify({result}));
   if(usage.dayReadBytes>l.downloadBytesPerDay)fail('resource-exhausted','Límite diario de descargas. Los datos siguen guardados; conserva también tu copia local.');tx.set(access,{...value,usage});
  });
  return result;
 };
}
module.exports={settingsCheck,runtimeCheck,createHandler};
