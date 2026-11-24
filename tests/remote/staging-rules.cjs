'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const project='demo-fullhouse-remote',base='http://127.0.0.1:8088/v1/projects/'+project+'/databases/(default)/documents';
const admin=require('node:module').createRequire(path.resolve(__dirname,'../../remote/package.json'));
const {initializeApp,deleteApp}=admin('firebase-admin/app'),{getAuth}=admin('firebase-admin/auth'),{getStorage}=admin('firebase-admin/storage');
let tokens=[],app;const ownerId='rules_A';
before(async()=>{
 assert.equal(process.env.GCLOUD_PROJECT,project);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8088');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');
 process.env.FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9198';app=initializeApp({projectId:project,storageBucket:project+'.appspot.com'},'staging-rules');
 for(const k of ['A','B']){await getAuth(app).createUser({uid:'rules_'+k,email:k+'@example.test',password:'Synthetic-Password-2030!',emailVerified:true});const r=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:k+'@example.test',password:'Synthetic-Password-2030!',returnSecureToken:true})});const data=await r.json();assert.equal(data.localId,'rules_'+k);assert(data.idToken);tokens.push(data.idToken);}
 const response=await fetch(base+'/users/'+ownerId+'/storage/head',{method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({fields:{uid:{stringValue:ownerId},revisionId:{stringValue:'synthetic'}}})});assert(response.ok);
 await getStorage(app).bucket().file('users/'+ownerId+'/photos/secret').save(Buffer.from('synthetic photograph'),{resumable:false});
});
after(async()=>{if(app)await deleteApp(app);});
for(const who of ['anonymous','A','B'])test('staging deny-all rules reject read/list/create/update/delete and escalation for '+who,async()=>{
 const headers={'content-type':'application/json',...(who==='anonymous'?{}:{authorization:'Bearer '+tokens[who==='A'?0:1]})};
 const requests=[['GET',base+'/users/'+ownerId+'/storage/head'],['GET',base+'/users/'+ownerId+'/revisions'],['PATCH',base+'/users/'+ownerId+'/storage/head'],['PATCH',base+'/stagingAccess/'+ownerId],['PATCH',base+'/stagingControl/remoteV1'],['DELETE',base+'/users/'+ownerId+'/storage/head']];
 for(const [method,url]of requests){const r=await fetch(url,{method,headers,...(method==='PATCH'?{body:JSON.stringify({fields:{enabled:{booleanValue:true}}})}: {})});assert.equal(r.status,403,method+' '+url);}
 const storage=await fetch('http://127.0.0.1:9198/v0/b/'+project+'.appspot.com/o/'+encodeURIComponent('users/'+ownerId+'/photos/secret'),{headers});assert.equal(storage.status,403);
});
