'use strict';
const fs=require('node:fs'),path=require('node:path'),{build}=require('esbuild'),root=path.resolve(__dirname,'..');
async function buildRemoteLab(){
 require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/check-build.cjs')],{cwd:root,stdio:'pipe'});
 const out=path.join(root,'dist-remote-lab');fs.mkdirSync(out,{recursive:true});
 for(const file of ['app.js','styles.css','logo.svg'])fs.copyFileSync(path.join(root,file),path.join(out,file));fs.cpSync(path.join(root,'vendor'),path.join(out,'vendor'),{recursive:true});
 fs.copyFileSync(path.join(root,'remote-client/index.html'),path.join(out,'index.html'));fs.copyFileSync(path.join(root,'staging/auth.css'),path.join(out,'auth.css'));
 const buildId=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'app.js'))).update(fs.readFileSync(path.join(root,'remote-client/drafts.ts'))).digest('hex');fs.writeFileSync(path.join(out,'lab-build.js'),'window.FullhouseLabBuild='+JSON.stringify(buildId)+';\n');
 const planner=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script>React.Fragment = function(props) { return props.children; };</script>','<script src="legacy-fragment.js"></script>').replace(/<script src="app\.js[^\"]*"><\/script>/,'<script src="planner-bootstrap.js"></script>');
 fs.writeFileSync(path.join(out,'planner.html'),planner);fs.writeFileSync(path.join(out,'legacy-fragment.js'),'React.Fragment=function(props){return props.children;};\n');
 await build({entryPoints:[path.join(root,'remote-client/lab.ts')],bundle:true,outfile:path.join(out,'remote-lab.js'),format:'iife',globalName:'FullhouseRemoteLab',target:'es2022'});
 await build({entryPoints:[path.join(root,'auth/planner-bootstrap.ts')],bundle:true,outfile:path.join(out,'planner-bootstrap.js'),format:'iife',target:'es2020'});
 return out;
}
module.exports={buildRemoteLab};if(require.main===module)buildRemoteLab().then(out=>console.log('Solo laboratorio: '+out));
