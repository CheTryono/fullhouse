'use strict';
// Non-authorizing classification only. The original strict validator remains
// mandatory for every recovery; expected settings are never inserted into facts.
const g=require('./remote-staging-gcloud.cjs'),id=require('./remote-staging-build-identity.cjs');
function checks(s={}, {requiredPermissions=[],expectedBuild}={}){
 const rows=[],f=s.fn,b=f?.buildConfig,c=f?.serviceConfig,a=s.audit,p=s.previousBuild;
 const add=(field,values,ok)=>{let status=values.some(v=>v===undefined||v===null)?'missing':'mismatch';if(status!=='missing')try{if(ok())status='verified';}catch{}rows.push({field,status});};
 const exact=(field,value,expected)=>add(field,[value],()=>value===expected);
 const owned=(kind,value)=>new RegExp(`^projects/(?:${id.PROJECT}|${id.NUMBER})/locations/${id.REGION}/${kind}$`).test(value||'');
 const builder=v=>[id.BUILD_RESOURCE,`projects/${id.NUMBER}/serviceAccounts/${id.BUILD_EMAIL}`].includes(v);
 exact('audit.project',a?.project,id.PROJECT);exact('audit.runtimePolicy',a?.assessment?.directPolicy,'matches-minimal-proposal');exact('audit.apis',a?.closedFunctionsPreparation?.apiCheck,'all-observed-enabled');
 for(const key of ['identityVerified','operatorActAsVerified'])exact('audit.builder.'+key,a?.buildSelection?.dedicated?.[key],true);
 exact('audit.builder.ownerOrEditorDirectGrant',a?.buildSelection?.dedicated?.ownerOrEditorDirectGrant,false);exact('audit.runtimeActAs',a?.deployer?.runtimeActAsVerified,true);exact('audit.sourcesAndRepository',a?.gcloudResources?.basicInputsVerified,true);
 for(const [kind,role]of [['functions','roles/cloudfunctions.standardServiceAgent'],['buildAgent','roles/cloudbuild.serviceAgent'],['run','roles/run.serviceAgent']]){const roles=a?.managedIdentities?.[kind]?.directProjectRoles;add('audit.agent.'+kind,[roles],()=>Array.isArray(roles)&&roles.some(v=>v.role===role&&!v.condition));}
 add('audit.function.name',[a?.function?.name],()=>owned('functions/remoteV1',a.function.name));exact('audit.function.runtime',a?.function?.runtime,'nodejs22');exact('audit.function.runtimeServiceAccount',a?.function?.runtimeServiceAccount,id.RUNTIME);add('audit.function.buildServiceAccount',[a?.function?.buildServiceAccount],()=>builder(a.function.buildServiceAccount));
 add('audit.function.observation',[a?.observations],()=>Array.isArray(a.observations)&&a.observations.some(v=>v.name==='function'&&v.status==='observed'));
 for(const permission of requiredPermissions)add('permission.'+permission,[a?.recoveryPermissions],()=>Array.isArray(a.recoveryPermissions)&&a.recoveryPermissions.includes(permission));
 add('function.name',[f?.name],()=>owned('functions/remoteV1',f.name));exact('function.environment',f?.environment,'GEN_2');exact('function.state',f?.state,'FAILED');
 add('function.buildConfig.build',[b?.build],()=>owned('builds/'+expectedBuild,b.build));exact('function.buildConfig.runtime',b?.runtime,'nodejs22');exact('function.buildConfig.entryPoint',b?.entryPoint,'remoteV1');add('function.buildConfig.serviceAccount',[b?.serviceAccount],()=>builder(b.serviceAccount));exact('function.buildConfig.dockerRepository',b?.dockerRepository,id.REPOSITORY);
 exact('function.buildConfig.source.storageSource.bucket',b?.source?.storageSource?.bucket,id.SOURCE_BUCKET);add('function.buildConfig.source.storageSource.object',[b?.source?.storageSource?.object],()=>typeof b.source.storageSource.object==='string'&&!!b.source.storageSource.object);
 for(const [key,expected]of Object.entries({serviceAccountEmail:id.RUNTIME,availableMemory:'512Mi',availableCpu:g.CPU,maxInstanceCount:1,maxInstanceRequestConcurrency:1,timeoutSeconds:60,ingressSettings:'ALLOW_ALL'}))exact('function.serviceConfig.'+key,c?.[key],expected);
 // Omitted minInstances/service/traffic are optional in the existing contract,
 // but a completely missing serviceConfig is not a default service definition.
 add('function.serviceConfig.minInstanceCount',[c],()=>c.minInstanceCount===undefined||c.minInstanceCount===null||c.minInstanceCount===0);
 add('function.serviceConfig.service',[c],()=>!c.service||owned('services/remotev1',c.service));add('function.serviceConfig.traffic',[c],()=>c.allTrafficOnLatestRevision!==false);
 for(const [key,value]of Object.entries(g.ENV))exact('function.serviceConfig.environmentVariables.'+key,c?.environmentVariables?.[key],value);
 add('function.serviceConfig.environmentVariables.keys',[c?.environmentVariables],()=>Object.keys(c.environmentVariables).sort().join()===Object.keys(g.ENV).sort().join());
 exact('function.buildConfig.environmentVariables.GOOGLE_NODE_RUN_SCRIPTS',b?.environmentVariables?.GOOGLE_NODE_RUN_SCRIPTS,'');add('function.buildConfig.environmentVariables.keys',[b?.environmentVariables],()=>Object.keys(b.environmentVariables).join()==='GOOGLE_NODE_RUN_SCRIPTS');
 for(const key of ['eventTrigger','kmsKeyName','upgradeInfo'])add('function.'+key+'.absent',[f],()=>!f[key]);
 for(const key of ['workerPool'])add('function.buildConfig.'+key+'.absent',[b],()=>!b[key]);
 add('function.buildConfig.source.repoSource.absent',[b?.source],()=>!b.source.repoSource);add('function.buildConfig.dockerRegistry',[b],()=>!b.dockerRegistry||b.dockerRegistry==='ARTIFACT_REGISTRY');
 for(const key of ['vpcConnector','vpcConnectorEgressSettings','binaryAuthorizationPolicy'])add('function.serviceConfig.'+key+'.absent',[c],()=>!c[key]);
 for(const key of ['directVpcNetworkInterface','secretEnvironmentVariables','secretVolumes'])add('function.serviceConfig.'+key+'.absent',[c],()=>!c[key]?.length);
 for(const field of ['createTime','updateTime'])add('function.'+field,[f?.[field]],()=>typeof f[field]==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(f[field])&&Number.isFinite(Date.parse(f[field])));
 exact('function.labels.deployment-callable',f?.labels?.['deployment-callable'],'true');exact('function.labels.firebase-functions-codebase',f?.labels?.['firebase-functions-codebase'],'remote-staging-v1');add('function.labels.fullhouse-release',[f?.labels?.['fullhouse-release']],()=>/^[a-f0-9]{32}$/.test(f.labels['fullhouse-release']));
 add('previousBuild.name',[p?.name],()=>owned('builds/'+expectedBuild,p.name));exact('previousBuild.status',p?.status,'SUCCESS');add('previousBuild.serviceAccount',[p?.serviceAccount],()=>builder(p.serviceAccount));
 add('previousBuild.id',[p],()=>!p.id||p.id===expectedBuild);add('previousBuild.projectId',[p],()=>!p.projectId||p.projectId===id.PROJECT);
 add('previousBuild.images',[p?.results?.images],()=>Array.isArray(p.results.images)&&p.results.images.length>0&&p.results.images.every(v=>v.name?.startsWith(`${id.REGION}-docker.pkg.dev/${id.PROJECT}/fullhouse-remote-functions/`)&&/^sha256:[a-f0-9]{64}$/.test(v.digest)));
 const source=p?.sourceProvenance?.resolvedStorageSource;add('previousBuild.resolvedSource.bucket',[source?.bucket],()=>[id.SOURCE_BUCKET,`gcf-v2-sources-${id.NUMBER}-${id.REGION}`].includes(source.bucket));add('previousBuild.resolvedSource.object',[source?.object],()=>typeof source.object==='string'&&!!source.object);add('previousBuild.resolvedSource.generation',[source?.generation],()=>/^[1-9]\d*$/.test(source.generation));
 exact('run.resource',s.run?.resource,`projects/${id.PROJECT}/locations/${id.REGION}/services/remotev1`);exact('run.http',s.run?.http,404);exact('run.rpcStatus',s.run?.rpcStatus,'NOT_FOUND');add('run.errorInfo',[s.run],()=>!s.run.reason);
 add('operations.complete',[s.operations],()=>Array.isArray(s.operations));add('operations.noPendingTarget',[s.operations],()=>Array.isArray(s.operations)&&!s.operations.some(op=>op.done!==true&&(typeof op.metadata?.target!=='string'||!/^projects\/[^/]+\/locations\/[^/]+\/functions\/[^/]+$/.test(op.metadata.target)||owned('functions/remoteV1',op.metadata.target))));
 return rows;
}
module.exports={checks};
