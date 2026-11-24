'use strict';
const settings=require('./settings.json'),{runtimeCheck,createHandler}=require('./policy.cjs');
runtimeCheck(process.env,settings);
const {onCall,HttpsError}=require('firebase-functions/v2/https'),{RemoteError}=require('./contract.cjs');
let handle;
exports.remoteV1=onCall({region:settings.region,serviceAccount:settings.serviceAccount,minInstances:0,maxInstances:1,concurrency:1,cpu:'gcf_gen1',memory:'512MiB',timeoutSeconds:60,enforceAppCheck:true,consumeAppCheckToken:false,cors:settings.origins,invoker:'public'},async request=>{
 try{
  // Disabled builds never initialize Admin SDK, credentials or database clients.
  if(!settings.remoteEnabled||process.env.FULLHOUSE_REMOTE_STAGING_ENABLED!=='1')throw new HttpsError('unavailable','El guardado remoto de staging está desactivado.');
  if(!handle){const {initializeApp}=require('firebase-admin/app'),{getFirestore,Timestamp}=require('firebase-admin/firestore'),{getStorage}=require('firebase-admin/storage'),{createService}=require('./service.cjs');const app=initializeApp({projectId:settings.projectId,storageBucket:settings.bucket}),db=getFirestore(app);handle=createHandler({db,settings,env:process.env,service:createService({db,bucket:getStorage(app).bucket(),now:()=>Timestamp.now()})});}
  return await handle(request);
 }catch(e){if(e instanceof HttpsError)throw e;if(e instanceof RemoteError)throw new HttpsError(e.code,e.message);throw new HttpsError('unavailable','No pudimos confirmar la operación. Conserva el candidato e inspecciona su recibo.');}
});
