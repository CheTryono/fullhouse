'use strict';
const {spawn} = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname,'..');
const config = fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-remote-emulators-'));
const env = {...process.env,CI:'1',NO_UPDATE_NOTIFIER:'1',XDG_CONFIG_HOME:config,FIREBASE_EMULATORS_PATH:path.join(os.tmpdir(),'fullhouse-emulators'),GCLOUD_PROJECT:'demo-fullhouse-remote',METADATA_SERVER_DETECTION:'none'};
// Never inherit real credentials or real emulator endpoints. CLI only starts demo.
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','FIREBASE_CONFIG','GOOGLE_CLOUD_PROJECT','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','STORAGE_EMULATOR_HOST','CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE']) delete env[key];
// Even the auth-only test must never fall back to a remote data service.
env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8088';
env.FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9198';
const authOnly=process.argv.includes('--auth-only');
const planner=process.argv.includes('--planner'),simulated=process.argv.includes('--simulated-data');
if(simulated&&!planner)throw Error('El backend simulado solo se usa con el laboratorio 3B.');
const command=planner?'node scripts/remote-lab-run.cjs'+['--simulated-data','--browser','--durable','--serve'].filter(x=>process.argv.includes(x)).map(x=>' '+x).join(''):`node --test --test-concurrency=1 tests/remote/${authOnly?'auth-boundary':'emulators'}.cjs`;
const child = spawn(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-fullhouse-remote','--config','firebase.remote-emulators.json','--only',simulated?'auth':authOnly?'auth,functions':'auth,firestore,storage,functions',command],{cwd:root,env,stdio:'inherit'});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{fs.rmSync(config,{recursive:true,force:true});process.exitCode=code??1;});
