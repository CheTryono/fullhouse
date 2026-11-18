'use strict';
const {copy,freeze,canonical,same}=require('./json.cjs');
const {readBackup,exportV2,prepareLegacyDocument}=require('./backups.cjs');
const KEYS=Object.freeze({legacy:'fullhouse-v01',historical:'botanica-planificador-v01',a:'fullhouse-v02',b:'fullhouse-v02-slot-b',manifest:'fullhouse-v02-manifest',intent:'fullhouse-v02-intent'});
async function sha256(raw){const bytes=new Uint8Array(raw.length*2);for(let i=0;i<raw.length;i++){const n=raw.charCodeAt(i);bytes[i*2]=n&255;bytes[i*2+1]=n>>>8;}const result=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');}
const hashString=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
function createRepository({storage,lock,legacy,digest=sha256}){
  if(!storage || !lock?.exclusive || typeof legacy!=='function')throw new Error('Se requiere almacenamiento y exclusión inyectados');
  const operations=new WeakSet(),tokens=new WeakSet();let observed={};
  const hash=raw=>raw===null?Promise.resolve(null):digest(raw);
  const fail=message=>{throw new Error(message);};
  function parse(raw,fields){const v=JSON.parse(raw);if(!v || Array.isArray(v) || Object.keys(v).length!==fields.length || !fields.every(k=>Object.hasOwn(v,k)) || canonical(v)!==raw)fail('Metadatos incompatibles o corruptos');return v;}
  function manifest(raw){
    const m=parse(raw,['protocol','documentVersion','generation','id','slot','documentHash','sourceHash','previousHash','checksum']);
    if(!hashString(m.checksum) || m.protocol!==1 || m.documentVersion!==2 || !Number.isSafeInteger(m.generation) || m.generation<1 || !m.id || typeof m.id!=='string' || ![KEYS.a,KEYS.b].includes(m.slot) || !hashString(m.documentHash) || !(m.sourceHash===null || hashString(m.sourceHash)) || !(m.previousHash===null || hashString(m.previousHash)))fail('Manifiesto incompatible');return m;
  }
  async function checkedManifest(raw){const m=manifest(raw),payload={...m};delete payload.checksum;if(await hash(canonical(payload))!==m.checksum)fail('Checksum del manifiesto inválido');return m;}
  function decodeV2(raw){const r=readBackup(raw,legacy);if(!r.ok || r.kind!=='history-v2')fail('Documento v2 inválido');return r.document;}
  async function snapshot(){const result={};for(const key of Object.values(KEYS)){result[key]=await storage.read(key);observed[key]=result[key];}if(result[KEYS.historical]!==null)fail('Origen anterior presente: revisar el alias histórico antes de habilitar v2');return result;}
  async function source(raw){if(raw!==null){const d=readBackup(raw,legacy);if(!d.ok || d.kind!=='legacy')fail('Origen v1 corrupto o incompatible');}return hash(raw);}
  async function verify(s,raw,checkOther=false){const m=await checkedManifest(raw);if(await source(s[KEYS.legacy])!==m.sourceHash)fail('v1 cambió: historiales divergentes');if(await hash(s[m.slot])!==m.documentHash)fail('La integridad del documento no coincide');if(checkOther){const other=m.slot===KEYS.a?KEYS.b:KEYS.a;if(m.previousHash===null?s[other]!==null:await hash(s[other])!==m.previousHash)fail('Ranura anterior ambigua o corrupta');if(s[other]!==null)decodeV2(s[other]);}return {m,document:decodeV2(s[m.slot])};}
  function token(raw,sourceHash,document){const t=freeze({manifestRaw:raw,sourceHash,sourceRaw:observed[KEYS.legacy],document});tokens.add(t);return t;}
  async function open(){return lock.exclusive(async()=>{
    try{const s=await snapshot();const sourceHash=await source(s[KEYS.legacy]);if(s[KEYS.intent]!==null)fail('Intento interrumpido: requiere recuperación explícita');
      if(s[KEYS.manifest]===null){if(s[KEYS.a]!==null || s[KEYS.b]!==null)fail('Copias sin manifiesto: no se elige una automáticamente');return {status:'uninitialized',token:token(null,sourceHash,null)};}
      const v=await verify(s,s[KEYS.manifest],true);return {status:'ready',document:v.document,token:token(s[KEYS.manifest],sourceHash,v.document)};
    }catch(error){return {status:'recovery',error:error.message,originals:freeze(copy(observed))};}
  });}
  async function prepare(base,document,id){
    if(!tokens.has(base) || typeof id!=='string' || !id.trim())fail('Base/identidad inválida');
    if(base.manifestRaw===null && base.sourceRaw!==null){const proposal=prepareLegacyDocument(base.sourceRaw,legacy);if(!same(document,proposal))fail('La inicialización debe conservar íntegros los hechos v1');}
    const raw=exportV2(document,legacy),documentHash=await hash(raw),previous=base.manifestRaw===null?null:manifest(base.manifestRaw);
    if(previous?.id===id)fail('Identidad de commit reutilizada');
    const next={protocol:1,documentVersion:2,generation:(previous?.generation || 0)+1,id,slot:previous?.slot===KEYS.a?KEYS.b:KEYS.a,documentHash,sourceHash:base.sourceHash,previousHash:previous?.documentHash || null};
    next.checksum=await hash(canonical(next));
    const nextRaw=canonical(next),intentRaw=canonical({protocol:1,baseManifest:base.manifestRaw,nextManifest:nextRaw});
    const op=freeze({baseManifest:base.manifestRaw,nextManifest:nextRaw,intentRaw,raw,document:decodeV2(raw)});operations.add(op);return op;
  }
  async function write(op){if(!operations.has(op))fail('Operación no preparada');return lock.exclusive(async()=>{
    let s=await snapshot();const m=manifest(op.nextManifest);
    if(await source(s[KEYS.legacy])!==m.sourceHash)fail('v1 cambió: detener escrituras y recuperar ambas ramas');
    if(s[KEYS.manifest]!==op.baseManifest && s[KEYS.manifest]!==op.nextManifest)fail('Operación obsoleta: otra pestaña confirmó cambios');
    if(s[KEYS.intent]!==null && s[KEYS.intent]!==op.intentRaw)fail('Otro intento está pendiente');
    if(s[KEYS.manifest]!==op.nextManifest){
      if(op.baseManifest!==null)await verify(s,op.baseManifest,s[KEYS.intent]===null);
      else if(s[KEYS.intent]===null && (s[KEYS.a]!==null || s[KEYS.b]!==null))fail('Copias ambiguas antes de activar');
      if(s[KEYS.intent]===null){await storage.write(KEYS.intent,op.intentRaw);if(await storage.read(KEYS.intent)!==op.intentRaw)fail('No se verificó el intento');}
      await storage.write(m.slot,op.raw);
      if(await storage.read(m.slot)!==op.raw)fail('Lectura posterior no verificada');
      s=await snapshot();if(s[KEYS.manifest]!==op.baseManifest || s[KEYS.intent]!==op.intentRaw || s[m.slot]!==op.raw || await source(s[KEYS.legacy])!==m.sourceHash)fail('Cambio concurrente: recuperación necesaria');
      await storage.write(KEYS.manifest,op.nextManifest);
    }
    s=await snapshot();if(s[KEYS.manifest]!==op.nextManifest)fail('Manifiesto no confirmado');
    await verify(s,op.nextManifest);
    if(s[m.slot]!==op.raw)fail('El candidato cambió');
    if(s[KEYS.intent]!==null)await storage.remove(KEYS.intent);
    s=await snapshot();if(s[KEYS.intent]!==null || s[KEYS.manifest]!==op.nextManifest)fail('Finalización ambigua');
    const valid=await verify(s,op.nextManifest,true);
    return {document:valid.document,token:token(op.nextManifest,m.sourceHash,valid.document)};
  });}
  async function recoverOperation(){return lock.exclusive(async()=>{
    const s=await snapshot();if(s[KEYS.intent]===null)fail('No hay intento recuperable');
    const intent=parse(s[KEYS.intent],['protocol','baseManifest','nextManifest']);if(intent.protocol!==1)fail('Intento incompatible');
    const next=await checkedManifest(intent.nextManifest),base=intent.baseManifest===null?null:await checkedManifest(intent.baseManifest);
    if(next.generation!==(base?.generation || 0)+1 || next.previousHash!==(base?.documentHash || null) || base?.slot===next.slot || next.sourceHash!==(base?base.sourceHash:next.sourceHash))fail('Cadena de intento inválida');
    if(s[KEYS.manifest]!==intent.baseManifest && s[KEYS.manifest]!==intent.nextManifest)fail('Historial divergente');
    if(await source(s[KEYS.legacy])!==next.sourceHash || await hash(s[next.slot])!==next.documentHash)fail('Falta candidato íntegro o cambió v1');
    if(base)await verify(s,intent.baseManifest);
    const op=freeze({baseManifest:intent.baseManifest,nextManifest:intent.nextManifest,intentRaw:s[KEYS.intent],raw:s[next.slot],document:decodeV2(s[next.slot])});operations.add(op);return op;
  });}
  async function originals(){const errors=[];for(const key of Object.values(KEYS))try{observed[key]=await storage.read(key);}catch(e){errors.push({key,error:e.message});}return freeze({raw:copy(observed),errors});}
  return Object.freeze({open,prepare,write,recoverOperation,originals});
}
module.exports={KEYS,sha256,createRepository};
