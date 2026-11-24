'use strict';
// Staging-only, inactive server policy. No client plan flags and no payment writer.
const {identity,operation,parseBackup,hash,isHash,fields,fail}=require('./contract.cjs');
const {createService}=require('./service.cjs');
const QUOTAS=Object.freeze({freeTextBytes:1048576,premiumTextBytes:2097152,imageSourceBytes:600000,uniqueImages:100,references:200,imageBytes:50*1024*1024});
const blank=complete=>({version:1,complete,bindings:{}});
const bindingKey=(logKey,id)=>hash(JSON.stringify([logKey,id]));
function premium(grant,uid,ms,trialUids){
 // Absent, expired or malformed rights never grant new images. Reads are separate.
 try{fields(grant,['version','uid','tier','source','status','revision','validFromMs','validUntilMs']);}catch{return false;}
 return grant.version===1&&grant.uid===uid&&grant.tier==='premium'&&grant.status==='active'&&typeof grant.revision==='string'&&grant.revision.length>0&&grant.revision.length<=128&&Number.isSafeInteger(ms)&&
  Number.isSafeInteger(grant.validFromMs)&&Number.isSafeInteger(grant.validUntilMs)&&grant.validFromMs>=0&&grant.validFromMs<=ms&&ms<grant.validUntilMs&&
  (grant.source==='payments-backend'||grant.source==='staging-owner'&&trialUids.includes(uid)&&grant.validUntilMs-grant.validFromMs<=86400000);
}
function inventory(raw){
 const data=parseBackup(raw),bindings={},locations=new Set();
 for(const [logKey,log]of Object.entries(data.logs))for(const [position,e]of (log.evidences||[]).entries()){
  const key=bindingKey(logKey,e.id);if(Object.hasOwn(bindings,key))fail('invalid-argument','Hay fotografías con identidad duplicada en un registro.');
  bindings[key]={logKey,id:e.id,kind:e.kind,stepId:e.stepId??null,createdAt:e.createdAt,sha256:hash(e.src),bytes:Buffer.byteLength(e.src)};
  locations.add(JSON.stringify(['logs',logKey,'evidences',String(position),'src']));
 }
 // v1 preserves extension fields. A second, hidden image path is not supported.
 const stack=[[data,[]]];while(stack.length){const [v,path]=stack.pop();if(typeof v==='string'&&/data\s*:\s*(?:(?:image|video)\s*\/|application\/octet-stream\b)/i.test(v)&&!locations.has(JSON.stringify(path)))fail('invalid-argument','Las imágenes deben ser evidencias identificadas, no campos ocultos del respaldo.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))stack.push([x,[...path,k]]);}
 const sources=new Map();for(const log of Object.values(data.logs))for(const e of log.evidences||[]){sources.set(hash(e.src),e.src);e.src='';}
 return {bindings,sources,textBytes:Buffer.byteLength(JSON.stringify(data))};
}
function ledgerCheck(value){
 try{
  fields(value,['version','complete','bindings']);if(value.version!==1||typeof value.complete!=='boolean'||!value.bindings||typeof value.bindings!=='object'||Array.isArray(value.bindings))throw Error();
  // Bounded by the v1 2,000-attachment limit for grandfathered accounts.
  if(Object.keys(value.bindings).length>2000)throw Error();
  const sizes=new Map();for(const [key,b]of Object.entries(value.bindings)){
   fields(b,['logKey','id','kind','stepId','createdAt','sha256','bytes']);
   if(typeof b.logKey!=='string'||Buffer.byteLength(b.logKey)>1024||typeof b.id!=='string'||!b.id.trim()||Buffer.byteLength(b.id)>1024||b.kind!=='image'||!(b.stepId===null||typeof b.stepId==='string')||typeof b.createdAt!=='string'||!Number.isFinite(Date.parse(b.createdAt))||!isHash(b.sha256)||!Number.isSafeInteger(b.bytes)||b.bytes<1||b.bytes>2*1024*1024||key!==bindingKey(b.logKey,b.id)||sizes.has(b.sha256)&&sizes.get(b.sha256)!==b.bytes)throw Error();sizes.set(b.sha256,b.bytes);
  }
  if(Buffer.byteLength(JSON.stringify(value))>512*1024)throw Error();
 }catch{fail('data-loss','El inventario de imágenes requiere revisión; no se reiniciará ni se borrarán datos.');}return value;
}
function validNewImage(src){
 if(Buffer.byteLength(src)>QUOTAS.imageSourceBytes)fail('resource-exhausted','Cada imagen nueva admite hasta 600.000 bytes de data URL. Reduce su tamaño.');
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(src),bytes=match&&Buffer.from(match[2],'base64');
 if(!match||!bytes.length||bytes.toString('base64')!==match[2]||!(match[1]==='jpeg'&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||match[1]==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||match[1]==='webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))fail('invalid-argument','La imagen nueva debe ser JPEG, PNG o WebP con contenido compatible.');
 // Header checks are not a full decoder or malware scanner. Never serve as HTML.
}
// Firestore maps may return fields in a different order. Identity is structural.
const same=(a,b)=>['logKey','id','kind','stepId','createdAt','sha256','bytes'].every(k=>a[k]===b[k]);
function evaluate({candidate,base,restore,ledger,grant,uid,ms,trialUids=[]}){
 ledgerCheck(ledger);const existing={...ledger.bindings},confirmedHashes=new Set(Object.values(existing).map(b=>b.sha256));
 for(const inv of [base,restore].filter(Boolean))for(const [key,b]of Object.entries(inv.bindings)){
  if(existing[key]&&!same(existing[key],b))fail('data-loss','Una fotografía confirmada tiene referencias incompatibles.');existing[key]=b;confirmedHashes.add(b.sha256);
 }
 const paid=premium(grant,uid,ms,trialUids),next={...existing};let additions=0;
 for(const [key,b]of Object.entries(candidate.bindings)){
  if(next[key]){if(!same(next[key],b))fail('failed-precondition','Una fotografía existente no puede cambiar de identidad o contenido. Añade otra evidencia explícita.');continue;}
  if(!paid)fail('permission-denied','Las nuevas imágenes en la nube requieren Premium. Tus fotografías guardadas y cambios de texto se conservan.');
  if(!ledger.complete)fail('failed-precondition','Antes de añadir imágenes debe verificarse el inventario anterior de la cuenta.');
  validNewImage(candidate.sources.get(b.sha256));next[key]=b;additions++;
 }
 const limit=paid?QUOTAS.premiumTextBytes:QUOTAS.freeTextBytes;
 if(candidate.textBytes>limit&&candidate.textBytes>Math.max(base?.textBytes||0,restore?.textBytes||0))fail('resource-exhausted','El texto supera la cuota del nivel actual. Conserva el respaldo local; puedes reducirlo sin perder las fotos guardadas.');
 if(additions){const blobs=new Map(Object.values(next).map(b=>[b.sha256,b.bytes]));if(Object.keys(next).length>QUOTAS.references||blobs.size>QUOTAS.uniqueImages||[...blobs.values()].reduce((a,b)=>a+b,0)>QUOTAS.imageBytes)fail('resource-exhausted','Se alcanzó la cuota de imágenes. No se borrará información para liberar espacio.');}
 // An incomplete old account is not silently inventoried/migrated on a text save.
 // Its verified base/restore still authorizes conservation, regardless of old IDs.
 const result={version:1,complete:ledger.complete,bindings:ledger.complete?next:ledger.bindings};ledgerCheck(result);return {ledger:result,confirmedHashes};
}
function createMediaService({db,bucket,now,clock=Date.now,trialUids=[],fault}){
 const original=createService({db,bucket,now,fault});
 async function publish(auth,command,kind){
  const uid=identity(auth);operation(command,kind);
  const op=db.doc(`users/${uid}/operations/${command.operationId}`),head=db.doc(`users/${uid}/storage/head`),usage=db.doc(`users/${uid}/mediaUsage/head`),right=db.doc(`billingEntitlements/${uid}`);
  // Lost acknowledgements are inspectable after expiry/downgrade; the v1 service
  // still checks the exact command hash before accepting an existing receipt.
  if((await op.get()).exists)return original[kind](auth,command);
  const current=await original.read(auth,{revisionId:null});
  if((current?.revisionId??null)!==command.baseRevision)fail('failed-precondition','La revisión base cambió. Conserva el candidato y concilia las versiones.');
  const restored=kind==='restore'?await original.read(auth,{revisionId:command.restoreRevision}):null;
  const base=current?inventory(current.backup):null,restore=restored?inventory(restored.backup):null,candidate=inventory(restored?.backup??command.backup);
  const prior=await usage.get(),initial=prior.exists?ledgerCheck(prior.data()):blank(!current);
  const initialRight=await right.get();const checked=evaluate({candidate,base,restore,ledger:initial,grant:initialRight.data(),uid,ms:clock(),trialUids});
  const protectedBucket={file:name=>{
   const f=bucket.file(name),prefix=`users/${uid}/photos/`,sha=name.startsWith(prefix)?name.slice(prefix.length,-8):null;
   if(name.startsWith(prefix)&&!isHash(sha))fail('invalid-argument','Ruta de imagen incompatible.');
   return {...f,save:async(...args)=>{
    if(sha&&checked.confirmedHashes.has(sha))return; // Verify existing bytes; never recreate a missing old blob.
    return f.save(...args);
   },getMetadata:(...args)=>f.getMetadata(...args),download:(...args)=>f.download(...args)};
  }};
  const protectedDb={doc:key=>db.doc(key),runTransaction:fn=>db.runTransaction(async tx=>{
   const [receipt,active,stored,entitlement]=await tx.getAll(op,head,usage,right);
   if(receipt.exists)return fn(tx); // v1 validates command, no double charge.
   if((active.exists?active.data().revisionId:null)!==command.baseRevision)fail('failed-precondition','Otra sesión guardó antes. No se mezclaron los cambios.');
   const actual=stored.exists?ledgerCheck(stored.data()):blank(!active.exists);
   const verified=evaluate({candidate,base,restore,ledger:actual,grant:entitlement.data(),uid,ms:clock(),trialUids});
   const result=await fn(tx);tx.set(usage,verified.ledger);return result;
  })};
  return createService({db:protectedDb,bucket:protectedBucket,now,fault})[kind](auth,command);
 }
 return {read:original.read,inspect:original.inspect,save:(a,c)=>publish(a,c,'save'),restore:(a,c)=>publish(a,c,'restore')};
}
module.exports={QUOTAS,premium,inventory,evaluate,createMediaService};
