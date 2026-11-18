'use strict';
// Formato físico 1 del laboratorio. Data v2 portable no cambia.
const {copy,canonical,same}=require('./json.cjs');
const {validateV2}=require('./codec.cjs');
const {sha256}=require('./persistence.cjs');
const TABLES=['goals','routines','events','revisions','executions','evidence','reviews'];
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
async function bytesHash(blob){return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function base64(bytes){let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);}
async function imageFromURL(src){
  requireValue(typeof src==='string','Evidencia sin datos');
  const match=/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(src);requireValue(match,'Formato de imagen incompatible');
  const decoded=atob(match[2]);requireValue(decoded.length<=8*1024*1024,'Imagen mayor al presupuesto experimental de 8 MiB');
  const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));requireValue(base64(bytes)===match[2],'Base64 no canónica: conservar original sin normalizar');
  const blob=new Blob([bytes]);return {hash:await bytesHash(blob),size:blob.size,blob,mime:match[1]};
}
async function dataURL(image,mime){return 'data:'+mime+';base64,'+base64(new Uint8Array(await image.blob.arrayBuffer()));}
function structuralDocument(plan){
  const maps=Object.fromEntries(TABLES.map(t=>[t,new Map(plan.tables[t].map(row=>[row.key,row.value]))]));
  const h=plan.header,doc={version:2,goals:h.goalIds.map(k=>maps.goals.get(k)),routines:h.routineIds.map(k=>maps.routines.get(k)),events:h.eventIds.map(k=>maps.events.get(k)),recipeRevisions:Object.fromEntries(h.revisionIds.map(k=>[k,maps.revisions.get(k)])),logs:{}};
  for(const key of h.logKeys){const execution=maps.executions.get(key);requireValue(execution,'Falta ejecución');
    const log=copy(execution.log);if(execution.hasEvidences)log.evidences=execution.evidenceKeys.map(k=>{const e=maps.evidence.get(k);requireValue(e && e.owner===execution.owner,'Referencia de evidencia rota');const {owner,hash,mime,...value}=e;return {...value,src:'data:'+mime+';base64,AA=='};});
    Object.defineProperty(doc.logs,key,{value:log,enumerable:true});
  }
  if(h.dayReviewsPresent)doc.dayReviews=Object.fromEntries(h.reviewDates.map(k=>[k,maps.reviews.get(k)]));return doc;
}
function validateMetadata(doc,legacy){
  requireValue(doc && doc.version===2 && Object.keys(doc).every(k=>['version','goals','routines','events','logs','recipeRevisions','dayReviews'].includes(k)),'Documento raíz incompatible');
  requireValue(legacy({...doc,version:1}),'Entidades básicas inválidas');
  const empty={version:2,goals:[],routines:[],events:[],logs:{},recipeRevisions:{}};
  // Validar revisión y ejecución completas por separado evita un límite global de nodos.
  for(const [id,r] of Object.entries(doc.recipeRevisions))requireValue(validateV2({...empty,recipeRevisions:{[id]:r}},legacy).length===0,'Revisión histórica inválida');
  const executions=new Set(),occurrences=new Set();
  for(const [key,log] of Object.entries(doc.logs)){
    let revisions={};if(log.history!==undefined){const c=log.history?.capture;requireValue(c,'Captura incompleta');const pair=canonical([c.seriesId,c.scheduledDate]);requireValue(!executions.has(c.executionId)&&!occurrences.has(pair),'Identidad histórica duplicada');executions.add(c.executionId);occurrences.add(pair);
      if(c.recipeRevisionId!==null){const r=doc.recipeRevisions[c.recipeRevisionId];requireValue(r,'Referencia histórica inexistente');revisions={[c.recipeRevisionId]:r};}}
    requireValue(validateV2({...empty,logs:{[key]:log},recipeRevisions:revisions},legacy).length===0,'Registro inválido: '+key);
  }
  for(const g of doc.goals)requireValue(validateV2({...empty,goals:[g]},legacy).length===0,'Meta inválida');
  for(const r of doc.routines)requireValue(validateV2({...empty,routines:[r]},legacy).length===0,'Rutina inválida');
  for(const e of doc.events){const refs=e.recipeRevisionId?{[e.recipeRevisionId]:doc.recipeRevisions[e.recipeRevisionId]}:{};requireValue(validateV2({...empty,events:[e],recipeRevisions:refs},legacy).length===0,'Programación inválida');}
}
async function rootHash(plan){return sha256(canonical({format:1,header:plan.header,tables:Object.fromEntries(TABLES.map(t=>[t,plan.tables[t].map(r=>[r.key,r.hash]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)])),images:plan.images.map(i=>[i.hash,i.size]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)}));}
async function prepareDocument(document,legacy){
  requireValue(document && typeof document==='object' && !Array.isArray(document),'Se requiere un documento');
  for(const key of Object.keys(document))requireValue(Object.hasOwn(Object.getOwnPropertyDescriptor(document,key),'value'),'No se permiten getters');
  requireValue(document.version===2,'Se requiere un documento v2');
  const source=document;
  requireValue(Object.keys(source).every(k=>['version','goals','routines','events','recipeRevisions','logs','dayReviews'].includes(k)),'Campo raíz desconocido');
  for(const t of ['goals','routines','events'])requireValue(Array.isArray(source[t]),'Colección inválida');
  for(const t of ['logs','recipeRevisions'])requireValue(source[t] && typeof source[t]==='object' && !Array.isArray(source[t]),'Diccionario inválido');
  if(Object.hasOwn(source,'dayReviews'))requireValue(source.dayReviews && typeof source.dayReviews==='object' && !Array.isArray(source.dayReviews),'Revisiones inválidas');
  // Snapshot completo de metadatos antes del primer await; strings de fotos son inmutables.
  document={version:2,goals:source.goals.map(copy),routines:source.routines.map(copy),events:source.events.map(copy),logs:Object.fromEntries(Object.entries(source.logs).map(([k,v])=>[k,copy(v)])),recipeRevisions:Object.fromEntries(Object.entries(source.recipeRevisions).map(([k,v])=>[k,copy(v)])),...(Object.hasOwn(source,'dayReviews')?{dayReviews:Object.fromEntries(Object.entries(source.dayReviews).map(([k,v])=>[k,copy(v)]))}:{})};
  const tables=Object.fromEntries(TABLES.map(t=>[t,[]])),images=new Map(),sourceImages=new Map();
  const keySets=Object.fromEntries(TABLES.map(t=>[t,new Set()]));
  const put=(t,key,value,extra={})=>{requireValue(typeof key==='string' && key.length>0,'Clave inválida');requireValue(!keySets[t].has(key),'Clave duplicada');keySets[t].add(key);tables[t].push({key,value,...extra});};
  for(const t of ['goals','routines','events']){requireValue(Array.isArray(document[t]),'Falta colección '+t);for(const entity of document[t]){const value=copy(entity);put(t,value.id,value);}}
  requireValue(document.logs && typeof document.logs==='object' && !Array.isArray(document.logs) && document.recipeRevisions && typeof document.recipeRevisions==='object' && !Array.isArray(document.recipeRevisions),'Diccionarios inválidos');
  for(const [key,value] of Object.entries(document.recipeRevisions))put('revisions',key,copy(value));
  for(const [key,source] of Object.entries(document.logs)){
    const log=copy(source),owner=log.history?.capture?.executionId?'execution:'+log.history.capture.executionId:'legacy:'+key,evidenceKeys=[];
    for(const photo of log.evidences || []){
      let image=sourceImages.get(photo.src);if(!image){image=await imageFromURL(photo.src);sourceImages.set(photo.src,image);}images.set(image.hash,{hash:image.hash,size:image.size,blob:image.blob});
      const id=canonical([owner,photo.id]),{src,...value}=photo;put('evidence',id,{...value,owner,hash:image.hash,mime:image.mime});evidenceKeys.push(id);
    }
    const hasEvidences=Object.hasOwn(log,'evidences');delete log.evidences;
    const c=log.history?.capture,day=c?.scheduledDate || /@(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];
    put('executions',key,{log,owner,hasEvidences,evidenceKeys}, {...(c?{executionId:c.executionId,seriesDay:[c.seriesId,c.scheduledDate]}:{}),...(day?{day}:{})});
  }
  requireValue(!Object.hasOwn(document,'dayReviews') || document.dayReviews && typeof document.dayReviews==='object' && !Array.isArray(document.dayReviews),'Revisiones diarias incompatibles');
  for(const [key,value] of Object.entries(document.dayReviews || {}))put('reviews',key,copy(value));
  const plan={format:1,header:{version:2,goalIds:tables.goals.map(r=>r.key),routineIds:tables.routines.map(r=>r.key),eventIds:tables.events.map(r=>r.key),revisionIds:tables.revisions.map(r=>r.key),logKeys:tables.executions.map(r=>r.key),reviewDates:tables.reviews.map(r=>r.key),dayReviewsPresent:Object.hasOwn(document,'dayReviews')},tables,images:[...images.values()]};
  requireValue(Object.keys(document).every(k=>['version','goals','routines','events','recipeRevisions','logs','dayReviews'].includes(k)),'Campo raíz desconocido');
  validateMetadata(structuralDocument(plan),legacy);
  await Promise.all(TABLES.flatMap(t=>tables[t].map(async row=>{row.hash=await sha256(canonical(row.value));})));
  plan.rootHash=await rootHash(plan);return plan;
}
async function verifyPlan(plan,legacy){
  requireValue(plan?.format===1 && Array.isArray(plan.images),'Formato físico incompatible');
  const headerFields=['version','goalIds','routineIds','eventIds','revisionIds','logKeys','reviewDates','dayReviewsPresent'];
  requireValue(plan.header && Object.keys(plan.header).length===headerFields.length && headerFields.every(k=>Object.hasOwn(plan.header,k)) && plan.header.version===2 && typeof plan.header.dayReviewsPresent==='boolean','Encabezado físico incompatible');
  const all=new Set();for(const t of TABLES){requireValue(Array.isArray(plan.tables[t]),'Store ausente');const seen=new Set();for(const r of plan.tables[t]){requireValue(Object.keys(r).every(k=>(t==='executions'?['key','value','hash','day','executionId','seriesDay']:['key','value','hash']).includes(k)),'Campo físico desconocido');requireValue(!seen.has(r.key) && r.hash===await sha256(canonical(r.value)),'Metadatos corruptos/duplicados');seen.add(r.key);} }
  for(const row of plan.tables.executions){const v=row.value,c=v.log?.history?.capture,day=c?.scheduledDate || /@(\d{4}-\d{2}-\d{2})$/.exec(row.key)?.[1];requireValue(Object.keys(v).length===4 && typeof v.hasEvidences==='boolean' && Array.isArray(v.evidenceKeys) && new Set(v.evidenceKeys).size===v.evidenceKeys.length && v.owner===(c?'execution:'+c.executionId:'legacy:'+row.key) && row.executionId===c?.executionId && same(row.seriesDay,c?[c.seriesId,c.scheduledDate]:undefined) && row.day===day,'Identidad/índice físico inválido');}
  for(const row of plan.tables.evidence)requireValue(Object.keys(row.value).every(k=>['id','kind','caption','stepId','createdAt','owner','hash','mime'].includes(k)) && row.key===canonical([row.value.owner,row.value.id]),'Referencia física de evidencia inválida');
  for(const image of plan.images){requireValue(!all.has(image.hash) && image.blob instanceof Blob && image.size>0 && image.size<=8*1024*1024 && image.size===image.blob.size && image.hash===await bytesHash(image.blob),'Imagen corrupta');all.add(image.hash);}
  requireValue(plan.tables.evidence.every(e=>all.has(e.value.hash)) && new Set(plan.tables.evidence.map(e=>e.value.hash)).size===all.size,'Falta imagen referenciada o existe imagen sin dueño');
  const sourceIds=new Set();for(const source of plan.sourceBackups || []){requireValue(source && Object.keys(source).length===5 && ['main','alias'].includes(source.source) && typeof source.migrationId==='string' && source.id===canonical([source.migrationId,source.source]) && !sourceIds.has(source.id) && (source.raw===null || typeof source.raw==='string'),'Copia de fuente inválida/duplicada');requireValue(source.hash===(source.raw===null?null:await sha256(source.raw)),'Original de migración corrupto');sourceIds.add(source.id);}
  const doc=structuralDocument(plan);validateMetadata(doc,legacy);requireValue(plan.rootHash===await rootHash(plan),'Integridad raíz inválida');
  // Todas las filas deben estar referenciadas por el encabezado o sus ejecuciones.
  for(const [t,field] of [['goals','goalIds'],['routines','routineIds'],['events','eventIds'],['revisions','revisionIds'],['executions','logKeys'],['reviews','reviewDates']]){const ids=plan.header[field];requireValue(Array.isArray(ids) && ids.every(k=>typeof k==='string') && new Set(ids).size===ids.length && ids.length===plan.tables[t].length && ids.every(k=>plan.tables[t].some(r=>r.key===k)),'Filas ocultas o duplicadas');}
  requireValue(plan.header.dayReviewsPresent || plan.tables.reviews.length===0,'Revisiones diarias ocultas');
  const owners=new Set(plan.tables.executions.flatMap(r=>r.value.evidenceKeys));requireValue(owners.size===plan.tables.evidence.length,'Evidencias sin dueño');return plan;
}
async function hydrate(plan,legacy){await verifyPlan(plan,legacy);const doc=structuralDocument(plan),assets=new Map(plan.images.map(i=>[i.hash,i]));
  for(const row of plan.tables.executions)if(row.value.hasEvidences)doc.logs[row.key].evidences=await Promise.all(row.value.evidenceKeys.map(key=>{const e=plan.tables.evidence.find(e=>e.key===key).value;const {owner,hash,mime,...value}=e;return (async()=>({...value,src:await dataURL(assets.get(hash),mime)}))();}));return doc;
}
function retainHistory(oldTables,next){
  const map=t=>new Map(next.tables[t].map(r=>[r.key,r]));
  const revisions=map('revisions'),evidence=map('evidence'),owners=new Map(next.tables.executions.map(r=>[r.value.owner,r]));
  for(const r of oldTables.revisions)requireValue(same(r.value,revisions.get(r.key)?.value),'No se cambia ni elimina una revisión histórica');
  for(const row of oldTables.executions){const current=owners.get(row.value.owner);requireValue(current,'No se elimina un registro histórico/legado');const before=row.value.log,after=current.value.log;
    if(before.history){requireValue(same(before.history.capture,after.history?.capture),'Captura inmutable');requireValue(same(before.history.corrections,after.history.corrections.slice(0,before.history.corrections.length)),'No se reescribe auditoría');requireValue(same(before.history.continuations,after.history.continuations.slice(0,before.history.continuations.length)),'No se reescribe continuidad');if(same(before.choices || {},after.choices || {}))requireValue(same(before.history.resolution,after.history.resolution),'No se recalcula resolución sin elección');}else requireValue(same(row.value,current.value),'Adopción/edición de legado no implementada');
  }
  for(const row of oldTables.evidence)requireValue(same(row.value,evidence.get(row.key)?.value),'No se elimina ni sustituye evidencia');
}
module.exports={TABLES,prepareDocument,verifyPlan,hydrate,rootHash,bytesHash,retainHistory};
