'use strict';
// Closed-release preparation; only deployClosed() can invoke a mutating command.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const identity=require('./remote-staging-build-identity.cjs'),settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');
const root=path.resolve(__dirname,'..'),SDK_VERSION='592.0.0',CPU='0.3333',OUT=path.join(root,'dist-remote-gcloud-closed');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ENV=Object.freeze({FULLHOUSE_REMOTE_STAGING_ENABLED:'0',FULLHOUSE_STAGING_TEST_UIDS:'',FIREBASE_CONFIG:JSON.stringify({projectId:identity.PROJECT,storageBucket:settings.bucket}),LOG_EXECUTION_ID:'true'});
function closed(s=settings,c=client,env=process.env){
 require('./probe-remote-staging-runtime.cjs').closed(s,c,env);
 if(s.remoteEnabled!==false||c.enabled!==false||c.appCheckSiteKey!==null)throw Error('Backend y cliente deben permanecer cerrados.');
 for(const [k,v]of Object.entries(env))if(v&&(/EMULATOR/.test(k)||/^FIREBASE_DEBUG|^CLOUDSDK_API_ENDPOINT_OVERRIDES_|^CLOUDSDK_AUTH_|^GOCLOUD_|^PARITY_|^GCLOUD_DUMP_/.test(k)||['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','CLOUDSDK_CORE_LOG_HTTP'].includes(k)))throw Error('Entorno de credenciales/endpoints/depuración no permitido.');
 if(env.FULLHOUSE_REMOTE_STAGING_ENABLED&&env.FULLHOUSE_REMOTE_STAGING_ENABLED!=='0'||env.FULLHOUSE_STAGING_TEST_UIDS)throw Error('No se permite activar cuentas o backend en un deploy cerrado.');
}
function expectedFiles(){const sources=require('./build-remote-staging.cjs').sources;return [...Object.keys(sources),'build.json','.gcloudignore'];}
function assertDirectory(dir,allowed){
 if(fs.existsSync(dir)){if(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw Error('Directorio de artefacto incompatible.');for(const name of fs.readdirSync(dir))if(!allowed.includes(name)||!fs.lstatSync(path.join(dir,name)).isFile()||fs.lstatSync(path.join(dir,name)).isSymbolicLink())throw Error('Artefacto con archivo ajeno/enlace: se conserva sin eliminar.');}
}
function prepare({out=OUT,env=process.env}={}){
 closed(settings,client,env);if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'remote-staging/settings.json'))))!==JSON.stringify(settings))throw Error('Configuración cambiada; reinicia y revisa el proceso.');
 const sources=require('./build-remote-staging.cjs').sources;for(const source of Object.values(sources))if(!fs.lstatSync(path.join(root,source)).isFile()||fs.lstatSync(path.join(root,source)).isSymbolicLink())throw Error('Fuente no regular; no se prepara un artefacto.');
 const staging=require('./prepare-remote-staging-closed.cjs').prepare({env}),allowed=expectedFiles();require(path.join(staging.artifact,'policy.cjs')).settingsCheck(settings);assertDirectory(out,allowed);fs.mkdirSync(out,{recursive:true});
 for(const name of allowed.filter(x=>x!=='.gcloudignore'))fs.copyFileSync(path.join(staging.artifact,name),path.join(out,name));
 // SDK 592's ZIP walker tests the root "." against the ignore rules too.
 fs.writeFileSync(path.join(out,'.gcloudignore'),'*\n!.\n'+allowed.map(x=>'!'+x).join('\n')+'\n');
 const envFile=out+'.env.json',envBytes=JSON.stringify(ENV,null,2)+'\n';if(fs.existsSync(envFile)&&(fs.lstatSync(envFile).isSymbolicLink()||fs.readFileSync(envFile,'utf8')!==envBytes))throw Error('Archivo de variables ajeno: se conserva sin sobrescribir.');fs.writeFileSync(envFile,envBytes);
 return makePlan(out,Object.fromEntries(allowed.map(name=>[name,sha(fs.readFileSync(path.join(out,name)))])),envFile,envBytes);
}
function makePlan(out,hashes,envFile,envBytes){
 const releaseHash=sha(JSON.stringify({hashes,env:sha(envBytes),control:sha(fs.readFileSync(__filename)),sdk:SDK_VERSION,source:identity.SOURCE_BUCKET,repository:identity.REPOSITORY,builder:identity.BUILD_RESOURCE,cpu:CPU}));
 const args=['functions','deploy','remoteV1',`--project=${identity.PROJECT}`,`--billing-project=${identity.PROJECT}`,`--region=${identity.REGION}`,'--gen2','--runtime=nodejs22','--entry-point=remoteV1',`--source=${out}`,`--stage-bucket=${identity.SOURCE_BUCKET}`,`--build-service-account=${identity.BUILD_RESOURCE}`,`--docker-repository=${identity.REPOSITORY}`,`--run-service-account=${identity.RUNTIME}`,'--trigger-http','--memory=512Mi',`--cpu=${CPU}`,'--min-instances=0','--max-instances=1','--concurrency=1','--timeout=60s','--ingress-settings=all','--allow-unauthenticated',`--env-vars-file=${envFile}`,'--set-build-env-vars=GOOGLE_NODE_RUN_SCRIPTS=',`--update-labels=deployment-callable=true,firebase-functions-codebase=remote-staging-v1,fullhouse-release=${releaseHash.slice(0,32)}`,'--quiet','--format=json'];
 return {mode:'CLOSED_PLAN_ONLY',sdkVersion:SDK_VERSION,artifact:out,envFile,hashes,releaseHash,args,deploymentAuthorized:settings.deploymentAuthorized,remoteEnabled:settings.remoteEnabled,clientEnabled:client.enabled,notice:'Not a deployment or effective IAM proof. gcloud uploads a ZIP then creates/updates the function and its public Run invoker binding only after separate authorization.'};
}
function verifyPlan(plan,{expectedOut=OUT}={}){
 closed(settings,client,{});if(plan.artifact!==expectedOut||plan.envFile!==expectedOut+'.env.json')throw Error('Destino de plan no autorizado.');
 const allowed=expectedFiles();assertDirectory(plan.artifact,allowed);if(fs.readdirSync(plan.artifact).length!==allowed.length)throw Error('Artefacto incompleto.');
 const manifest=JSON.parse(fs.readFileSync(path.join(plan.artifact,'build.json'),'utf8')),sources=require('./build-remote-staging.cjs').sources;
 const sameKeys=(a,b)=>JSON.stringify(Object.keys(a||{}).sort())===JSON.stringify(b.sort());if(manifest.format!==1||!sameKeys(manifest.files,Object.keys(sources))||!sameKeys(manifest.configuration,['firebase.remote-staging.json','remote-staging/firestore.rules','remote/storage.rules']))throw Error('Manifiesto incompatible.');
 for(const [file,source]of Object.entries(sources))if(sha(fs.readFileSync(path.join(plan.artifact,file)))!==manifest.files[file]||sha(fs.readFileSync(path.join(root,source)))!==manifest.files[file])throw Error('Artefacto obsoleto/alterado; se conserva sin repararlo.');
 for(const [file,hash]of Object.entries(manifest.configuration))if(sha(fs.readFileSync(path.join(root,file)))!==hash)throw Error('Configuración cambió después del plan.');
 const envBytes=JSON.stringify(ENV,null,2)+'\n';if(fs.lstatSync(plan.envFile).isSymbolicLink()||fs.readFileSync(plan.envFile,'utf8')!==envBytes)throw Error('Variables alteradas.');
 if(fs.readFileSync(path.join(plan.artifact,'.gcloudignore'),'utf8')!=='*\n!.\n'+allowed.map(x=>'!'+x).join('\n')+'\n')throw Error('Allowlist alterada.');
 const hashes=Object.fromEntries(allowed.map(name=>[name,sha(fs.readFileSync(path.join(plan.artifact,name)))])),canonical=makePlan(plan.artifact,hashes,plan.envFile,envBytes);
 if(JSON.stringify(plan)!==JSON.stringify(canonical))throw Error('Plan alterado/obsoleto; no se autoriza un comando diferente.');return canonical;
}
function assessResources(v){
 const member='serviceAccount:'+identity.BUILD_EMAIL,has=(p,role)=>Array.isArray(p?.bindings)?p.bindings.some(b=>b.role===role&&!b.condition&&b.members?.includes(member)):false;
 const b=v.buildSources,r=v.buildRepository,privatePolicy=Array.isArray(v.buildSourcesPolicy?.bindings)&&!v.buildSourcesPolicy.bindings.some(x=>x.members?.some(m=>['allUsers','allAuthenticatedUsers'].includes(m)));
 const checks={sourceMetadata:b?.name===identity.SOURCE_BUCKET&&String(b.projectNumber)===identity.NUMBER&&b.location?.toLowerCase()===identity.REGION&&['STANDARD','REGIONAL'].includes(b.storageClass),sourcePrivacy:b?.iamConfiguration?.uniformBucketLevelAccess?.enabled===true&&b?.iamConfiguration?.publicAccessPrevention==='enforced'&&privatePolicy,sourceViewer:has(v.buildSourcesPolicy,'roles/storage.objectViewer'),repositoryMetadata:r?.name===identity.REPOSITORY&&r.format==='DOCKER'&&(!r.mode||r.mode==='STANDARD_REPOSITORY')&&!r.kmsKeyName,repositoryWriter:has(v.buildRepositoryPolicy,'roles/artifactregistry.writer'),loggingWriter:has(v.projectPolicy,'roles/logging.logWriter'),operatorCanUpload:v.operatorSourcePermissions?.permissions?.includes('storage.objects.create')===true};
 return {checks,basicInputsVerified:Object.values(checks).every(x=>x===true),sourceBucket:identity.SOURCE_BUCKET,repository:identity.REPOSITORY,runBuilderPermissions:Array.isArray(v.runBuilderRole?.includedPermissions)?v.runBuilderRole.includedPermissions:null,runBuilderRequiredByThisCheck:false,internalSources:'UNVERIFIED server-side copies. A closed trial can fail if its dedicated builder cannot read an internal source; never fallback or widen IAM automatically.',readyForDeploy:false};
}
function assertAudit(audit){
 if(audit?.project!==identity.PROJECT||audit.assessment?.directPolicy!=='matches-minimal-proposal'||audit.closedFunctionsPreparation?.apiCheck!=='all-observed-enabled'||audit.buildSelection?.dedicated?.identityVerified!==true||audit.buildSelection.dedicated.operatorActAsVerified!==true||audit.buildSelection.dedicated.ownerOrEditorDirectGrant!==false||audit.deployer?.runtimeActAsVerified!==true||audit.gcloudResources?.basicInputsVerified!==true)throw Error('Preflight incompleto/incompatible; no se permite subir ni desplegar.');
 for(const [kind,role]of [['functions','roles/cloudfunctions.serviceAgent'],['buildAgent','roles/cloudbuild.serviceAgent'],['run','roles/run.serviceAgent']])if(!audit.managedIdentities?.[kind]?.directProjectRoles?.some(b=>b.role===role&&!b.condition))throw Error('Agentes administrados no verificados; no se modifican permisos.');
 if(audit.function!==null||!audit.observations?.some(o=>o.name==='function'&&o.http===404)||!['cloudfunctions.functions.get','cloudfunctions.functions.create','cloudfunctions.functions.sourceCodeSet','serviceusage.services.use'].every(p=>audit.deployer.projectPermissions?.includes(p)))throw Error('Solo primer ensayo cerrado: revisar recurso y permisos de lectura/creación/subida/cuota, sin actualizar funciones existentes.');
}
function verifyReadback({fn,build,invoker,plan}){
 const owned=part=>new RegExp(`^projects/(?:${identity.PROJECT}|${identity.NUMBER})/locations/${identity.REGION}/${part}$`),builderNames=[identity.BUILD_RESOURCE,`projects/${identity.NUMBER}/serviceAccounts/${identity.BUILD_EMAIL}`];
 if(!owned('functions/remoteV1').test(fn?.name)||fn.environment!=='GEN_2'||fn.state!=='ACTIVE'||!builderNames.includes(fn.buildConfig?.serviceAccount)||fn.buildConfig.runtime!=='nodejs22'||fn.buildConfig.entryPoint!=='remoteV1'||fn.buildConfig.dockerRepository!==identity.REPOSITORY||fn.buildConfig.source?.storageSource?.bucket!==identity.SOURCE_BUCKET||fn.eventTrigger)throw Error('Función/identidades/repositorio/fuente no confirmados.');
 const s=fn.serviceConfig;if(s?.serviceAccountEmail!==identity.RUNTIME||s.availableMemory!=='512Mi'||s.availableCpu!==CPU||s.maxInstanceCount!==1||(s.minInstanceCount??0)!==0||s.maxInstanceRequestConcurrency!==1||s.timeoutSeconds!==60||s.ingressSettings!=='ALLOW_ALL'||!owned('services/remotev1').test(s.service))throw Error('Capacidad/endpoint/runtime no confirmados.');
 for(const [key,value]of Object.entries(ENV))if(s.environmentVariables?.[key]!==value)throw Error('Variables del backend cerrado no confirmadas.');
 if(fn.labels?.['fullhouse-release']!==plan.releaseHash.slice(0,32)||fn.labels?.['deployment-callable']!=='true')throw Error('Release/callable no confirmado.');
 if(!owned('builds/[A-Za-z0-9_-]+').test(fn.buildConfig.build)||build?.name!==fn.buildConfig.build||build.status!=='SUCCESS'||!builderNames.includes(build.serviceAccount))throw Error('Job Build o identidad efectiva no confirmados.');
 const imagePrefix=`${identity.REGION}-docker.pkg.dev/${identity.PROJECT}/fullhouse-remote-functions/`,images=build.results?.images,source=build.sourceProvenance?.resolvedStorageSource;
 if(!Array.isArray(images)||!images.length||images.some(x=>!x.name?.startsWith(imagePrefix)||!/^sha256:[a-f0-9]{64}$/.test(x.digest))||typeof source?.bucket!=='string'||!source.bucket||typeof source.object!=='string'||!source.object||typeof source.generation!=='string'||!(/^[1-9]\d*$/).test(source.generation))throw Error('Imágenes/digest/procedencia inmutable no confirmados.');
 if(!invoker?.bindings?.some(b=>b.role==='roles/run.invoker'&&!b.condition&&b.members?.includes('allUsers')))throw Error('Invocación callable pública no confirmada; no se modifica IAM.');
 return {mode:'CLOSED_RELEASE_METADATA_VERIFIED',releaseHash:plan.releaseHash,build:build.name,images:images.map(x=>({name:x.name,digest:x.digest})),resolvedSource:source,limits:'Requires real callable Auth/App Check and source ownership/byte inspection; metadata is not a user-data activation.'};
}
async function deployClosed({env=process.env,nodeVersion=process.versions.node,execute=(args,opts)=>execFileSync('gcloud',args,opts),readAudit}={}){
 // Authorization is checked before preparing files, obtaining tokens or any CLI call.
 if(settings.deploymentAuthorized!==true)throw Error('deploymentAuthorized:false: despliegue gcloud bloqueado.');
 closed(settings,client,env);if(nodeVersion.split('.')[0]!=='22'||env.FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY!==identity.PROJECT)throw Error('Falta Node 22 o autorización expresa de deploy cerrado.');
 if(!/^[a-f0-9]{64}$/.test(env.FULLHOUSE_APPROVED_GCLOUD_RELEASE||''))throw Error('Falta hash exacto de la release revisada por el propietario.');
 const sdk=JSON.parse(execute(['version','--format=json'],{encoding:'utf8',env}));if(sdk['Google Cloud SDK']!==SDK_VERSION)throw Error('Versión gcloud no revisada.');
 const cfg=JSON.parse(execute(['config','list','--format=json'],{encoding:'utf8',env}));if(Object.values(cfg.api_endpoint_overrides||{}).some(Boolean)||['credential_file_override','access_token_file','impersonate_service_account'].some(k=>cfg.auth?.[k])||[true,'true','True'].includes(cfg.core?.log_http))throw Error('Configuración CLI con overrides/impersonación/trazas: se detiene sin modificarla.');
 if(!readAudit){const iam=require('./audit-remote-staging-iam.cjs');readAudit=()=>iam.audit({token:iam.localToken()});}
 const audit=await readAudit();assertAudit(audit);const plan=prepare({env});verifyPlan(plan);if(plan.releaseHash!==env.FULLHOUSE_APPROVED_GCLOUD_RELEASE)throw Error('Release distinta de la aprobada; no se sube ni despliega.');
 const opts={encoding:'utf8',env:{...env,CLOUDSDK_CORE_DISABLE_PROMPTS:'1',CLOUDSDK_CORE_DISABLE_USAGE_REPORTING:'1',CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK:'1'}};
 try{const fn=JSON.parse(execute(plan.args,opts));if(!new RegExp(`^projects/(?:${identity.PROJECT}|${identity.NUMBER})/locations/${identity.REGION}/builds/[A-Za-z0-9_-]+$`).test(fn.buildConfig?.build))throw Error('Referencia de build no verificable.');
  const build=JSON.parse(execute(['builds','describe',fn.buildConfig.build.split('/').pop(),`--project=${identity.PROJECT}`,`--billing-project=${identity.PROJECT}`,`--region=${identity.REGION}`,'--format=json'],opts));
  const invoker=JSON.parse(execute(['run','services','get-iam-policy','remotev1',`--project=${identity.PROJECT}`,`--billing-project=${identity.PROJECT}`,`--region=${identity.REGION}`,'--format=json'],opts));return verifyReadback({fn,build,invoker,plan});}
 catch{throw Error('Deploy interrumpido/fallido: el ZIP, build o servicio podrían existir. Inspeccionar estado; no reintentar ni anunciar rollback automático.');}
}
module.exports={SDK_VERSION,CPU,OUT,ENV,closed,expectedFiles,prepare,verifyPlan,assessResources,assertAudit,verifyReadback,deployClosed};
if(require.main===module){const args=process.argv.slice(2);(async()=>{if(args.length===0)return console.log(JSON.stringify(prepare(),null,2));if(args.length===1&&args[0]==='--deploy')return console.log(JSON.stringify(await deployClosed(),null,2));throw Error('Solo plan local o --deploy con autorización independiente; no se admiten flags libres.');})().catch(e=>{console.error(e.message);process.exitCode=2;});}
