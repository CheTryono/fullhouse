'use strict';
const fs=require('node:fs'),path=require('node:path'),{build}=require('esbuild'),root=path.resolve(__dirname,'..');
async function buildStaging({emulator=false,configFile=path.join(root,'staging/firebase-config.local.json')}={}){
 require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/check-build.cjs')],{cwd:root,stdio:'pipe'});
 const out=path.join(root,'dist-staging');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 // Only public files; no laboratory, history modules, source maps or credentials.
 for(const file of ['app.js','styles.css','logo.svg'])fs.copyFileSync(path.join(root,file),path.join(out,file));fs.cpSync(path.join(root,'vendor'),path.join(out,'vendor'),{recursive:true});
 for(const [source,target]of [['index.html','index.html'],['auth.css','auth.css']])fs.copyFileSync(path.join(root,'staging',source),path.join(out,target));
 let config=null;if(emulator)config={firebase:{apiKey:'demo-key',authDomain:'demo-fullhouse-auth.firebaseapp.com',projectId:'demo-fullhouse-auth',appId:'demo-fullhouse-auth-web'},emulatorUrl:'http://127.0.0.1:9099'};
 else if(fs.existsSync(configFile)){config=JSON.parse(fs.readFileSync(configFile,'utf8'));const allowed=['apiKey','authDomain','projectId','appId','storageBucket','messagingSenderId','measurementId'];if(Object.keys(config).some(k=>k!=='firebase')||!config.firebase||Object.keys(config.firebase).some(k=>!allowed.includes(k))||Object.values(config.firebase).some(v=>typeof v!=='string'||/-----BEGIN|private_key|service_account|YOUR_|REPLACE|CHANGEME/.test(v))||['apiKey','authDomain','projectId','appId'].some(k=>!config.firebase[k]))throw Error('Solo configuración Web pública; nunca credenciales privadas ni emulador en build real');}
 fs.writeFileSync(path.join(out,'runtime-config.js'),'window.FULLHOUSE_AUTH_CONFIG='+JSON.stringify(config)+';\n');
 let planner=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script>React.Fragment = function(props) { return props.children; };</script>','<script src="legacy-fragment.js"></script>').replace(/<script src="app\.js[^\"]*"><\/script>/,'<script src="planner-bootstrap.js"></script>');fs.writeFileSync(path.join(out,'planner.html'),planner);fs.writeFileSync(path.join(out,'legacy-fragment.js'),'React.Fragment=function(props){return props.children;};\n');
 await Promise.all([build({entryPoints:[path.join(root,'auth/staging.ts')],bundle:true,outfile:path.join(out,'auth.js'),format:'iife',target:'es2020',minify:true}),build({entryPoints:[path.join(root,'auth/planner-bootstrap.ts')],bundle:true,outfile:path.join(out,'planner-bootstrap.js'),format:'iife',target:'es2020',minify:true})]);
 return {out,configured:!!config,emulator,projectId:config?.firebase.projectId||null};
}
module.exports={buildStaging};if(require.main===module)buildStaging({emulator:process.argv.includes('--emulator')}).then(x=>console.log(JSON.stringify(x)),e=>{console.error(e.message);process.exitCode=1;});
