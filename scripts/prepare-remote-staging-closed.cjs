'use strict';
// Local artifact preparation, never a deploy or permission grant.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {closed}=require('./probe-remote-staging-runtime.cjs');
const settings=require('../remote-staging/settings.json'),client=require('../staging/remote-config.example.json');
function prepare({env=process.env}={}){
 // This build never uses credentials/SDKs. Only activation variables matter here.
 closed(settings,client,{FULLHOUSE_REMOTE_STAGING_ENABLED:env.FULLHOUSE_REMOTE_STAGING_ENABLED,FULLHOUSE_STAGING_TEST_UIDS:env.FULLHOUSE_STAGING_TEST_UIDS});const out=require('./build-remote-staging.cjs').build(),dotenv=path.join(out,'.env.fullhouse-staging');
 if(fs.existsSync(dotenv)&&fs.readFileSync(dotenv,'utf8').trim()!=='FULLHOUSE_REMOTE_STAGING_ENABLED=0\nFULLHOUSE_STAGING_TEST_UIDS=')throw Error('El artefacto contiene activación/cuentas de ensayo; no es un despliegue cerrado.');
 const manifest=fs.readFileSync(path.join(out,'build.json'));
 return {project:settings.projectId,region:settings.region,runtime:settings.runtime,serviceAccount:settings.serviceAccount,artifact:out,manifestSha256:createHash('sha256').update(manifest).digest('hex'),remoteEnabled:settings.remoteEnabled,clientEnabled:client.enabled,deploymentAuthorized:settings.deploymentAuthorized,status:'PREPARED_FOR_REVIEW_ONLY',next:'Pinned Firebase CLI cannot select a dedicated builder. Separately reviewed explicit build transport and owner authorization required; changing the flag alone cannot authorize deploy. No deploy/SDK/permissions were executed.'};
}
module.exports={prepare};if(require.main===module){try{console.log(JSON.stringify(prepare(),null,2));}catch(e){console.error(e.message);process.exitCode=2;}}
