'use strict';
const {test} = require('node:test'),assert=require('node:assert/strict');
test('actual Auth/Functions boundary rejects unauthenticated, unverified and UID-injected requests before database access',async()=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-fullhouse-remote');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');
 const backendRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../../remote/package.json'));
 const {initializeApp,deleteApp}=backendRequire('firebase-admin/app'),{getAuth}=backendRequire('firebase-admin/auth');
 const app=initializeApp({projectId:'demo-fullhouse-remote'},'boundary-test');
 async function call(data,token){const response=await fetch('http://127.0.0.1:5002/demo-fullhouse-remote/us-central1/readRemoteV1',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({data})});return response.json();}
 try{
  assert.equal((await call({revisionId:null})).error?.status,'UNAUTHENTICATED');
  for(const verified of [false,true]){
   const uid='synthetic_boundary_'+verified,email=uid+'@example.test',password='Synthetic-Password-2030!';
   await getAuth(app).createUser({uid,email,password,emailVerified:verified});
   const response=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
   const result=await response.json();assert(result.idToken,'Auth emulator must issue an actual ID token');
   const answer=await call({revisionId:null,uid:'another-user'},result.idToken);
   assert.equal(answer.error?.status,verified?'INVALID_ARGUMENT':'PERMISSION_DENIED');
  }
 }finally{await deleteApp(app);}
});
