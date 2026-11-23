'use strict';
// PR 3A is emulator-only. A separately reviewed PR must authorize real deployment.
if (process.env.FUNCTIONS_EMULATOR !== 'true' || process.env.GCLOUD_PROJECT !== 'demo-fullhouse-remote') throw Error('Backend PR 3A: solo emuladores demo-fullhouse-remote. No desplegar.');
// Discovery may omit services not started by --auth-only. Pin missing endpoints
// to loopback as well; absence must never cause an SDK fallback to real services.
for (const [key,value] of Object.entries({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8088',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9198',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098'})) {
  if (process.env[key] && process.env[key] !== value) throw Error('Backend PR 3A: endpoint de emulador incompatible.');
  process.env[key]=value;
}
const {initializeApp} = require('firebase-admin/app');
const {getFirestore,Timestamp} = require('firebase-admin/firestore');
const {getStorage} = require('firebase-admin/storage');
const {onCall,HttpsError} = require('firebase-functions/v2/https');
const {createService} = require('./service.cjs');
const {RemoteError} = require('./contract.cjs');
const app = initializeApp({projectId:'demo-fullhouse-remote',storageBucket:'demo-fullhouse-remote.appspot.com'});
const service = createService({db:getFirestore(app),bucket:getStorage(app).bucket(),now:()=>Timestamp.now()});
function callable(method) {
  return onCall({region:'us-central1',maxInstances:2,concurrency:8,memory:'256MiB',timeoutSeconds:60},async request=>{
    try { return await service[method](request.auth,request.data); }
    catch (e) {
      if (e instanceof RemoteError) throw new HttpsError(e.code,e.message);
      // Never send provider messages, filenames, tokens or backup contents to clients.
      throw new HttpsError('unavailable','No pudimos confirmar la operación. Conserva tu borrador e inspecciona su recibo antes de reintentar.');
    }
  });
}
exports.saveRemoteV1 = callable('save');
exports.readRemoteV1 = callable('read');
exports.restoreRemoteV1 = callable('restore');
exports.inspectRemoteV1 = callable('inspect');
