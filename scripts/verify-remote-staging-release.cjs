'use strict';
// Independent retrospective inspection. All Google API requests are GET.
// No deploy/delete/update, IAM mutation, user data read, or callable invocation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const g=require('./remote-staging-gcloud.cjs'),id=require('./remote-staging-build-identity.cjs');
const {MAX_ZIP,verifySourceZip}=require('./remote-staging-source-zip.cjs');
const {canonical}=require('./remote-staging-recovery.cjs');
const shapes=require('./remote-staging-release-shapes.cjs');
const EXPECTED=Object.freeze({
 releaseHash:'1e930e8ac0ef2ea68ce707abc013e07e4f31d53532370b0e72a3958195dfd1af',
 buildId:'b378e9e0-e8f6-4604-814e-6dd3eef33b45',
 bucket:`gcf-v2-sources-${id.NUMBER}-${id.REGION}`,
 object:'remoteV1/function-source.zip',generation:'1795844784903748'
});
const LOCATION=`projects/${id.PROJECT}/locations/${id.REGION}`;
const FUNCTION_URL=`https://cloudfunctions.googleapis.com/v2/${id.FUNCTION}`;
const RUN_BASE=`https://${id.REGION}-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${id.PROJECT}`;
const SERVICE_URL=`${RUN_BASE}/services/remotev1`;
const BUILD_URL=`https://cloudbuild.googleapis.com/v1/${LOCATION}/builds/${EXPECTED.buildId}`;
const POLICY_URL=`https://run.googleapis.com/v2/${LOCATION}/services/remotev1:getIamPolicy`;
const IMAGE_PREFIX=`${id.REGION}-docker.pkg.dev/${id.PROJECT}/fullhouse-remote-functions/`;
const owned=(kind,value)=>new RegExp(`^projects/(?:${id.PROJECT}|${id.NUMBER})/locations/${id.REGION}/${kind}$`).test(value||'');
const builder=value=>[id.BUILD_RESOURCE,`projects/${id.NUMBER}/serviceAccounts/${id.BUILD_EMAIL}`].includes(value);
const namespace=value=>[id.PROJECT,id.NUMBER].includes(value);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const revisionName=value=>typeof value==='string'&&/^remotev1-[a-z0-9-]{1,63}$/.test(value)?value:null;
function selectedRevision(service){
 const traffic=service?.status?.traffic;
 return Array.isArray(traffic)&&traffic.length===1&&traffic[0]?.percent===100&&!traffic[0].tag?revisionName(traffic[0].revisionName):null;
}
function imageIdentity(value){
 if(typeof value!=='string'||!value.startsWith(IMAGE_PREFIX))return null;
 const match=/^([a-z0-9][a-z0-9._/-]*)@(sha256:[a-f0-9]{64})$/.exec(value.slice(IMAGE_PREFIX.length));
 if(!match||match[1].split('/').some(x=>!x||x==='.'||x==='..'))return null;
 return {uri:value,digest:match[2],name:`${id.REPOSITORY}/dockerImages/${match[1]}@${match[2]}`,
  url:`https://artifactregistry.googleapis.com/v1/${id.REPOSITORY}/dockerImages/${encodeURIComponent(match[1]+'@'+match[2])}`};
}
function artifactName(value){
 const prefix=new RegExp(`^projects/(?:${id.PROJECT}|${id.NUMBER})/locations/${id.REGION}/repositories/fullhouse-remote-functions/dockerImages/`);
 if(typeof value!=='string'||!prefix.test(value))return null;
 try{return id.REPOSITORY+'/dockerImages/'+decodeURIComponent(value.replace(prefix,''));}catch{return null;}
}
function functionRevision(value,revision){
 return !!revision&&(value===revision||owned('services/remotev1/revisions/'+revision,value)||
  new RegExp(`^namespaces/(?:${id.PROJECT}|${id.NUMBER})/revisions/${revision}$`).test(value||''));
}
function sourceIdentity(fn){
 const s=fn?.buildConfig?.sourceProvenance?.resolvedStorageSource;
 return s?.bucket===EXPECTED.bucket&&s.object===EXPECTED.object&&s.generation===EXPECTED.generation?{bucket:s.bucket,object:s.object,generation:s.generation}:null;
}
function sourceBucketValid(v){return v?.name===EXPECTED.bucket&&String(v.projectNumber)===id.NUMBER&&typeof v.location==='string'&&v.location.toLowerCase()===id.REGION;}
function sourceObjectValid(v){return v?.bucket===EXPECTED.bucket&&v.name===EXPECTED.object&&v.generation===EXPECTED.generation&&typeof v.size==='string'&&/^[1-9]\d*$/.test(v.size)&&Number(v.size)<=MAX_ZIP;}
function planned(){return {
 mode:'READ_ONLY_PLAN',project:id.PROJECT,function:id.FUNCTION,...EXPECTED,
 command:'npm run verify:remote-staging:release -- --run',
 reads:'GET exact Function, Build, Run service/revision/policy, source bucket + exact ZIP generation, Artifact Registry digest; reread controls.',
 writes:'Local ignored release artifact only. No cloud writes or endpoint invocation.',
 limits:'Missing evidence blocks verification, never triggers deploy/delete/retry. Auth/App Check live tests remain pending.'
};}
function localRelease(){
 const plan=g.prepare({env:{}});g.verifyPlan(plan);
 if(plan.releaseHash!==EXPECTED.releaseHash)throw Error('La release local difiere del hash aprobado; no se consulta la nube.');
 return {releaseHash:plan.releaseHash,files:Object.fromEntries(Object.entries(plan.hashes).map(([name,hash])=>[name,{sha256:hash,size:fs.statSync(path.join(plan.artifact,name)).size}]))};
}
async function readEvidence({token,fetcher=fetch}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Falta sesión local autorizada.');
 const observations=[];
 async function get(name,url,binary=false){
  let response;
  try{
   response=await fetcher(url,{method:'GET',headers:{authorization:'Bearer '+token,'x-goog-user-project':id.PROJECT},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000)});
   if(!response.ok){observations.push({name,status:'unverified',http:response.status});return null;}
   const max=binary?MAX_ZIP:2*1024*1024,declared=response.headers.get('content-length');
   if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))throw Error('size');
   const reader=response.body.getReader(),chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('size');chunks.push(Buffer.from(value));}}
   finally{await reader.cancel().catch(()=>{});}
   const bytes=Buffer.concat(chunks),value=binary?bytes:JSON.parse(bytes.toString('utf8'));
   observations.push({name,status:'verified',http:response.status});return value;
  }catch{observations.push({name,status:'unverified',...(response?{http:response.status}:{}),reason:'Lectura no disponible, interrumpida, inválida o fuera del límite.'});return null;}
 }
 const project=await get('project',`https://cloudresourcemanager.googleapis.com/v3/projects/${id.PROJECT}`);
 const evidence={project,observations};
 if(project?.projectId!==id.PROJECT||project.name!==`projects/${id.NUMBER}`)return evidence;
 const [fn,build,service,policy]=await Promise.all([get('function',FUNCTION_URL),get('build',BUILD_URL),get('runService',SERVICE_URL),get('runPolicy',POLICY_URL)]);
 Object.assign(evidence,{fn,build,service,policy});
 const revision=selectedRevision(service),source=sourceIdentity(fn);
 const jobs=[];
 if(revision)jobs.push(get('runRevision',`${RUN_BASE}/revisions/${revision}`).then(v=>{evidence.revision=v;}));
 if(source){
  const base=`https://storage.googleapis.com/storage/v1/b/${source.bucket}`;
  const object=`${base}/o/${encodeURIComponent(source.object)}?generation=${source.generation}`;
  jobs.push((async()=>{
   [evidence.bucket,evidence.object]=await Promise.all([get('sourceBucket',base+'?projection=noAcl'),get('sourceObject',object)]);
   // Check ownership/generation before downloading even this exact code ZIP.
   if(sourceBucketValid(evidence.bucket)&&sourceObjectValid(evidence.object))evidence.zip=await get('sourceBytes',object+'&alt=media',true);
  })());
 }
 await Promise.all(jobs);
 const image=imageIdentity(evidence.revision?.status?.imageDigest);
 if(image)evidence.image=await get('artifactImage',image.url);
 // No cross-service snapshot transaction is possible. Detect observed changes;
 // do not claim exclusion of a writer that mutates and restores between reads.
 const [endFn,endService,endRevision,endPolicy]=await Promise.all([
  get('functionAgain',FUNCTION_URL),get('runServiceAgain',SERVICE_URL),
  revision?get('runRevisionAgain',`${RUN_BASE}/revisions/${revision}`):Promise.resolve(null),get('runPolicyAgain',POLICY_URL)
 ]);
 evidence.end={fn:endFn,service:endService,revision:endRevision,policy:endPolicy};return evidence;
}
function diagnose(e,local){
 const checks=[];
 const check=(name,value,test,detail,required=true)=>{
  let status='missing';
  if(value!==undefined&&value!==null){try{status=test(value)?'verified':'mismatch';}catch{status='unverified';}}
  checks.push({name,status,required,detail});return status==='verified';
 };
 const note=(name,status,detail,required=false)=>checks.push({name,status,required,detail});
 const f=e.fn,b=f?.buildConfig,c=f?.serviceConfig,s=e.service,r=e.revision,rs=r?.spec,container=rs?.containers?.[0];
 check('local.release',local?.releaseHash,v=>v===EXPECTED.releaseHash,'SHA-256 completo del plan local, no del ZIP.');
 check('project',e.project,p=>p.projectId===id.PROJECT&&p.name===`projects/${id.NUMBER}`,'Proyecto y número exactos.');
 check('function.identity',f,v=>owned('functions/remoteV1',v.name)&&v.environment==='GEN_2'&&v.state==='ACTIVE'&&!v.eventTrigger,'GEN2 remoteV1 ACTIVE sin trigger de eventos.');
 check('function.build',b,v=>owned('builds/'+EXPECTED.buildId,v.build)&&v.runtime==='nodejs22'&&v.entryPoint==='remoteV1'&&builder(v.serviceAccount)&&v.dockerRepository===id.REPOSITORY,'Build aprobado, Node22, entrypoint, builder y repositorio exactos.');
 check('function.buildEnvironment',b?.environmentVariables,v=>canonical(v)===canonical({GOOGLE_NODE_RUN_SCRIPTS:''}),'Sin scripts de build adicionales.');
 check('function.labels',f?.labels,v=>v['fullhouse-release']===EXPECTED.releaseHash.slice(0,32)&&v['deployment-callable']==='true'&&v['firebase-functions-codebase']==='remote-staging-v1','Labels solo corroboran; nunca prueban bytes.');
 check('function.capacity',c,v=>v.serviceAccountEmail===id.RUNTIME&&owned('services/remotev1',v.service)&&v.availableMemory==='512Mi'&&v.availableCpu===g.CPU&&v.maxInstanceCount===1&&(v.minInstanceCount??0)===0&&v.maxInstanceRequestConcurrency===1&&v.timeoutSeconds===60&&v.ingressSettings==='ALLOW_ALL'&&v.allTrafficOnLatestRevision!==false,'Runtime dedicado, capacidad y endpoint aprobados.');
 check('function.environment',c?.environmentVariables,v=>canonical(v)===canonical(g.ENV),'Cuatro variables exactas, backend cerrado y UIDs vacíos.');
 check('function.extraConfig',f,v=>!v.kmsKeyName&&!v.upgradeInfo&&!b?.workerPool&&!b?.source?.repoSource&&(!b?.dockerRegistry||b.dockerRegistry==='ARTIFACT_REGISTRY')&&!c?.vpcConnector&&!c?.vpcConnectorEgressSettings&&!c?.directVpcNetworkInterface?.length&&!c?.secretEnvironmentVariables?.length&&!c?.secretVolumes?.length&&!c?.binaryAuthorizationPolicy,'Sin configuración adicional no autorizada.');
 check('build.identity',e.build,v=>owned('builds/'+EXPECTED.buildId,v.name)&&v.id===EXPECTED.buildId&&v.projectId===id.PROJECT&&v.status==='SUCCESS'&&builder(v.serviceAccount),'Job exacto SUCCESS ejecutado por builder dedicado.');
 const src=sourceIdentity(f),raw=b?.sourceProvenance?.resolvedStorageSource;
 check('source.functionProvenance',raw,v=>!!sourceIdentity(f),'Referencia output-only exacta observada en issue #34, incluida generación.');
 check('source.functionInput',b?.source?.storageSource,v=>!!src&&v.bucket===src.bucket&&v.object===src.object&&(v.generation===undefined||String(v.generation)===src.generation),'Fuente declarada correlacionada con fuente resuelta.');
 check('source.bucket',e.bucket,sourceBucketValid,'Bucket administrado del proyecto/región; no se consulta el bucket de usuarios.');
 check('source.object',e.object,sourceObjectValid,'Objeto exacto y generación inmutable, tamaño limitado.');
 if(e.zip&&local?.files&&src){
  try{
   const result=verifySourceZip(e.zip,local.files);
   const md5=crypto.createHash('md5').update(e.zip).digest('base64');
   check('source.bytes',e.object,v=>String(v.size)===String(result.zipBytes)&&(!v.md5Hash||v.md5Hash===md5),'Todos los nombres/tamaños/SHA-256 internos coinciden con la release aprobada.');
   e={...e,sourceVerification:result};
  }catch{note('source.bytes','mismatch','ZIP inválido/ajeno/truncado o bytes distintos del artefacto aprobado.',true);}
 }else note('source.bytes','unverified','Sin bytes de la generación exacta no se demuestra equivalencia con el código aprobado.',true);
 const revision=selectedRevision(s),ready=v=>v?.status?.conditions?.some(x=>x.type==='Ready'&&x.status==='True');
 check('run.service',s,v=>v.metadata?.name==='remotev1'&&namespace(v.metadata.namespace)&&v.metadata.uid&&v.metadata.generation!==undefined&&String(v.status?.observedGeneration)===String(v.metadata.generation)&&['Ready','ConfigurationsReady','RoutesReady'].every(t=>v.status?.conditions?.some(x=>x.type===t&&x.status==='True')),'Servicio reconciliado y tres condiciones Ready.');
 check('run.traffic',s?.status,v=>!!revision&&v.latestReadyRevisionName===revision&&v.latestCreatedRevisionName===revision,'Única revisión resuelta con 100% del tráfico, sin tags/split ni revisión nueva pendiente.');
 check('run.revision',r,v=>!!revision&&v.metadata?.name===revision&&namespace(v.metadata.namespace)&&v.metadata.uid&&v.metadata.labels?.['serving.knative.dev/service']==='remotev1'&&v.metadata.generation!==undefined&&String(v.status?.observedGeneration)===String(v.metadata.generation)&&ready(v),'Revisión inmutable Ready del servicio esperado.');
 check('provenance.functionRevision',c?.revision,v=>functionRevision(v,revision),'Asociación output-only Function.buildConfig.build → Function.serviceConfig.revision → revisión sirviendo tráfico.');
 const annotations=r?.metadata?.annotations;
 const buildAnnotations={};
 for(const key of ['run.googleapis.com/build-name','run.googleapis.com/build-id']){
  buildAnnotations[key]=shapes.buildAnnotation(key,annotations?.[key],EXPECTED.buildId,{containerName:container?.name});
  if(annotations?.[key]!==undefined)check('provenance.'+key,annotations[key],()=>buildAnnotations[key].status==='verified','UUID o recurso de la misma compilación y ámbito; desglose en diagnostics.buildAnnotations.');
 }
 const image=imageIdentity(r?.status?.imageDigest);
 check('image.runDigest',r?.status?.imageDigest,v=>!!imageIdentity(v),'Digest resuelto de la revisión, en repositorio aprobado; no se resuelven tags.');
 check('image.revisionInput',container?.image,v=>!!image&&(v===image.uri||v.startsWith(IMAGE_PREFIX)&&!v.includes('@')&&v.replace(/:[^/:]+$/,'')===image.uri.split('@')[0]),'Imagen declarada de la revisión corresponde al mismo artefacto; solo el digest resuelto prueba identidad.');
 check('image.artifactRegistry',e.image,v=>!!image&&v.uri===image.uri&&artifactName(v.name)===image.name&&Number(v.imageSizeBytes)>0,'Mismo recurso DockerImage y URI/digest en Artifact Registry.');
 check('run.runtime',rs,v=>v.serviceAccountName===id.RUNTIME&&v.containerConcurrency===1&&v.timeoutSeconds===60&&v.containers?.length===1&&!v.volumes?.length,'Identidad/capacidad de la revisión efectiva, sin sidecars ni volúmenes.');
 check('run.resources',container?.resources?.limits,v=>['512Mi','536870912'].includes(v.memory)&&['0.3333','333.3m'].includes(v.cpu)&&Object.keys(v).every(k=>['memory','cpu'].includes(k)),'512 MiB y CPU 0.3333, sin recursos adicionales.');
 check('run.scaling',annotations,v=>v['autoscaling.knative.dev/maxScale']==='1'&&(v['autoscaling.knative.dev/minScale']??'0')==='0','Cero instancias mínimas y máximo uno.');
 const singleReadyRevision=['function.identity','function.capacity','run.service','run.traffic','run.revision','provenance.functionRevision'].every(name=>checks.some(c=>c.name===name&&c.status==='verified'));
 const scaling=shapes.scaling(s,r,c,singleReadyRevision);
 check('run.serviceScaling',s?.metadata?.annotations,()=>scaling.status==='verified','Escalado automático y límites min0/max1 demostrados; desglose en diagnostics.scaling.');
 check('run.ingress',s?.metadata?.annotations,v=>v['run.googleapis.com/ingress']==='all'&&v['run.googleapis.com/invoker-iam-disabled']!=='true','Ingress aprobado; comprobación IAM del servicio no deshabilitada.');
 const vars=container?.env;
 const environment=shapes.environment(vars,g.ENV,revision);
 check('run.environment',vars,()=>environment.status==='verified','Variables esperadas y de plataforma verificadas por nombre; desconocidas/indirectas/peligrosas bloqueadas. Véase diagnostics.environment.');
 check('run.invoker',e.policy,v=>Array.isArray(v.bindings)&&v.bindings.some(x=>x.role==='roles/run.invoker'&&!x.condition&&x.members?.includes('allUsers'))&&!v.bindings.some(x=>x.members?.some(m=>['allUsers','allAuthenticatedUsers'].includes(m))&&x.role!=='roles/run.invoker'),'Callable público solo como invoker del servicio; Auth/App Check en código.');
 for(const name of ['fn','service','revision','policy'])check('stable.'+name,e.end?.[name],v=>e[name]!=null&&canonical(v)===canonical(e[name]),'Misma respuesta al releer; sin snapshot transaccional entre servicios.');
 // Build output omissions remain visible. Never invent results.images or SLSA.
 if(!e.build?.results?.images?.length)note('build.results.images','missing','No devuelto. Imagen corroborada mediante Run + Artifact Registry.');
 else check('build.results.images',e.build.results.images,v=>!!image&&v.every(x=>x.name+'@'+x.digest===image.uri),'Si se devuelve, no se ignora una imagen contradictoria.');
 const buildSource=e.build?.sourceProvenance?.resolvedStorageSource;
 if(buildSource)check('build.sourceProvenance',buildSource,v=>!!src&&v.bucket===src.bucket&&v.object===src.object&&String(v.generation)===src.generation,'Si se devuelve, debe coincidir con la fuente resuelta de Functions.');
 else note('build.sourceProvenance','missing','No devuelto; se usa sourceProvenance output-only de Cloud Functions y bytes exactos.');
 const buildInput=e.build?.source?.storageSource;
 if(buildInput)check('build.sourceInput',buildInput,v=>!!src&&v.bucket===src.bucket&&v.object===src.object&&(v.generation===undefined||String(v.generation)===src.generation),'Fuente de Cloud Build, si se devuelve, no debe contradecir la resuelta de Functions.');
 note('provenance.signedAttestation','not equivalent','Cadena de metadata oficial y bytes; no atestación firmada SLSA ni build reproducible.');
 note('auth.appCheck','unverified','Pruebas reales negativas de Auth/App Check pendientes; no se invoca el endpoint.');
 const blocked=checks.filter(x=>x.required&&x.status!=='verified');
 return {mode:'READ_ONLY_RELEASE_DIAGNOSTIC',verificationScope:'official-control-plane-links-and-approved-source-bytes',project:id.PROJECT,function:id.FUNCTION,
  releaseHash:EXPECTED.releaseHash,buildId:EXPECTED.buildId,status:blocked.length?'blocked':'verified',
  checks,counts:Object.fromEntries(['verified','missing','mismatch','unverified','not equivalent'].map(k=>[k,checks.filter(x=>x.status===k).length])),
  blocked:blocked.map(x=>x.name),observations:e.observations||[],
  diagnostics:{buildAnnotations,scaling,environment},
  evidence:{revision:revision||null,image:image?.uri||null,source:src,sourceVerification:e.sourceVerification||null},
  remoteEnabled:false,clientEnabled:false,userActivationAuthorized:false,
  next:blocked.length?'Revisar todos los campos bloqueados; no desplegar/eliminar/reintentar.':'Solo revisión del propietario y autorización separada de pruebas negativas Auth/App Check.',
  limits:['Confía en respuestas autenticadas del control plane de Google; no protege frente a un administrador malicioso.',
   'Lecturas iniciales/finales detectan cambios observados, no excluyen carreras ABA ni cambios posteriores.',
   'No certifica permisos efectivos de usuarios, datos, costes o disponibilidad futura. No cambia la release ni el verificador de despliegue.']};
}
async function inspect({env=process.env,execute=(args,opts)=>execFileSync('gcloud',args,opts),getToken=require('./audit-remote-staging-iam.cjs').localToken,fetcher=fetch}={}){
 g.closed(undefined,undefined,env);
 const opts={encoding:'utf8',env,stdio:['ignore','pipe','pipe'],timeout:20000,maxBuffer:1024*1024};
 const version=JSON.parse(execute(['version','--format=json'],opts));
 if(version['Google Cloud SDK']!==g.SDK_VERSION)throw Error('SDK no revisado; no se solicita token.');
 const cfg=JSON.parse(execute(['config','list','--format=json'],opts));
 if(Object.values(cfg.api_endpoint_overrides||{}).some(Boolean)||['credential_file_override','access_token_file','impersonate_service_account'].some(k=>cfg.auth?.[k])||[true,'true','True'].includes(cfg.core?.log_http))throw Error('Perfil CLI con overrides/impersonación/trazas; no se solicita token.');
 const local=localRelease(),token=getToken();return diagnose(await readEvidence({token,fetcher}),local);
}
module.exports={EXPECTED,FUNCTION_URL,SERVICE_URL,RUN_BASE,BUILD_URL,POLICY_URL,imageIdentity,sourceIdentity,selectedRevision,planned,localRelease,readEvidence,diagnose,inspect};
if(require.main===module){(async()=>{
 const args=process.argv.slice(2);
 if(!args.length)return console.log(JSON.stringify(planned(),null,2));
 if(args.length!==1||args[0]!=='--run')throw Error('Solo plan local o --run de lectura; sin flags de mutación.');
 const result=await inspect();console.log(JSON.stringify(result,null,2));if(result.status!=='verified')process.exitCode=2;
})().catch(()=>{console.error('STOPPED: precondiciones locales/CLI/release no verificadas; no se modificó ningún recurso. Revise Node22/SDK592, perfil local y hash aprobado.');process.exitCode=2;});}
