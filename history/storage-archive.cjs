'use strict';
const {parse,canonical}=require('./json.cjs');
const {TABLES,verifyPlan}=require('./storage-model.cjs');
const {sha256}=require('./persistence.cjs');
const MAGIC='FULLHOUSE-ARCHIVE-1\n',MAX_FRAME=16*1024*1024;
function prefix(size){if(!Number.isSafeInteger(size)||size<0||size>MAX_FRAME)throw Error('Parte de respaldo demasiado grande');const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,size);return b;}
function jsonFrame(value){const bytes=new TextEncoder().encode(JSON.stringify(value));return [prefix(bytes.length),bytes];}
async function exportArchive(plan,legacy){
  await verifyPlan(plan,legacy);
  if(TABLES.reduce((n,t)=>n+plan.tables[t].length,0)>100000 || plan.images.length>10000 || (plan.sourceBackups || []).length>1000)throw Error('El archivo excede el presupuesto portable del prototipo');
  const sources=plan.sourceBackups || [],sourceDescriptors=await Promise.all(sources.map(async s=>({id:s.id,hash:await sha256(canonical(s))})));
  const manifest={format:'fullhouse-history-archive',version:1,storageFormat:1,header:plan.header,rootHash:plan.rootHash,counts:Object.fromEntries(TABLES.map(t=>[t,plan.tables[t].length])),images:plan.images.map(({hash,size})=>({hash,size})),sources:sourceDescriptors};
  manifest.checksum=await sha256(canonical(manifest));
  const parts=[MAGIC,...jsonFrame(manifest)];
  for(const t of TABLES)for(const row of plan.tables[t])parts.push(...jsonFrame({store:t,row}));
  for(const source of sources)parts.push(...jsonFrame(source));
  for(const image of plan.images)parts.push(prefix(image.size),image.blob);
  const result=new Blob(parts,{type:'application/octet-stream'});if(result.size>512*1024*1024)throw Error('Archivo mayor a 512 MiB; conservar datos y revisar presupuesto');return result;
}
async function importArchive(blob,legacy){
  if(!(blob instanceof Blob) || blob.size>512*1024*1024)throw Error('Respaldo no compatible o mayor a 512 MiB del prototipo');
  if(await blob.slice(0,MAGIC.length).text()!==MAGIC)throw Error('Cabecera de respaldo inválida');let offset=MAGIC.length;
  async function frame(){if(offset+4>blob.size)throw Error('Respaldo truncado');const n=new DataView(await blob.slice(offset,offset+4).arrayBuffer()).getUint32(0);offset+=4;if(n>MAX_FRAME || offset+n>blob.size)throw Error('Parte inválida/truncada');const part=blob.slice(offset,offset+n);offset+=n;return part;}
  const manifest=parse(await (await frame()).text());
  if(manifest.format!=='fullhouse-history-archive' || manifest.version!==1 || manifest.storageFormat!==1 || !manifest.counts || !Array.isArray(manifest.images) || Object.keys(manifest).length!==9 || !Array.isArray(manifest.sources))throw Error('Versión de archivo incompatible');
  const {checksum,...manifestBody}=manifest;if(checksum!==await sha256(canonical(manifestBody)))throw Error('Checksum del archivo inválido');
  const tables=Object.fromEntries(TABLES.map(t=>[t,[]]));let count=0;
  for(const t of TABLES){const n=manifest.counts[t];if(!Number.isSafeInteger(n)||n<0||(count+=n)>100000)throw Error('Cantidad de registros incompatible');for(let i=0;i<n;i++){const part=parse(await (await frame()).text());if(part.store!==t || Object.keys(part).length!==2)throw Error('Store incorrecto');tables[t].push(part.row);}}
  if(manifest.sources.length>1000)throw Error('Demasiadas fuentes');
  const sourceBackups=[];for(const descriptor of manifest.sources){const source=parse(await (await frame()).text());if(!source || source.id!==descriptor.id || !['main','alias'].includes(source.source) || !(source.raw===null || typeof source.raw==='string') || await sha256(canonical(source))!==descriptor.hash)throw Error('Copia de origen inválida');sourceBackups.push(source);}
  if(manifest.images.length>10000)throw Error('Demasiadas imágenes para el prototipo');
  const images=[];for(const entry of manifest.images){const image=await frame();if(image.size!==entry.size)throw Error('Tamaño de imagen incorrecto');images.push({...entry,blob:image});}
  if(offset!==blob.size)throw Error('Datos adicionales no reconocidos');
  const plan={format:1,header:manifest.header,tables,images,rootHash:manifest.rootHash,sourceBackups};await verifyPlan(plan,legacy);return plan;
}
module.exports={exportArchive,importArchive};
