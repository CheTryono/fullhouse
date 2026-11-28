'use strict';
const fs=require('node:fs'),path=require('node:path'),{crc32,deflateRawSync}=require('node:zlib');
const {isolatedAuthorizedModule,readback}=require('./gcloud-closed.cjs');
const id=require('../../scripts/remote-staging-build-identity.cjs');
// Independent ZIP fixture writer; includes optional streaming descriptors.
function zipFiles(files,{compressed=false,descriptor=false}={}){
 const chunks=[],catalog=[];let offset=0;
 for(const [name,bytes]of files){
  const n=Buffer.from(name),body=compressed?deflateRawSync(bytes):bytes,crc=crc32(bytes),flags=descriptor?8:0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(flags,6);h.writeUInt16LE(compressed?8:0,8);
  if(!descriptor){h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(bytes.length,22);}h.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt16LE(compressed?8:0,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(body.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  chunks.push(h,n,body);offset+=30+n.length+body.length;
  if(descriptor){const d=Buffer.alloc(16);d.writeUInt32LE(0x08074b50);d.writeUInt32LE(crc,4);d.writeUInt32LE(body.length,8);d.writeUInt32LE(bytes.length,12);chunks.push(d);offset+=16;}
  catalog.push(c,n);
 }
 const central=Buffer.concat(catalog),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,central,end]);
}
function setup(){
 const isolated=isolatedAuthorizedModule();
 // Restore exact source bytes, including formatting; no approval/hash shortcut.
 fs.copyFileSync(path.resolve(__dirname,'../../remote-staging/settings.json'),path.join(isolated.dir,'remote-staging/settings.json'));
 const v=require(path.join(isolated.dir,'scripts/verify-remote-staging-release.cjs'));
 const local=v.localRelease(),plan=isolated.module.prepare({env:{}});
 const files=Object.keys(plan.hashes).map(name=>[name,fs.readFileSync(path.join(plan.artifact,name))]);
 return {dir:isolated.dir,v,local,files,plan};
}
function fixture(x){
 const {v,plan,files}=x,old=readback(plan),revision='remotev1-00001-abc';
 const image=`${id.REGION}-docker.pkg.dev/${id.PROJECT}/fullhouse-remote-functions/remotev1@sha256:${'a'.repeat(64)}`;
 const fn=old.fn;fn.labels['firebase-functions-codebase']='remote-staging-v1';
 fn.buildConfig.build=`projects/${id.NUMBER}/locations/${id.REGION}/builds/${v.EXPECTED.buildId}`;
 fn.buildConfig.environmentVariables={GOOGLE_NODE_RUN_SCRIPTS:''};
 const source={bucket:v.EXPECTED.bucket,object:v.EXPECTED.object,generation:v.EXPECTED.generation};
 fn.buildConfig.source={storageSource:{...source}};fn.buildConfig.sourceProvenance={resolvedStorageSource:{...source}};fn.serviceConfig.revision=revision;
 const service={metadata:{name:'remotev1',namespace:id.NUMBER,uid:'synthetic-service',generation:1,annotations:{'run.googleapis.com/ingress':'all'}},status:{observedGeneration:1,conditions:['Ready','ConfigurationsReady','RoutesReady'].map(type=>({type,status:'True'})),latestReadyRevisionName:revision,latestCreatedRevisionName:revision,traffic:[{revisionName:revision,percent:100}]}};
 const runRevision={metadata:{name:revision,namespace:id.NUMBER,uid:'synthetic-revision',generation:1,labels:{'serving.knative.dev/service':'remotev1'},annotations:{'autoscaling.knative.dev/maxScale':'1'}},spec:{serviceAccountName:id.RUNTIME,containerConcurrency:1,timeoutSeconds:60,containers:[{image:image.split('@')[0]+':version_1',resources:{limits:{memory:'512Mi',cpu:'0.3333'}},env:Object.entries(old.fn.serviceConfig.environmentVariables).map(([name,value])=>({name,value}))}]},status:{observedGeneration:1,conditions:[{type:'Ready',status:'True'}],imageDigest:image}};
 const zip=zipFiles(files,{compressed:true});
 // Build omissions + managed source shape reported by owner in issue #34.
 // Run revision/AR/ZIP bodies below are SYNTHETIC, not observed cloud evidence.
 const e={project:{projectId:id.PROJECT,name:`projects/${id.NUMBER}`},fn,
  build:{name:fn.buildConfig.build,id:v.EXPECTED.buildId,projectId:id.PROJECT,status:'SUCCESS',serviceAccount:id.BUILD_RESOURCE,sourceProvenance:{}},
  service,revision:runRevision,policy:old.invoker,
  bucket:{name:source.bucket,projectNumber:id.NUMBER,location:'US-CENTRAL1'},
  object:{bucket:source.bucket,name:source.object,generation:source.generation,size:String(zip.length)},zip,
  image:{name:v.imageIdentity(image).name,uri:image,imageSizeBytes:'100000000'},observations:[]};
 e.end=structuredClone({fn:e.fn,service:e.service,revision:e.revision,policy:e.policy});return e;
}
module.exports={zipFiles,setup,fixture};
