'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..'),settings=require('../remote-staging/settings.json');
function activation(raw){
 const rows=raw.trim().split(/\r?\n/);if(rows.length!==2||!/^FULLHOUSE_REMOTE_STAGING_ENABLED=[01]$/.test(rows[0])||!/^FULLHOUSE_STAGING_TEST_UIDS=([A-Za-z0-9_-]{1,128}(,[A-Za-z0-9_-]{1,128}){0,2})?$/.test(rows[1]))throw Error('Solo se permiten las dos variables no secretas de activación.');
 const ids=rows[1].split('=')[1].split(',').filter(Boolean);if(new Set(ids).size!==ids.length)throw Error('UIDs de ensayo repetidos.');return rows[0].endsWith('1')&&ids.length>0;
}
function check(env=process.env,version=process.versions.node){
 if(!settings.deploymentAuthorized)throw Error('Despliegue bloqueado en 3C.1: falta autorización expresa y una PR de activación.');
 if(version.split('.')[0]!=='22'||env.GCLOUD_PROJECT!=='fullhouse-staging'||settings.projectId!=='fullhouse-staging'||env.FULLHOUSE_AUTHORIZE_STAGING_DEPLOY!=='fullhouse-staging')throw Error('Node, proyecto o consentimiento de despliegue incompatibles.');
 const {sources}=require('./build-remote-staging.cjs'),out=path.join(root,'dist-remote-staging'),manifest=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8'));
 if(JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify(Object.keys(sources).sort()))throw Error('Artefacto incompleto.');
 for(const [file,source]of Object.entries(sources)){const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');if(sha(fs.readFileSync(path.join(out,file)))!==manifest.files[file]||sha(fs.readFileSync(path.join(root,source)))!==manifest.files[file])throw Error('El artefacto no coincide con el código revisado.');}
 require(path.join(out,'policy.cjs')).settingsCheck(settings);
 const cfg=require('../firebase.remote-staging.json');if(cfg.hosting||cfg.functions.length!==1||cfg.functions[0].source!=='dist-remote-staging'||cfg.functions[0].codebase!=='remote-staging-v1'||cfg.firestore.length!==1||cfg.firestore[0].database!=='(default)'||cfg.storage.length!==1||cfg.storage[0].bucket!==settings.bucket)throw Error('Destino de despliegue incompatible.');
 for(const file of ['firebase.remote-staging.json','remote-staging/firestore.rules','remote/storage.rules'])if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==manifest.configuration[file])throw Error('La configuración o reglas cambiaron tras compilar.');
 const dotenv=path.join(out,'.env.fullhouse-staging');if(fs.existsSync(dotenv))activation(fs.readFileSync(dotenv,'utf8'));if(settings.remoteEnabled&&(!fs.existsSync(dotenv)||!activation(fs.readFileSync(dotenv,'utf8'))))throw Error('Faltan activación y cuentas de ensayo explícitas.');
 const allowed=new Set([...Object.keys(sources),'build.json','node_modules','.env.fullhouse-staging']);for(const file of fs.readdirSync(out))if(!allowed.has(file))throw Error('Hay archivos no permitidos en el artefacto.');
}
module.exports={check,activation};if(require.main===module){try{check();}catch(e){console.error(e.message);process.exitCode=1;}}
