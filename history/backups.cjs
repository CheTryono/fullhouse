'use strict';
const {copy,freeze,parse}=require('./json.cjs');
const codec=require('./codec.cjs');
function readBackup(raw,legacy){return codec.decode(raw,legacy);}
function exportV2(document,legacy){if(document?.version!==2)throw new Error('Solo un documento v2 completo puede exportarse como v2');return codec.encode(document,legacy);}
// Propuesta explícita en memoria para laboratorio. No lee/escribe ninguna clave.
function prepareLegacyDocument(raw,legacy){
  const parsed=readBackup(raw,legacy);if(!parsed.ok || parsed.kind!=='legacy')throw new Error('Se requiere un respaldo v1 válido');
  const document=copy(parsed.document);
  if(Object.hasOwn(document,'recipeRevisions'))throw new Error('Extensión v1 desconocida: conservar original y revisar');
  if(Object.values(document.logs).some(l=>Object.hasOwn(l,'history')))throw new Error('Extensión heredada desconocida: conservar original y revisar');
  document.version=2;document.recipeRevisions={};
  const errors=codec.validateV2(document,legacy);if(errors.length)throw new Error(errors.join('; '));
  return freeze(document);
}
function footprint(document){const raw=JSON.stringify(document);return Object.freeze({characters:raw.length,utf16Bytes:2*raw.length,dualSlotPeakBytes:4*raw.length,legacyPlusDualSlotBytes:6*raw.length});}
function readRecovery(raw,legacy){
  try{
    const r=parse(raw,128000000),fields=['format','version','confirmed','pending','drafts','storage'];
    if(!r || Object.keys(r).length!==fields.length || !fields.every(k=>Object.hasOwn(r,k)) || r.format!=='fullhouse-experimental-recovery' || r.version!==1)throw Error('Paquete incompatible');
    const decode=value=>{if(value===null)return null;const b=readBackup(value,legacy);if(!b.ok || b.kind!=='history-v2')throw Error('Copia v2 inválida');return b.document;};
    const confirmed=decode(r.confirmed),pending=decode(r.pending),drafts=copy(r.drafts),storage=r.storage;
    if(!drafts || typeof drafts!=='object' || Array.isArray(drafts) || !storage || Object.keys(storage).length!==2 || !storage.raw || typeof storage.raw!=='object' || Array.isArray(storage.raw) || !Array.isArray(storage.errors) || !storage.errors.every(e=>e && typeof e.key==='string' && typeof e.error==='string') || !Object.values(storage.raw).every(v=>v===null || typeof v==='string'))throw Error('Originales no válidos');
    return {ok:true,confirmed,pending,drafts,originals:storage};
  }catch(error){return {ok:false,error:error.message};}
}
module.exports={readBackup,exportV2,prepareLegacyDocument,footprint,readRecovery};
