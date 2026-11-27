'use strict';
// Read-only IAM inspection. POST is used only for getIamPolicy/testIamPermissions.
const {execFileSync}=require('node:child_process');
const PROJECT='fullhouse-staging',NUMBER='664973716762',BUCKET=PROJECT+'.firebasestorage.app';
const RUNTIME=`fullhouse-remote-runtime@${PROJECT}.iam.gserviceaccount.com`,MEMBER='serviceAccount:'+RUNTIME;
const PREFIX=`projects/_/buckets/${BUCKET}/objects/users/`,proposal=require('../remote-staging/iam.json');
const FIRESTORE=proposal.runtimeFirestore.includedPermissions,STORAGE=proposal.runtimeStorage.includedPermissions;
// Firebase Tools 15.37.0 also bootstraps Eventarc/PubSub identities for any gcfv2
// endpoint, even HTTP-only. Inspection is not authorization to enable them.
const CLOSED_APIS=Object.freeze(['artifactregistry.googleapis.com','cloudbuild.googleapis.com','run.googleapis.com','cloudfunctions.googleapis.com','eventarc.googleapis.com','pubsub.googleapis.com','storage.googleapis.com']);
const DEPLOY=['cloudfunctions.functions.get','cloudfunctions.functions.list','cloudfunctions.functions.create','cloudfunctions.functions.update','cloudfunctions.functions.sourceCodeSet','cloudfunctions.functions.setIamPolicy','serviceusage.services.get','serviceusage.services.list','run.services.get','run.services.getIamPolicy','run.services.setIamPolicy'];
function conditionMatches(c){const m=/^\s*resource\s*\.\s*name\s*\.\s*startsWith\s*\(\s*(['"])([^'"]*)\1\s*\)\s*$/.exec(c?.expression||'');return !!m&&m[2]===PREFIX;}
const selected=(policy,member)=>Array.isArray(policy?.bindings)?policy.bindings.filter(b=>b.members?.includes(member)):null;
const sameSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&b.every(x=>a.includes(x));
function assess({projectPolicy,bucketPolicy,roles={},account,database,bucket}){
 const p=selected(projectPolicy,MEMBER),b=selected(bucketPolicy,MEMBER),exact=(bindings,wanted,conditional)=>bindings?.filter(binding=>{
  const r=roles[binding.role];return r&&!r.deleted&&['GA','BETA'].includes(r.stage)&&sameSet(r.includedPermissions,wanted)&&(conditional?bucketPolicy.version===3&&conditionMatches(binding.condition):!binding.condition);
 })||[];
 const f=exact(p,FIRESTORE,false),s=exact(b,STORAGE,true),issues=[];
 if(!p||!b)issues.push('Política no accesible: permisos desconocidos, no ausentes.');
 if(!f.length)issues.push('No se verifica un rol Firestore directo, incondicional y mínimo de cuatro permisos.');
 if(!s.length)issues.push('No se verifica un rol Storage mínimo de dos permisos con la condición exacta users/.');
 if(p?.some(x=>!f.includes(x))||b?.some(x=>!s.includes(x)))issues.push('Otros grants directos del runtime requieren revisión; no se consideran mínimos automáticamente.');
 if([projectPolicy,bucketPolicy].some(x=>x?.bindings?.some(y=>y.members?.some(z=>['allUsers','allAuthenticatedUsers'].includes(z)))))issues.push('Hay grants públicos en proyecto/bucket; revisar sin modificarlos.');
 if(account?.email!==RUNTIME||account?.projectId!==PROJECT||account?.disabled===true||account?.disabled!==undefined&&typeof account.disabled!=='boolean')issues.push('Identidad runtime habilitada no verificada.');
 if(database?.name!==`projects/${PROJECT}/databases/(default)`||database?.locationId!=='us-central1'||database?.type!=='FIRESTORE_NATIVE'||database?.databaseEdition!=='STANDARD')issues.push('Firestore Standard/Native/default/us-central1 no verificado.');
 // REGIONAL is the legacy equivalent of Standard regional. Location/privacy
 // remain exact requirements; this does not accept MULTI_REGIONAL/cold classes.
 if(bucket?.name!==BUCKET||bucket?.location?.toLowerCase()!=='us-central1'||!['STANDARD','REGIONAL'].includes(bucket?.storageClass)||bucket?.iamConfiguration?.uniformBucketLevelAccess?.enabled!==true||bucket?.iamConfiguration?.publicAccessPrevention!=='enforced')issues.push('Bucket/región/clase/privacidad no verificados.');
 return {directPolicy:issues.length?'review-required':'matches-minimal-proposal',runtime:RUNTIME,projectBindings:p?.map(x=>({role:x.role,condition:x.condition?.expression||null}))??null,bucketBindings:b?.map(x=>({role:x.role,condition:x.condition?.expression||null}))??null,issues,effectiveAccess:'UNVERIFIED: requires approved synthetic runtime probe',limits:['No org/folder inheritance, group membership, deny policies or principal access boundaries evaluated.','A matching CEL expression is not proof that Storage evaluates it as expected.','No permission changes, token impersonation or data writes in this audit.']};
}
const requests=Object.freeze({
 project:['GET',`https://cloudresourcemanager.googleapis.com/v3/projects/${PROJECT}`],
 account:['GET',`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${RUNTIME}`],
 projectPolicy:['POST',`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`,{options:{requestedPolicyVersion:3}}],
 bucketPolicy:['GET',`https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam?optionsRequestedPolicyVersion=3`],
 accountPolicy:['POST',`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${RUNTIME}:getIamPolicy?options.requestedPolicyVersion=3`],
 database:['GET',`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`],
 bucket:['GET',`https://storage.googleapis.com/storage/v1/b/${BUCKET}?projection=noAcl`],
 function:['GET',`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/us-central1/functions/remoteV1`],
 buildDefault:['GET',`https://cloudbuild.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/defaultServiceAccount`],
 deployerProject:['POST',`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:testIamPermissions`,{permissions:DEPLOY}],
 deployerRuntime:['POST',`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${RUNTIME}:testIamPermissions`,{permissions:['iam.serviceAccounts.actAs','iam.serviceAccounts.getAccessToken']}],
 deployerRun:['POST',`https://run.googleapis.com/v2/projects/${PROJECT}/locations/us-central1/services/remotev1:testIamPermissions`,{permissions:['run.services.get','run.services.getIamPolicy','run.services.setIamPolicy']}],
 ...Object.fromEntries(CLOSED_APIS.map(service=>['api:'+service,['GET',`https://serviceusage.googleapis.com/v1/projects/${NUMBER}/services/${service}`]]))
});
function plan(){return {project:PROJECT,runtime:RUNTIME,mode:'READ_ONLY',requests:Object.entries(requests).map(([name,[method,url,body]])=>({name,method,url,...(body?{body}:{})})),roles:'GET only, exact roles attached directly to runtime in this project/bucket',effectiveAccess:'not tested; no impersonation, no writes'};}
async function audit({token,fetcher=fetch}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Falta una sesión gcloud local autorizada.');
 const observations=[];
 async function get(name,[method,url,body]){try{const r=await fetcher(url,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!r.ok){
  const observation={name,status:'unknown',http:r.status};
  // Keep only non-sensitive RPC/ErrorInfo codes. Never echo raw messages/metadata.
  try{const error=(await r.json())?.error;if(typeof error?.status==='string'&&/^[A-Z_]{1,64}$/.test(error.status))observation.rpcStatus=error.status;
   const info=error?.details?.find?.(x=>x?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo');
   if(typeof info?.reason==='string'&&/^[A-Z_]{1,64}$/.test(info.reason))observation.reason=info.reason;
   if(info?.metadata?.service===new URL(url).hostname)observation.service=info.metadata.service;
  }catch{/* Missing/non-JSON errors still remain unknown with their HTTP status. */}
  observations.push(observation);return null;
 }const v=await r.json();observations.push({name,status:'observed'});return v;}catch{observations.push({name,status:'unknown',reason:'Consulta no disponible; no se modifica nada.'});return null;}}
 const project=await get('project',requests.project);
 if(project?.projectId!==PROJECT||project?.name!==`projects/${NUMBER}`)return {project:PROJECT,complete:false,observations,reason:'Identidad/número no verificables. Se detiene el análisis.'};
 const values={};for(const [name,request]of Object.entries(requests))if(name!=='project')values[name]=await get(name,request);
 const roles={};for(const role of new Set([...(selected(values.projectPolicy,MEMBER)||[]),...(selected(values.bucketPolicy,MEMBER)||[])].map(b=>b.role))){
  if(!new RegExp(`^(?:projects/${PROJECT}/roles/[A-Za-z0-9_.]+|roles/[A-Za-z0-9_.]+)$`).test(role)){observations.push({name:'role',status:'unknown',reason:'Rol externo o no compatible; revisión manual.'});continue;}
  roles[role]=await get('role:'+role,['GET','https://iam.googleapis.com/v1/'+role]);
 }
 const agents={functions:`service-${NUMBER}@gcf-admin-robot.iam.gserviceaccount.com`,run:`service-${NUMBER}@serverless-robot-prod.iam.gserviceaccount.com`,buildAgent:`service-${NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com`,eventarc:`service-${NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com`,pubsub:`service-${NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com`};
 const declaredBuilder=values.function?.buildConfig?.serviceAccount||values.buildDefault?.serviceAccountEmail||values.buildDefault?.name;
 const builder=typeof declaredBuilder==='string'?declaredBuilder.split('/').pop():null;
 const builderAllowed=builder&&new RegExp(`^(?:[A-Za-z0-9_-]+@${PROJECT}\\.iam\\.gserviceaccount\\.com|${NUMBER}@cloudbuild\\.gserviceaccount\\.com|${NUMBER}-compute@developer\\.gserviceaccount\\.com)$`).test(builder);
 if(builderAllowed){agents.buildExecution=builder;values.deployerBuild=await get('deployerBuild',['POST',`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${builder}:testIamPermissions`,{permissions:['iam.serviceAccounts.actAs']}]);}
 const apiStates=CLOSED_APIS.map(service=>{const key='api:'+service,value=values[key],state=value?.name===`projects/${NUMBER}/services/${service}`&&['ENABLED','DISABLED'].includes(value.state)?value.state:'UNKNOWN';if(state==='UNKNOWN'){const observation=observations.find(x=>x.name===key);if(observation?.status==='observed'){observation.status='unknown';observation.reason='Service Usage metadata incomplete or incompatible.';}}return {service,state};});
 return {project:PROJECT,complete:observations.every(x=>x.status==='observed'),observations,assessment:assess({...values,roles}),
  resources:{database:values.database?{name:values.database.name,locationId:values.database.locationId,type:values.database.type,edition:values.database.databaseEdition}:null,bucket:values.bucket?{name:values.bucket.name,location:values.bucket.location,storageClass:values.bucket.storageClass,iamConfiguration:values.bucket.iamConfiguration,softDeletePolicy:values.bucket.softDeletePolicy}:null,runtime:values.account?{email:values.account.email,disabled:values.account.disabled,uniqueId:values.account.uniqueId}:null},
  deployer:{projectPermissions:values.deployerProject?.permissions??null,runtimePermissions:values.deployerRuntime?.permissions??null,runPermissions:values.deployerRun?.permissions??null,buildActAs:values.deployerBuild?.permissions??null,firstHttpsPolicyVerified:values.deployerProject?values.deployerProject.permissions?.includes('cloudfunctions.functions.setIamPolicy')===true:null,runtimeActAsVerified:values.deployerRuntime?values.deployerRuntime.permissions?.includes('iam.serviceAccounts.actAs')===true:null,notGrantedAtProjectCheck:values.deployerProject?DEPLOY.filter(p=>!values.deployerProject.permissions?.includes(p)):null,note:'Effective for the inspecting credential at these resources only, not a complete deploy authorization. A project check may miss permissions conditioned on the future Run resource.'},
  managedIdentities:Object.fromEntries(Object.entries(agents).map(([kind,email])=>[kind,{email,directProjectRoles:selected(values.projectPolicy,'serviceAccount:'+email)?.map(x=>({role:x.role,condition:x.condition?.expression||null}))??null}])),
  buildSelection:{identity:builderAllowed?builder:null,source:values.function?.buildConfig?.serviceAccount?'deployed function':'Cloud Build default candidate only',verifiedForNextDeploy:false},
  closedFunctionsPreparation:{apiStates,apiCheck:apiStates.every(x=>x.state==='ENABLED')?'all-observed-enabled':'disabled-or-unverified',deploymentAuthorizedByAudit:false,manualChecks:['Owner approval and closed artifact/gate review.','Identify actual build executor; verify source bucket, Artifact Registry repository, logs and actAs scopes.','Review Functions/Build/Run agents and CLI Eventarc/PubSub identity bootstrap, plus organization invocation policy.'],note:'Service state is not resource existence, an IAM grant, a build identity choice or deploy authorization. No API is enabled by this command.'},
  runtimeImpersonationPolicy:values.accountPolicy?{version:values.accountPolicy.version||1,bindings:(values.accountPolicy.bindings||[]).map(b=>({role:b.role,membersCount:b.members?.length||0,condition:b.condition?.expression||null}))}:null,
  function:values.function?{name:values.function.name,runtime:values.function.buildConfig?.runtime,runtimeServiceAccount:values.function.serviceConfig?.serviceAccountEmail,buildServiceAccount:values.function.buildConfig?.serviceAccount}:null};
}
function localToken(){try{return execFileSync('gcloud',['auth','print-access-token','--quiet'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();}catch{throw Error('Sin sesión gcloud local. Ejecuta en Cloud Shell del propietario; no compartas tokens ni claves JSON.');}}
async function main(args){if(!args.length||args.length===1&&args[0]==='--plan')return console.log(JSON.stringify(plan(),null,2));if(args.length!==1||args[0]!=='--run')throw Error('Uso: --plan o --run; proyecto fijo fullhouse-staging.');const result=await audit({token:localToken()});console.log(JSON.stringify(result,null,2));if(!result.complete||result.assessment?.directPolicy!=='matches-minimal-proposal'||result.closedFunctionsPreparation?.apiCheck!=='all-observed-enabled')process.exitCode=2;}
module.exports={PROJECT,NUMBER,BUCKET,RUNTIME,PREFIX,FIRESTORE,STORAGE,DEPLOY,CLOSED_APIS,conditionMatches,assess,plan,audit,localToken};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=2;});
