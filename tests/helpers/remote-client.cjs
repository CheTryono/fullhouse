'use strict';
const {buildSync}=require('esbuild'),path=require('node:path');
function load(file){const m={exports:{}};const source=buildSync({entryPoints:[path.resolve(__dirname,'../../remote-client',file)],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;new Function('module','exports','require',source)(m,m.exports,require);return m.exports;}
function localStore(){const map=new Map(),reads=[];let fail=false;return{map,reads,get length(){return map.size;},key:n=>[...map.keys()][n]??null,getItem(k){reads.push(k);return map.get(k)??null;},setItem(k,v){if(fail)throw Error('Synthetic local quota');map.set(k,v);},removeItem(k){if(fail)throw Error('Synthetic blocked cleanup');map.delete(k);},fail(value){fail=value;}};}
const {RemoteSession,digest}=load('session.ts'),{plannerPort}=load('planner-port.ts'),{emulatorApi}=load('transport.ts');
function apiFor(service,uid){const auth={uid,token:{email_verified:true}};return{read:id=>service.read(auth,{revisionId:id}),inspect:id=>service.inspect(auth,{operationId:id}),save:data=>service.save(auth,data),restore:data=>service.restore(auth,data)};}
module.exports={load,localStore,RemoteSession,digest,plannerPort,emulatorApi,apiFor};
