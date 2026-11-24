'use strict';
// Explicit GET allowlist. Never enables an API, creates resources or logs tokens.
const {execFileSync}=require('node:child_process');
const PROJECT='fullhouse-staging';
const endpoints=Object.freeze([
 ['billing',`https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`,x=>({billingEnabled:x.billingEnabled})],
 ['databases',`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases`,x=>({databases:(x.databases||[]).map(d=>({name:d.name,locationId:d.locationId,type:d.type,databaseEdition:d.databaseEdition,state:d.state}))})],
 ['buckets',`https://storage.googleapis.com/storage/v1/b?project=${PROJECT}&projection=noAcl&maxResults=100`,x=>({buckets:(x.items||[]).map(b=>({name:b.name,location:b.location,storageClass:b.storageClass,iamConfiguration:b.iamConfiguration,softDeletePolicy:b.softDeletePolicy,versioning:b.versioning,retentionPolicy:b.retentionPolicy}))})],
 ['functions',`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions?pageSize=100`,x=>({functions:(x.functions||[]).map(f=>({name:f.name,state:f.state,runtime:f.buildConfig?.runtime,minInstanceCount:f.serviceConfig?.minInstanceCount,maxInstanceCount:f.serviceConfig?.maxInstanceCount}))})],
 ['run-us-central1',`https://run.googleapis.com/v2/projects/${PROJECT}/locations/us-central1/services?pageSize=100`,x=>({services:(x.services||[]).map(s=>({name:s.name,scaling:s.scaling}))})],
 ['artifacts-us-central1',`https://artifactregistry.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/repositories?pageSize=100`,x=>({repositories:(x.repositories||[]).map(r=>({name:r.name,format:r.format,cleanupPolicyDryRun:r.cleanupPolicyDryRun,cleanupPolicies:r.cleanupPolicies}))})],
 ['builds-us-central1',`https://cloudbuild.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/builds?pageSize=10`,x=>({builds:(x.builds||[]).map(b=>({id:b.id,status:b.status}))})]
]);
function plan(){return {project:PROJECT,mode:'read-only',scope:'Metadata only; Run, Build and Artifact Registry limited to us-central1. No IAM, user documents, objects or secret values.',endpoints:endpoints.map(([name,url])=>({name,method:'GET',url})),discovery:['Project number → enabled APIs, App Check apps and reCAPTCHA key public configuration; GET only.']};}
async function inspect({token,fetcher=fetch}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Se requiere una sesión local autorizada de gcloud.');
 async function get(name,url,select){
  try{const r=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000)});
   if(!r.ok)return {name,status:'unknown',http:r.status};
   const x=await r.json();return {name,status:x.nextPageToken||x.unreachable?.length?'incomplete':'observed',...select(x)};
  }catch{return {name,status:'unknown',reason:'No se pudo consultar. No se habilitó ningún servicio.'};}
 }
 const project=await get('project',`https://cloudresourcemanager.googleapis.com/v3/projects/${PROJECT}`,x=>({projectId:x.projectId,number:/^projects\/\d+$/.test(x.name||'')?x.name.slice(9):null}));
 if(project.status!=='observed'||project.projectId!==PROJECT||!project.number)return {project:PROJECT,complete:false,resources:[project],reason:'Identidad del proyecto no verificable; se detiene la inspección.'};
 const resources=await Promise.all(endpoints.map(([name,url,select])=>get(name,url,select)));
 const number=project.number;
 resources.push(await get('enabled-apis',`https://serviceusage.googleapis.com/v1/projects/${number}/services?filter=state%3AENABLED&pageSize=200`,x=>({services:(x.services||[]).map(s=>({name:s.config?.name,state:s.state}))})));
 resources.push(await get('app-check',`https://firebaseappcheck.googleapis.com/v1/projects/${number}/apps/1:664973716762:web:c8407ddc2d0dc3ef8090a3/recaptchaEnterpriseConfig`,x=>({name:x.name,siteKey:x.siteKey,tokenTtl:x.tokenTtl})));
 resources.push(await get('recaptcha',`https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT}/keys?pageSize=100`,x=>({keys:(x.keys||[]).map(k=>({name:k.name,webSettings:k.webSettings}))})));
 return {project:PROJECT,complete:resources.every(r=>r.status==='observed'),scope:plan().scope,resources:[project,...resources]};
}
async function main(args){
 if(args.length===0||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify(plan(),null,2));return;}
 if(args.length!==1||args[0]!=='--run')throw Error('Uso: node scripts/inspect-remote-staging.cjs [--plan|--run]. Proyecto fijo: fullhouse-staging.');
 let token;try{token=execFileSync('gcloud',['auth','print-access-token','--quiet'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();}catch{throw Error('Sin sesión gcloud disponible. Ejecuta la inspección desde tu Cloud Shell; no compartas tokens.');}
 const result=await inspect({token});console.log(JSON.stringify(result,null,2));if(!result.complete)process.exitCode=2;
}
module.exports={plan,inspect};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=2;});
