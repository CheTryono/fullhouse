'use strict';
// Explicit local readback after an uncertain deploy; never retries/mutates cloud.
const fs=require('node:fs'),gcloud=require('./remote-staging-gcloud.cjs');
try{if(process.argv.length!==6)throw Error('Uso: plan.json function.json build.json invoker-policy.json, archivos locales fuera de Git.');const [plan,fn,build,invoker]=process.argv.slice(2).map(file=>JSON.parse(fs.readFileSync(file,'utf8')));gcloud.verifyPlan(plan);console.log(JSON.stringify(gcloud.verifyReadback({plan,fn,build,invoker}),null,2));}catch{console.error('No se confirmó la release. Conserva archivos/estado y revisa la evidencia; no se modifica ni reintenta el despliegue.');process.exitCode=2;}
