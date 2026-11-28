'use strict';
// Separate single-function DELETE and first-create phases. No mutation is chained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const g=require('./remote-staging-gcloud.cjs'),id=require('./remote-staging-build-identity.cjs'),r=require('./remote-staging-recovery.cjs'),iam=require('./audit-remote-staging-iam.cjs');
const settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json'),{canonical}=r;
const LOCATION=`projects/${id.PROJECT}/locations/${id.REGION}`,FUNCTION_URL=`https://cloudfunctions.googleapis.com/v2/${id.FUNCTION}`,RUN=`${LOCATION}/services/remotev1`,MANAGED_SOURCE=`gcf-v2-sources-${id.NUMBER}-${id.REGION}`;
const COMMON=['cloudfunctions.functions.get','cloudfunctions.operations.list','run.services.get','serviceusage.services.use'];
const DELETE_PERMISSIONS=[...COMMON,'cloudfunctions.functions.delete','cloudfunctions.operations.get','cloudbuild.builds.get'];
const CREATE_PERMISSIONS=[...COMMON,'cloudfunctions.functions.create','cloudfunctions.functions.sourceCodeSet'];
const RECEIPTS=path.resolve(__dirname,'../dist-remote-gcloud-closed-delete-receipts');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),owned=(kind,value)=>new RegExp(`^projects/(?:${id.PROJECT}|${id.NUMBER})/locations/${id.REGION}/${kind}$`).test(value||'');
const absence=record=>record?.http===404&&record.rpcStatus==='NOT_FOUND'&&!record.reason;
function credentials(token){if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Sesión local autorizada no disponible.');return token;}
async function request(url,{token,method='GET',body,fetcher=fetch}={}){
 credentials(token);let response;
 try{
  response=await fetcher(url,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json','x-goog-user-project':id.PROJECT},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(response.ok)return {http:response.status||200,data:await response.json()};
  let error;try{error=(await response.json()).error;}catch{}
  const info=error?.details?.find?.(v=>v?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo');
  return {http:response.status,...(typeof error?.status==='string'&&/^[A-Z_]{1,64}$/.test(error.status)?{rpcStatus:error.status}:{}),...(typeof info?.reason==='string'&&/^[A-Z_]{1,64}$/.test(info.reason)?{reason:info.reason}:{})};
 }catch{return {http:response?.status||null,rpcStatus:'UNVERIFIED'};}
}
function sourceEvidence(fn,bucket){
 const value=fn?.buildConfig?.source?.storageSource,raw=value?.bucket,name=typeof raw==='string'&&/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(raw)?raw:null;
 const recognized=[id.SOURCE_BUCKET,MANAGED_SOURCE].includes(name),metadata=bucket?.data;
 const ownership=recognized&&bucket?.http===200&&metadata?.name===name&&String(metadata.projectNumber)===id.NUMBER&&typeof metadata.location==='string'&&metadata.location.toLowerCase()===id.REGION;
 const resolved=fn?.buildConfig?.sourceProvenance?.resolvedStorageSource;
 const correlated=ownership&&resolved?.bucket===name&&typeof value?.object==='string'&&!!value.object&&resolved.object===value.object&&/^[1-9]\d*$/.test(resolved.generation||'')&&(value.generation===undefined||String(value.generation)===String(resolved.generation));
 return {bucket:name,bucketStatus:raw===undefined?'NOT_RETURNED':name?'OBSERVED_NAME':'UNVERIFIED_FORMAT',classification:correlated?'FUNCTION_PROVENANCE_AND_BUCKET_VERIFIED':ownership?'OWNED_BUCKET_PRIOR_PROVENANCE_UNVERIFIED':recognized?'RECOGNIZED_NAME_OWNERSHIP_UNVERIFIED':'UNVERIFIED_PRESERVED',futureCreationSource:id.SOURCE_BUCKET,usedAsNewSource:false,usedAsDeletionTarget:false,bytesVerified:false};
}
function operationsValid(o){return o?.complete===true&&Array.isArray(o.items)&&!o.items.some(op=>!op||typeof op!=='object'||Array.isArray(op)||op.done!==undefined&&typeof op.done!=='boolean'||op.done!==true&&(typeof op.metadata?.target!=='string'||!/^projects\/[^/]+\/locations\/[^/]+\/functions\/[^/]+$/.test(op.metadata.target)||owned('functions/remoteV1',op.metadata.target)));}
async function readLive({token,fetcher=fetch,readCreateAudit,includeCreateAudit=true}={}){
 token=credentials(token??iam.localToken());const call=(url,options={})=>request(url,{token,fetcher,...options});
 const project=await call(`https://cloudresourcemanager.googleapis.com/v3/projects/${id.PROJECT}`);
 if(project.http!==200||project.data?.projectId!==id.PROJECT||project.data?.name!==`projects/${id.NUMBER}`)return {project};
 const permissions=await call(`https://cloudresourcemanager.googleapis.com/v1/projects/${id.PROJECT}:testIamPermissions`,{method:'POST',body:{permissions:[...new Set([...DELETE_PERMISSIONS,...CREATE_PERMISSIONS])]}});
 const fn=await call(FUNCTION_URL),runRaw=await call(`https://run.googleapis.com/v2/${RUN}`);
 // Run metadata can contain environment values. Its body is never retained.
 const run={http:runRaw.http,...(runRaw.rpcStatus?{rpcStatus:runRaw.rpcStatus}:{}),...(runRaw.reason?{reason:runRaw.reason}:{})};
 let previousBuild,sourceBucket,createAudit;
 if(fn.http===200){
  previousBuild=await call(`https://cloudbuild.googleapis.com/v1/${LOCATION}/builds/${r.PREVIOUS_BUILD}`);
  const bucket=fn.data?.buildConfig?.source?.storageSource?.bucket;
  // No arbitrary bucket or object queries. Names alone never attest provenance.
  if([id.SOURCE_BUCKET,MANAGED_SOURCE].includes(bucket))sourceBucket=await call(`https://storage.googleapis.com/storage/v1/b/${bucket}?projection=noAcl`);
 }else if(absence(fn)&&includeCreateAudit){
  try{createAudit=await (readCreateAudit||iam.audit)({token,fetcher});}catch{createAudit=undefined;}
 }
 const operations={complete:false,items:[]};let page='';const seen=new Set();
 for(let count=0;count<10;count++){
  const response=await call(`https://cloudfunctions.googleapis.com/v2/${LOCATION}/operations?pageSize=100${page?'&pageToken='+encodeURIComponent(page):''}`),data=response.data;
  if(response.http!==200||!data||typeof data!=='object'||Array.isArray(data)||data.unreachable?.length||data.operations!==undefined&&!Array.isArray(data.operations))break;
  operations.items.push(...(data.operations||[]));page=data.nextPageToken||'';if(!page){operations.complete=true;break;}if(typeof page!=='string'||seen.has(page))break;seen.add(page);
 }
 const recheck=await call(FUNCTION_URL);return {project,permissions,fn,run,previousBuild,sourceBucket,operations,recheck,...(createAudit?{createAudit}:{})};
}
function assess(s){
 const phase=s.fn?.http===200?'delete':absence(s.fn)?'create':'blocked',issues=[],add=(field,ok)=>{if(!ok)issues.push(field);};
 add('project.identity',s.project?.http===200&&s.project.data?.projectId===id.PROJECT&&s.project.data?.name===`projects/${id.NUMBER}`&&(!s.project.data.state||s.project.data.state==='ACTIVE'));
 const permissions=phase==='delete'?DELETE_PERMISSIONS:CREATE_PERMISSIONS;
 for(const p of permissions)add('permission.'+p,s.permissions?.http===200&&Array.isArray(s.permissions.data?.permissions)&&s.permissions.data.permissions.includes(p));
 add('run.notFound',absence(s.run));add('operations.completeAndIdle',operationsValid(s.operations));add('function.stableRead',!!s.fn&&!!s.recheck&&canonical(s.fn)===canonical(s.recheck));
 if(phase==='delete'){
  const f=s.fn.data,b=f?.buildConfig,old=s.previousBuild?.data;
  add('function.identity',owned('functions/remoteV1',f?.name)&&f.environment==='GEN_2'&&f.state==='FAILED');
  add('function.previousBuild',owned('builds/'+r.PREVIOUS_BUILD,b?.build));add('function.httpTrigger',!f?.eventTrigger);
  for(const key of ['createTime','updateTime'])add('function.'+key,typeof f?.[key]==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(f[key])&&Number.isFinite(Date.parse(f[key])));
  add('previousBuild.identityAndTerminalStatus',s.previousBuild?.http===200&&owned('builds/'+r.PREVIOUS_BUILD,old?.name)&&(!old.id||old.id===r.PREVIOUS_BUILD)&&(!old.projectId||old.projectId===id.PROJECT)&&['SUCCESS','FAILURE','INTERNAL_ERROR','TIMEOUT','CANCELLED','EXPIRED'].includes(old.status));
  // serviceConfig, images and resolved build source are not DELETE predicates.
 }else if(phase==='create'){
  add('function.notFound',absence(s.fn));try{g.assertAudit(s.createAudit);}catch{add('originalFirstCreate.preflight',false);}
 }else add('function.observation',false);
 return {phase,issues};
}
function seal(s,release){
 const state=assess(s);if(state.issues.length)throw Error('Expediente bloqueado: '+state.issues.join(', '));g.verifyPlan(release);
 const files=['remote-staging-recreate.cjs','remote-staging-recovery.cjs','remote-staging-gcloud.cjs','audit-remote-staging-iam.cjs','remote-staging-build-identity.cjs','probe-remote-staging-runtime.cjs','build-remote-staging.cjs','prepare-remote-staging-closed.cjs'];
 const controls=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(__dirname,file)))]));
 const payload={format:1,phase:state.phase,target:id.FUNCTION,previousBuild:r.PREVIOUS_BUILD,releaseHash:release.releaseHash,snapshotHash:sha(canonical(s)),controls};return {...payload,planHash:sha(canonical(payload))};
}
function report(s,release){
 const state=assess(s),f=s.fn?.data,old=s.previousBuild?.data,proof=state.issues.length?null:seal(s,release);
 return {mode:'READ_ONLY_SINGLE_FUNCTION_RECREATE',phase:state.phase,readyForReview:!state.issues.length,authorized:false,checks:state.issues,releaseHash:release.releaseHash,deletePlanHash:state.phase==='delete'?proof?.planHash||null:null,createPlanHash:state.phase==='create'?proof?.planHash||null:null,creationChecks:{permissionsMissing:CREATE_PERMISSIONS.filter(p=>!Array.isArray(s.permissions?.data?.permissions)||!s.permissions.data.permissions.includes(p)),fullFirstCreateAudit:state.phase==='create'?'CHECKED_BY_ORIGINAL_PREDICATES':'DEFERRED_UNTIL_ACTUAL_ABSENCE'},observed:{state:['FAILED','ACTIVE','DEPLOYING','DELETING','UNKNOWN'].includes(f?.state)?f.state:null,createTime:typeof f?.createTime==='string'&&Number.isFinite(Date.parse(f.createTime))?f.createTime:null,updateTime:typeof f?.updateTime==='string'&&Number.isFinite(Date.parse(f.updateTime))?f.updateTime:null,previousBuildStatus:['SUCCESS','FAILURE','INTERNAL_ERROR','TIMEOUT','CANCELLED','EXPIRED','QUEUED','WORKING','PENDING'].includes(old?.status)?old.status:null,source:sourceEvidence(f,s.sourceBucket)},limitations:{concurrency:'NO_CAS_EXCLUSIVE_WINDOW_REQUIRED',previousServiceConfig:'NOT_REQUIRED_OR_ATTESTED_FOR_DELETE',buildImages:Array.isArray(old?.results?.images)?'METADATA_PRESENT_NOT_BYTE_VERIFIED':'NOT_RETURNED_NOT_REQUIRED_FOR_DELETE',buildProvenance:old?.sourceProvenance?'METADATA_PRESENT_NOT_BYTE_VERIFIED':'NOT_RETURNED_NOT_REQUIRED_FOR_DELETE',userData:'NOT_READ_NOT_ASSUMED_EMPTY'},preserved:['Firestore','Storage buckets/objects','Authentication','IAM/accounts','Artifact Registry','builds/logs'],next:'Separate owner consent and exclusive window; deletion never starts creation.'};
}
async function inspect({env=process.env,execute=executeDefault,getToken=iam.localToken,read=readLive}={}){g.closed(settings,client,env);checkCli(execute,env);const p=g.prepare({env});return report(await read({token:credentials(await getToken())}),p);}
function authorize(action,env,version){
 if(settings.deploymentAuthorized!==true)throw Error('Autorización de repositorio cerrada.');g.closed(settings,client,env);
 const flag=action==='delete'?'FULLHOUSE_AUTHORIZE_SINGLE_FUNCTION_DELETE':'FULLHOUSE_AUTHORIZE_RECREATE_CREATE',hash=action==='delete'?'FULLHOUSE_APPROVED_DELETE_PLAN':'FULLHOUSE_APPROVED_CREATE_PLAN';
 if(version.split('.')[0]!=='22'||env[flag]!==id.PROJECT||env.FULLHOUSE_RECREATE_EXCLUSIVE_WINDOW!==id.PROJECT||env.FULLHOUSE_ACK_RECREATE_DATA_REVIEW!==id.PROJECT)throw Error('Falta Node22, consentimiento separado, ventana exclusiva o revisión de preservación de datos.');
 if(![hash,'FULLHOUSE_APPROVED_GCLOUD_RELEASE'].every(key=>/^[a-f0-9]{64}$/.test(env[key]||'')))throw Error('Faltan los dos hashes completos revisados.');
 if(action==='create'&&env.FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY!==id.PROJECT)throw Error('Falta consentimiento independiente del ejecutor original de creación.');
}
function checkCli(execute,env){const opts={encoding:'utf8',env};const sdk=JSON.parse(execute(['version','--format=json'],opts));if(sdk['Google Cloud SDK']!==g.SDK_VERSION)throw Error('SDK no revisado.');const cfg=JSON.parse(execute(['config','list','--format=json'],opts));if(Object.values(cfg.api_endpoint_overrides||{}).some(Boolean)||['credential_file_override','access_token_file','impersonate_service_account'].some(k=>cfg.auth?.[k])||[true,'true','True'].includes(cfg.core?.log_http))throw Error('Configuración CLI no permitida.');}
const executeDefault=(args,opts)=>execFileSync('gcloud',args,opts);
async function prepared(action,{env,nodeVersion,execute,getToken,read}){
 authorize(action,env,nodeVersion);checkCli(execute,env);const release=g.prepare({env});g.verifyPlan(release);if(release.releaseHash!==env.FULLHOUSE_APPROVED_GCLOUD_RELEASE)throw Error('Release distinta de la aprobada.');
 const token=credentials(await getToken()),s=await read({token}),proof=seal(s,release),key=action==='delete'?'FULLHOUSE_APPROVED_DELETE_PLAN':'FULLHOUSE_APPROVED_CREATE_PLAN';
 if(proof.phase!==action||proof.planHash!==env[key])throw Error('Fase o expediente distintos de lo aprobado.');
 if(seal(await read({token}),release).planHash!==proof.planHash)throw Error('Estado cambiado antes de actuar.');g.verifyPlan(release);return {token,s,proof,release};
}
function receipt(dir,proof){
 if(fs.existsSync(dir)&&(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink()))throw Error('Directorio local de recibos no permitido.');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,proof.planHash+'.json'),fd=fs.openSync(file,'wx',0o600);let closed=false;
 return {file,write(value){if(closed)throw Error('Recibo cerrado.');const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');let offset=0;while(offset<bytes.length){const written=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);if(written<1)throw Error('Recibo incompleto.');offset+=written;}fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);},close(){if(!closed){closed=true;fs.closeSync(fd);}}};
}
function operationValid(op,name){
 if(!owned('operations/[A-Za-z0-9_-]+',op?.name)||name&&op.name!==name||op.metadata?.target&&!owned('functions/remoteV1',op.metadata.target)||op.metadata?.operationType&&op.metadata.operationType!=='DELETE_FUNCTION'||op.done!==undefined&&typeof op.done!=='boolean')throw Error('Respuesta de operación no verificable.');
 if(op.error)throw Error('La operación de borrado comunica error.');
 if(op.done===true&&op.response?.['@type']!=='type.googleapis.com/google.protobuf.Empty')throw Error('Respuesta final de borrado no verificable.');
}
async function deleteFailed({env=process.env,nodeVersion=process.versions.node,execute=executeDefault,getToken=iam.localToken,read=readLive,fetcher=fetch,receiptsDir=RECEIPTS,onOperation=()=>{},pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),pollLimit=120}={}){
 if(!Number.isInteger(pollLimit)||pollLimit<1||pollLimit>120)throw Error('Presupuesto de espera inválido.');
 const {token,proof,release}=await prepared('delete',{env,nodeVersion,execute,getToken,read});
 const journal=receipt(receiptsDir,proof),record={format:1,target:id.FUNCTION,deletePlanHash:proof.planHash,releaseHash:release.releaseHash,phase:'request-intent-recorded',operation:null};
 try{journal.write(record);}catch(e){journal.close();throw e;}
 try{
  // Exactly one mutating request; no retries, alternate targets or cleanup.
  const response=await request(FUNCTION_URL,{token,method:'DELETE',fetcher});if(response.http!==200)throw Error('DELETE no confirmado.');
  let op=response.data;operationValid(op);record.operation=op.name;record.phase='operation-received';onOperation({operation:op.name,receipt:journal.file});journal.write(record);
  for(let count=0;op.done!==true&&count<pollLimit;count++){await pause(1000);const result=await request(`https://cloudfunctions.googleapis.com/v2/${op.name}`,{token,fetcher});if(result.http!==200)throw Error('Lectura de operación no confirmada.');op=result.data;operationValid(op,record.operation);}
  if(op.done!==true)throw Error('Espera agotada.');record.phase='operation-completed';journal.write(record);
  const after=await read({token,includeCreateAudit:false});if(!absence(after.fn)||!absence(after.run)||!operationsValid(after.operations)||after.project?.http!==200||after.project?.data?.projectId!==id.PROJECT||after.project.data?.name!==`projects/${id.NUMBER}`)throw Error('Ausencia final no verificada.');
  record.phase='absence-verified';journal.write(record);return {mode:'SINGLE_FUNCTION_DELETION_VERIFIED',...record,receipt:journal.file,noCreationPerformed:true,next:'Inspect again, review createPlanHash, and authorize first-create separately.'};
 }catch{record.phase='uncertain';try{journal.write(record);}catch{}throw Object.assign(Error('Borrado incierto/fallido: inspeccionar función, operación y Run. No reintentar ni borrar otros recursos.'),{operation:record.operation,receipt:journal.file});}finally{journal.close();}
}
async function createClosed({env=process.env,nodeVersion=process.versions.node,execute=executeDefault,getToken=iam.localToken,read=readLive,deploy=g.deployClosed}={}){
 const {proof}=await prepared('create',{env,nodeVersion,execute,getToken,read});
 // Delegate without an injected audit: the original executor obtains its own
 // fresh real preflight and retains its absent-function barrier unchanged.
 const result=await deploy({env,nodeVersion});if(result?.mode!=='CLOSED_RELEASE_METADATA_VERIFIED'||result.releaseHash!==proof.releaseHash)throw Error('Creación no confirmada: inspeccionar antes de reintentar.');return {...result,createPlanHash:proof.planHash,noDeletionPerformed:true};
}
module.exports={DELETE_PERMISSIONS,CREATE_PERMISSIONS,RECEIPTS,FUNCTION_URL,RUN,MANAGED_SOURCE,absence,sourceEvidence,operationsValid,readLive,assess,seal,report,inspect,deleteFailed,createClosed};
if(require.main===module){const args=process.argv.slice(2);(async()=>{
 if(!args.length)return console.log(JSON.stringify({mode:'PLAN_ONLY',target:id.FUNCTION,inspect:'--inspect: single read-only packet',delete:'--delete: separate owner authorization and approved delete hash',create:'--create: only after verified absence and separate first-create consent',automaticChain:false},null,2));
 if(args.length!==1)throw Error('No se permiten flags libres.');
 if(args[0]==='--inspect'){const value=await inspect();console.log(JSON.stringify(value,null,2));if(!value.readyForReview)process.exitCode=2;return;}
 if(args[0]==='--delete')return console.log(JSON.stringify(await deleteFailed({onOperation:value=>console.error(JSON.stringify({mode:'DELETE_OPERATION_RECEIVED',...value}))}),null,2));
 if(args[0]==='--create')return console.log(JSON.stringify(await createClosed(),null,2));throw Error('Solo plan, --inspect, --delete o --create.');
 })().catch(e=>{console.error(JSON.stringify({mode:'STOPPED',message:e.message,...(e.operation?{operation:e.operation}:{}),...(e.receipt?{receipt:e.receipt}:{}),retryAutomatically:false}));process.exitCode=2;});}
