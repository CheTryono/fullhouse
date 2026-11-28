'use strict';
// One failed resource, read-only inspection by default; no deletion or retry path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const g=require('./remote-staging-gcloud.cjs'),id=require('./remote-staging-build-identity.cjs'),settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');
const PREVIOUS_BUILD='a690a410-ec8f-4bd9-917f-581ee466b433',LOCATION=`projects/${id.PROJECT}/locations/${id.REGION}`,RUN=`${LOCATION}/services/remotev1`;
const REQUIRED=['cloudfunctions.functions.get','cloudfunctions.functions.update','cloudfunctions.functions.sourceCodeSet','cloudfunctions.operations.list','serviceusage.services.use','cloudbuild.builds.get','run.services.get','run.services.getIamPolicy','run.services.setIamPolicy'];
const canonical=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),owned=(part,value)=>new RegExp(`^projects/(?:${id.PROJECT}|${id.NUMBER})/locations/${id.REGION}/${part}$`).test(value||'');
const builder=value=>[id.BUILD_RESOURCE,`projects/${id.NUMBER}/serviceAccounts/${id.BUILD_EMAIL}`].includes(value);
function assertRecoveryAudit(a){
 // Same mandatory IAM/input checks as the first-create route; that route itself
 // is never called with a fabricated absent function or altered observations.
 if(a?.project!==id.PROJECT||a.assessment?.directPolicy!=='matches-minimal-proposal'||a.closedFunctionsPreparation?.apiCheck!=='all-observed-enabled'||a.buildSelection?.dedicated?.identityVerified!==true||a.buildSelection.dedicated.operatorActAsVerified!==true||a.buildSelection.dedicated.ownerOrEditorDirectGrant!==false||a.deployer?.runtimeActAsVerified!==true||a.gcloudResources?.basicInputsVerified!==true)throw Error('Auditoría de recuperación incompleta; no se permite subir ni actualizar.');
 for(const [kind,role]of [['functions','roles/cloudfunctions.standardServiceAgent'],['buildAgent','roles/cloudbuild.serviceAgent'],['run','roles/run.serviceAgent']])if(!a.managedIdentities?.[kind]?.directProjectRoles?.some(b=>b.role===role&&!b.condition))throw Error('Agentes administrados no verificados.');
 if(!owned('functions/remoteV1',a.function?.name)||a.function.runtime!=='nodejs22'||a.function.runtimeServiceAccount!==id.RUNTIME||!builder(a.function.buildServiceAccount)||!a.observations?.some(o=>o.name==='function'&&o.status==='observed')||!REQUIRED.every(p=>a.recoveryPermissions?.includes(p)))throw Error('Función o permisos efectivos de actualización/inspección no verificados.');
}
function assertSnapshot(s){
 assertRecoveryAudit(s?.audit);const f=s.fn,b=f?.buildConfig,c=f?.serviceConfig,previous=s.previousBuild;
 if(!owned('functions/remoteV1',f?.name)||f.environment!=='GEN_2'||f.state!=='FAILED'||!owned('builds/'+PREVIOUS_BUILD,b?.build)||b?.runtime!=='nodejs22'||b.entryPoint!=='remoteV1'||!builder(b.serviceAccount)||b.dockerRepository!==id.REPOSITORY||b.source?.storageSource?.bucket!==id.SOURCE_BUCKET||typeof b.source.storageSource.object!=='string'||!b.source.storageSource.object)throw Error('La función FAILED no coincide con el recurso/build/identidades/fuentes aprobados.');
 if(!c||c.serviceAccountEmail!==id.RUNTIME||c.availableMemory!=='512Mi'||c.availableCpu!==g.CPU||c.maxInstanceCount!==1||(c.minInstanceCount??0)!==0||c.maxInstanceRequestConcurrency!==1||c.timeoutSeconds!==60||c.ingressSettings!=='ALLOW_ALL'||c.service&&!owned('services/remotev1',c.service)||c.allTrafficOnLatestRevision===false)throw Error('Capacidad o servicio de la función fallida inesperados.');
 if(canonical(c.environmentVariables)!==canonical(g.ENV)||canonical(b.environmentVariables)!==canonical({GOOGLE_NODE_RUN_SCRIPTS:''}))throw Error('Variables de runtime/build inesperadas; no se sobrescriben silenciosamente.');
 if(f.eventTrigger||f.kmsKeyName||f.upgradeInfo||b.workerPool||b.source.repoSource||b.dockerRegistry&&b.dockerRegistry!=='ARTIFACT_REGISTRY'||c.vpcConnector||c.vpcConnectorEgressSettings||c.directVpcNetworkInterface?.length||c.secretEnvironmentVariables?.length||c.secretVolumes?.length||c.binaryAuthorizationPolicy)throw Error('Configuración adicional no autorizada en esta recuperación.');
 if(![f.createTime,f.updateTime].every(t=>typeof t==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(t)&&Number.isFinite(Date.parse(t)))||f.labels?.['deployment-callable']!=='true'||f.labels?.['firebase-functions-codebase']!=='remote-staging-v1'||!(/^[a-f0-9]{32}$/).test(f.labels?.['fullhouse-release']||''))throw Error('Identidad temporal/labels de la función no verificables.');
 if(!owned('builds/'+PREVIOUS_BUILD,previous?.name)||previous.status!=='SUCCESS'||!builder(previous.serviceAccount)||previous.id&&previous.id!==PREVIOUS_BUILD||previous.projectId&&previous.projectId!==id.PROJECT||!Array.isArray(previous.results?.images)||!previous.results.images.length||previous.results.images.some(i=>!i.name?.startsWith(`${id.REGION}-docker.pkg.dev/${id.PROJECT}/fullhouse-remote-functions/`)||!/^sha256:[a-f0-9]{64}$/.test(i.digest)))throw Error('Compilación anterior no verificada como SUCCESS del builder/repositorio dedicados.');
 const source=previous.sourceProvenance?.resolvedStorageSource;
 if(![id.SOURCE_BUCKET,`gcf-v2-sources-${id.NUMBER}-${id.REGION}`].includes(source?.bucket)||typeof source.object!=='string'||!source.object||!(/^[1-9]\d*$/).test(source.generation||''))throw Error('Procedencia del build anterior no verificable.');
 if(s.run?.resource!==RUN||s.run.http!==404||s.run.rpcStatus!=='NOT_FOUND'||s.run.reason)throw Error('Run no tiene una observación NOT_FOUND inequívoca para esta recuperación.');
 if(!Array.isArray(s.operations)||s.operations.some(op=>op.done!==true&&(typeof op.metadata?.target!=='string'||!/^projects\/[^/]+\/locations\/[^/]+\/functions\/[^/]+$/.test(op.metadata.target)||owned('functions/remoteV1',op.metadata.target))))throw Error('Operaciones en curso o incompletas; no se inicia otra actualización.');
}
function seal(snapshot,release){
 assertSnapshot(snapshot);g.verifyPlan(release);
 const controls=Object.fromEntries(['remote-staging-recovery.cjs','remote-staging-recovery-diagnostic.cjs','audit-remote-staging-iam.cjs','remote-staging-build-identity.cjs','probe-remote-staging-runtime.cjs','build-remote-staging.cjs','prepare-remote-staging-closed.cjs'].map(name=>[name,sha(fs.readFileSync(path.join(__dirname,name)))]));
 const payload={format:1,target:id.FUNCTION,previousBuild:PREVIOUS_BUILD,releaseHash:release.releaseHash,snapshotHash:sha(canonical(snapshot)),controls};
 return {...payload,recoveryHash:sha(canonical(payload))};
}
function report(snapshot,release){const proof=seal(snapshot,release);return {mode:'READ_ONLY_RECOVERY_INSPECTION',...proof,checks:{runtimePolicy:snapshot.audit.assessment.directPolicy,apis:snapshot.audit.closedFunctionsPreparation.apiCheck,dedicatedBuilder:snapshot.audit.buildSelection.dedicated,managedIdentities:snapshot.audit.managedIdentities,sourceRepository:snapshot.audit.gcloudResources.checks,permissions:snapshot.audit.recoveryPermissions},observed:{name:snapshot.fn.name,state:snapshot.fn.state,environment:snapshot.fn.environment,createTime:snapshot.fn.createTime,updateTime:snapshot.fn.updateTime,build:snapshot.fn.buildConfig.build,builder:snapshot.fn.buildConfig.serviceAccount,runtime:snapshot.fn.serviceConfig.serviceAccountEmail,repository:snapshot.fn.buildConfig.dockerRepository,source:snapshot.fn.buildConfig.source.storageSource,capacity:{memory:snapshot.fn.serviceConfig.availableMemory,cpu:snapshot.fn.serviceConfig.availableCpu,maxInstances:snapshot.fn.serviceConfig.maxInstanceCount},run:snapshot.run,previousImages:snapshot.previousBuild.results.images,previousSource:snapshot.previousBuild.sourceProvenance.resolvedStorageSource},notice:'Metadata read-only, not deployment permission. Owner must review releaseHash and recoveryHash independently; freeze concurrent deployments. No atomic CAS in gcloud.'};}
async function readLive({token,fetcher=fetch,readAudit,diagnostic=false}={}){
 const iam=require('./audit-remote-staging-iam.cjs'),readIssues=[];
 try{token??=iam.localToken();if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Sesión local del propietario no disponible.');}catch(e){if(!diagnostic)throw e;return {readIssues:[{source:'credentials',status:'unverified'}]};}
 const issue=(source,e,details={})=>{if(!diagnostic)throw e;readIssues.push({source,status:'unverified',...details});};
 async function request(source,url,{method='GET',body,missing=false}={}){
  let r;try{
   r=await fetcher(url,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000)});
   if(!r.ok){let error;try{error=(await r.json()).error;}catch{}
    const reason=error?.details?.find?.(d=>d?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo')?.reason;
    if(missing&&r.status===404&&error?.status==='NOT_FOUND'&&!reason)return {resource:RUN,http:404,rpcStatus:'NOT_FOUND'};
    throw Error(`Inspección no verificable (HTTP ${r.status}); no se interpreta como ausencia ni se cambian permisos.`);
   }
   if(missing)return {resource:RUN,http:200,rpcStatus:'OBSERVED'};return await r.json();
  }catch(e){issue(source,e,Number.isInteger(r?.status)?{http:r.status}:{});return undefined;}
 }
 let audit;try{audit=await (readAudit||iam.audit)({token,fetcher});}catch(e){issue('audit',e);}
 const permission=await request('permissions',`https://cloudresourcemanager.googleapis.com/v1/projects/${id.PROJECT}:testIamPermissions`,{method:'POST',body:{permissions:REQUIRED}});
 if(audit)audit.recoveryPermissions=permission?.permissions;
 const fn=await request('function',`https://cloudfunctions.googleapis.com/v2/${id.FUNCTION}`),previousBuild=await request('previousBuild',`https://cloudbuild.googleapis.com/v1/${LOCATION}/builds/${PREVIOUS_BUILD}`);
 const run=await request('run',`https://run.googleapis.com/v2/${RUN}`,{missing:true});
 if(run?.http===200)issue('run.exists',Error('Existe un servicio Run; detener y revisar su estado antes de otro ensayo.'));
 let operations=[];let page='';const seen=new Set();
 for(let pages=0;pages<10;pages++){
  const result=await request('operations',`https://cloudfunctions.googleapis.com/v2/${LOCATION}/operations?pageSize=100${page?'&pageToken='+encodeURIComponent(page):''}`);
  if(!result){operations=undefined;break;}
  if(result.unreachable?.length||result.operations!==undefined&&!Array.isArray(result.operations)){issue('operations',Error('Inventario de operaciones incompleto.'));operations=undefined;break;}
  operations.push(...(result.operations||[]));page=result.nextPageToken||'';if(!page)break;
  if(seen.has(page)||pages===9){issue('operations',Error('No se puede verificar la lista completa de operaciones.'));operations=undefined;break;}seen.add(page);
 }
 const last=await request('function.recheck',`https://cloudfunctions.googleapis.com/v2/${id.FUNCTION}`);if(canonical(last)!==canonical(fn))issue('function.stability',Error('La función cambió durante la inspección; conservar evidencia y revisar.'));
 return {audit,fn,previousBuild,run,operations,...(diagnostic?{readIssues}:{})};
}
function diagnoseSnapshot(snapshot={},releaseHash){
 const rows=require('./remote-staging-recovery-diagnostic.cjs').checks(snapshot,{requiredPermissions:REQUIRED,expectedBuild:PREVIOUS_BUILD});
 let strict=false;try{assertSnapshot(snapshot);strict=true;}catch{/* Missing facts must never be filled from settings or from a builder identity. */}
 for(const entry of snapshot.readIssues||[])rows.push({field:'read.'+entry.source,status:'unverified',...(Number.isInteger(entry.http)?{http:entry.http}:{})});
 rows.push({field:'contract.strict',status:strict?'verified':'blocked'});
 const complete=strict&&rows.every(row=>row.status==='verified'),summary=Object.fromEntries(['verified','missing','mismatch','unverified','blocked'].map(status=>[status,rows.filter(row=>row.status===status).length]));
 const identityFields=['function.name','function.environment','function.state','function.buildConfig.build','function.createTime','function.updateTime','previousBuild.name','previousBuild.status','previousBuild.serviceAccount','previousBuild.images','previousBuild.resolvedSource.bucket','previousBuild.resolvedSource.object','previousBuild.resolvedSource.generation','run.resource','run.http','run.rpcStatus','run.errorInfo','operations.complete','operations.noPendingTarget'];
 const recreationBlocks=rows.filter(row=>(identityFields.includes(row.field)||row.field.startsWith('read.'))&&row.status!=='verified');
 return {mode:'READ_ONLY_RECOVERY_DIAGNOSTIC',target:id.FUNCTION,previousBuild:PREVIOUS_BUILD,releaseHash,summary,checks:rows.filter(row=>row.status!=='verified'),update:{status:complete?'preconditions-complete':'blocked',authorized:false,recoveryHash:null},recreation:{status:'PROPOSAL_ONLY',metadataStatus:recreationBlocks.length?'blocked':'identity-and-state-verifiable',blockingChecks:recreationBlocks,executable:false,deleteAuthorized:false,createAuthorized:false,dataAbsence:'NOT_INSPECTED',permissions:'DELETE_AND_CREATE_NOT_CHECKED',preserve:['Firestore','Storage objects/buckets','Auth','IAM','images/builds'],requires:'Separate review and delete/create approvals; no data absence or previous runtime identity inferred.'},notice:'Missing is not incorrect. Only failing/unknown checks are listed; verified counts are summarized. No raw metadata, tokens, environment values or complete API JSON. Diagnostic is never deployment permission.'};
}
async function diagnose({env=process.env,read=()=>readLive({diagnostic:true})}={}){g.closed(settings,client,env);const release=g.prepare({env});return diagnoseSnapshot(await read(),release.releaseHash);}
async function inspect({env=process.env,read=readLive}={}){g.closed(settings,client,env);const release=g.prepare({env});return report(await read(),release);}
const executeDefault=(program,args,opts)=>execFileSync(program,args,opts);
function checkCli(execute,env){
 const sdk=JSON.parse(execute('gcloud',['version','--format=json'],{env,encoding:'utf8'}));if(sdk['Google Cloud SDK']!==g.SDK_VERSION)throw Error('Versión gcloud no revisada.');
 const cfg=JSON.parse(execute('gcloud',['config','list','--format=json'],{env,encoding:'utf8'}));if(Object.values(cfg.api_endpoint_overrides||{}).some(Boolean)||['credential_file_override','access_token_file','impersonate_service_account'].some(k=>cfg.auth?.[k])||[true,'true','True'].includes(cfg.core?.log_http))throw Error('Configuración CLI con overrides/impersonación/trazas.');
}
async function recover({env=process.env,nodeVersion=process.versions.node,execute=executeDefault,read=readLive}={}){
 if(settings.deploymentAuthorized!==true)throw Error('Autorización de repositorio cerrada.');g.closed(settings,client,env);
 if(nodeVersion.split('.')[0]!=='22'||env.FULLHOUSE_AUTHORIZE_FAILED_RECOVERY!==id.PROJECT||env.FULLHOUSE_RECOVERY_EXCLUSIVE_WINDOW!==id.PROJECT)throw Error('Falta Node22, autorización independiente o declaración de ventana exclusiva.');
 if(!['FULLHOUSE_APPROVED_GCLOUD_RELEASE','FULLHOUSE_APPROVED_FAILED_RECOVERY'].every(k=>/^[a-f0-9]{64}$/.test(env[k]||'')))throw Error('Faltan hashes completos de release e inspección aprobadas.');
 checkCli(execute,env);const release=g.prepare({env});g.verifyPlan(release);if(release.releaseHash!==env.FULLHOUSE_APPROVED_GCLOUD_RELEASE)throw Error('Release distinta de la aprobada; no se sube ni actualiza.');
 const before=await read(),proof=seal(before,release);if(proof.recoveryHash!==env.FULLHOUSE_APPROVED_FAILED_RECOVERY)throw Error('La inspección/recurso/control cambió respecto de lo aprobado.');
 // Compare the entire inspected metadata twice; no file supplied by the caller
 // substitutes for live reads in the CLI. There is still no cross-API CAS.
 const last=await read();if(seal(last,release).recoveryHash!==proof.recoveryHash)throw Error('Estado modificado antes de actualizar; no se ejecuta el deploy.');g.verifyPlan(release);
 const opts={encoding:'utf8',env:{...env,CLOUDSDK_CORE_DISABLE_PROMPTS:'1',CLOUDSDK_CORE_DISABLE_USAGE_REPORTING:'1',CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK:'1'}};
 try{
  const fn=JSON.parse(execute('gcloud',release.args,opts));if(fn.createTime!==before.fn.createTime||!owned('builds/[A-Za-z0-9_-]+',fn.buildConfig?.build)||fn.buildConfig.build.endsWith('/'+PREVIOUS_BUILD))throw Error('Identidad de actualización/build nuevo no confirmados.');
  const build=JSON.parse(execute('gcloud',['builds','describe',fn.buildConfig.build.split('/').pop(),`--project=${id.PROJECT}`,`--billing-project=${id.PROJECT}`,`--region=${id.REGION}`,'--format=json'],opts));
  const invoker=JSON.parse(execute('gcloud',['run','services','get-iam-policy','remotev1',`--project=${id.PROJECT}`,`--billing-project=${id.PROJECT}`,`--region=${id.REGION}`,'--format=json'],opts));
  return {...g.verifyReadback({fn,build,invoker,plan:release}),mode:'CLOSED_RECOVERY_METADATA_VERIFIED',recoveryHash:proof.recoveryHash,previousBuild:PREVIOUS_BUILD,notice:'Requires real closed Auth/App Check tests; users remain disabled.'};
 }catch{throw Error('Recuperación interrumpida/fallida o confirmación incierta: pueden existir ZIP/build/revisión/servicio. Inspeccionar; no reintentar, eliminar ni anunciar rollback automático.');}
}
module.exports={PREVIOUS_BUILD,REQUIRED,RUN,canonical,assertRecoveryAudit,assertSnapshot,seal,report,readLive,inspect,diagnoseSnapshot,diagnose,recover};
if(require.main===module){const args=process.argv.slice(2);(async()=>{if(!args.length)return console.log(JSON.stringify({mode:'PLAN_ONLY',target:id.FUNCTION,state:'FAILED',previousBuild:PREVIOUS_BUILD,diagnose:'--diagnose: all read-only preconditions, structured JSON even when blocked',inspect:'--inspect: live metadata reads only',recover:'--recover: separately authorized exclusive trial, exact release + inspection hashes',limitations:'No atomic CAS; gcloud deploy is upsert. No automatic cleanup/retry. Backend/client stay disabled.'},null,2));if(args.length===1&&args[0]==='--diagnose'){const result=await diagnose();console.log(JSON.stringify(result,null,2));if(result.update.status==='blocked')process.exitCode=2;return;}if(args.length===1&&args[0]==='--inspect')return console.log(JSON.stringify(await inspect(),null,2));if(args.length===1&&args[0]==='--recover')return console.log(JSON.stringify(await recover(),null,2));throw Error('Solo plan, --diagnose, --inspect o --recover; no flags libres ni destinos alternativos.');})().catch(e=>{console.error(e.message);process.exitCode=2;});}
