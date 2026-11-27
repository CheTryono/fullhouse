'use strict';
// Local planning and selection guards only. No network request, IAM grant or deploy.
const PROJECT='fullhouse-staging',NUMBER='664973716762',REGION='us-central1';
const BUILD_EMAIL=`fullhouse-remote-build@${PROJECT}.iam.gserviceaccount.com`;
const BUILD_RESOURCE=`projects/${PROJECT}/serviceAccounts/${BUILD_EMAIL}`;
const RUNTIME=`fullhouse-remote-runtime@${PROJECT}.iam.gserviceaccount.com`;
const CLI_VERSION='15.37.0',FUNCTION=`projects/${PROJECT}/locations/${REGION}/functions/remoteV1`;
function assertBuildIdentity(request){
 if(request?.name!==FUNCTION||request?.buildConfig?.runtime!=='nodejs22')throw Error('Proyecto, función o runtime fuera del contrato de staging.');
 if(request?.buildConfig?.serviceAccount!==BUILD_RESOURCE)throw Error('Falta la identidad dedicada explícita en buildConfig.serviceAccount; no se permite fallback al default.');
 if(request?.serviceConfig?.serviceAccountEmail!==RUNTIME)throw Error('La identidad runtime debe conservarse separada de la identidad de build.');
 // This is a selection check, not evidence of IAM, source scopes or deployment.
 return true;
}
function inspectFirebaseTransport(){
 const declared=require('../package.json').devDependencies['firebase-tools'],installed=require('firebase-tools/package.json').version;
 if(declared!==CLI_VERSION||installed!==CLI_VERSION)throw Error('Versión Firebase CLI sin revisión de selección de build; despliegue bloqueado.');
 const {functionFromEndpoint}=require('firebase-tools/lib/gcp/cloudfunctionsv2');
 const request=functionFromEndpoint({platform:'gcfv2',project:PROJECT,region:REGION,id:'remoteV1',runtime:'nodejs22',entryPoint:'remoteV1',callableTrigger:{},serviceAccount:RUNTIME,
  // Deliberately unsupported fields: demonstrate that guessing a setting cannot
  // select the builder. These are never added to firebase.json or SDK options.
  buildServiceAccount:BUILD_RESOURCE,buildConfig:{serviceAccount:BUILD_RESOURCE}});
 return {version:installed,request,explicitBuildIdentityForwarded:request.buildConfig?.serviceAccount===BUILD_RESOURCE};
}
function assertFirebaseTransport(){
 inspectFirebaseTransport();
 // The pinned CLI has no reviewed configuration path for selecting the builder.
 // Do not authorize it even if somebody supplies an environment variable/field.
 throw Error('Firebase CLI 15.37.0 no selecciona el ejecutor dedicado de Build. Ruta de deploy bloqueada; requiere un transporte explícito revisado y autorizado.');
}
function assessDedicated({account,projectPolicy,accountPolicy,operatorPermissions}){
 const bindings=Array.isArray(projectPolicy?.bindings)?projectPolicy.bindings.filter(b=>b.members?.includes('serviceAccount:'+BUILD_EMAIL)):null;
 const identityVerified=account?.email===BUILD_EMAIL&&account?.projectId===PROJECT&&(account.disabled===undefined||account.disabled===false);
 const broad=bindings?.some(b=>['roles/editor','roles/owner'].includes(b.role))??null;
 return {expectedEmail:BUILD_EMAIL,expectedResource:BUILD_RESOURCE,identityVerified,
  directProjectRoles:bindings?.map(b=>({role:b.role,condition:b.condition?.expression||null}))??null,
  ownerOrEditorDirectGrant:broad,operatorActAsVerified:Array.isArray(operatorPermissions)?operatorPermissions.includes('iam.serviceAccounts.actAs'):null,
  impersonationPolicy:accountPolicy?{version:accountPolicy.version||1,bindings:(accountPolicy.bindings||[]).map(b=>({role:b.role,membersCount:b.members?.length||0,condition:b.condition?.expression||null}))}:null,
  sourceAndRepositoryScopes:'UNVERIFIED: exact source buckets and Artifact Registry repository must be reviewed separately.',
  readyForDeploy:false,note:'No inherited/custom/group/deny/PAB or effective build access verification. No account or role is created.'};
}
function plan(){const cli=inspectFirebaseTransport(),settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');if(settings.projectId!==PROJECT||settings.region!==REGION||settings.serviceAccount!==RUNTIME)throw Error('Configuración staging fuera de la propuesta de build.');return {mode:'PLAN_ONLY',project:PROJECT,region:REGION,proposedBuildAccount:BUILD_EMAIL,proposedBuildResource:BUILD_RESOURCE,runtime:RUNTIME,
 firebase:{version:cli.version,explicitBuildIdentityForwarded:cli.explicitBuildIdentityForwarded,deployAllowed:false},
 alternative:'Cloud Functions v2 buildConfig.serviceAccount; gcloud --build-service-account requires local help/version check and a separately reviewed deploy procedure.',
 sourceBuckets:null,artifactRepository:null,deploymentAuthorized:settings.deploymentAuthorized,remoteEnabled:settings.remoteEnabled,clientEnabled:client.enabled,
 next:'Owner authorization to create only the dedicated service account, without keys or grants. Then review exact source/repository scopes. No deploy.'};}
module.exports={PROJECT,NUMBER,REGION,BUILD_EMAIL,BUILD_RESOURCE,RUNTIME,CLI_VERSION,FUNCTION,assertBuildIdentity,inspectFirebaseTransport,assertFirebaseTransport,assessDedicated,plan};
if(require.main===module){try{if(process.argv.length!==2)throw Error('Solo plan local sin argumentos. No admite --run ni ejecuta cambios.');console.log(JSON.stringify(plan(),null,2));}catch(e){console.error(e.message);process.exitCode=2;}}
