'use strict';
const {canonical,freeze}=require('./json.cjs');
const {TABLES,verifyPlan,retainHistory}=require('./storage-model.cjs');
const {sha256}=require('./persistence.cjs');
const {proposeMigration,inspectSources,fingerprint:sourceFingerprint}=require('./storage-sources.cjs');
const STORES=['control',...TABLES,'images','commits','candidates','sources'];
// Solo nombres de laboratorio y factory explícito: no se abre una DB al importar.
function createLabDatabase({factory,name,legacy,schedule,plannerActions=null,physicalVersion=1,protocol=null,readOnly=false}){
  if(typeof name!=='string' || !name.startsWith('fullhouse-lab-'))throw Error('Solo bases de laboratorio');let connection=null;
  if(![1,2].includes(physicalVersion)||physicalVersion===2&&!protocol)throw Error('Protocolo compatible necesario para base física 2');
  async function connect(){
    if(connection)return connection;if(!factory?.open)throw Error('IndexedDB no disponible');
    return new Promise((resolve,reject)=>{let request;try{request=factory.open(name,physicalVersion);}catch(error){reject(error);return;}
      request.onupgradeneeded=()=>{if(readOnly||blocked){request.transaction.abort();return;}const db=request.result;for(const store of STORES){if(db.objectStoreNames.contains(store))continue;const s=db.createObjectStore(store,{keyPath:store==='images'?'hash':store==='control'?'key':store==='commits'||store==='candidates'||store==='sources'?'id':'key'});
        if(store==='executions'){s.createIndex('byExecutionId','executionId',{unique:true});s.createIndex('bySeriesDay','seriesDay',{unique:true});s.createIndex('byDay','day');}}};
      let blocked=false;request.onblocked=()=>{blocked=true;reject(Error('Otra conexión bloquea la versión de la base'));};
      request.onerror=()=>reject(request.error);request.onsuccess=()=>{if(blocked){request.result.close();return;}connection=request.result;const db=connection;db.onversionchange=()=>{db.close();if(connection===db)connection=null;};db.onclose=()=>{if(connection===db)connection=null;};resolve(connection);};
    });
  }
  async function transaction(names,mode,body,internal=false){if(mode==='readwrite'){if(readOnly)throw Error('Solo lectura');if(protocol&&!internal)protocol.assertWritable();}const db=await connect();return new Promise((resolve,reject)=>{
    let tx,result,error;try{try{tx=db.transaction(names,mode,{durability:'strict'});}catch(e){if(e.name!=='TypeError')throw e;tx=db.transaction(names,mode);}body(tx,value=>{result=value;},reason=>{error=reason;try{tx.abort();}catch{reject(reason);}});}catch(e){if(tx)try{tx.abort();}catch{}reject(e);return;}
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error || tx.error || new DOMException('Transacción abortada','AbortError'));tx.onerror=()=>{};
  });}
  function fetchAll(tx,names,done,fail){const values={};let remaining=names.length;for(const name of names){const r=tx.objectStore(name).getAll();r.onerror=()=>fail(r.error);r.onsuccess=()=>{values[name]=r.result;if(--remaining===0)done(values);};}}
  function verifiedHead(rows){const head=rows.control.find(r=>r.key==='head') || null;
    if(head){const receipt=rows.commits.find(c=>c.id===head.id);if(head.format!==1 || !Number.isSafeInteger(head.generation) || head.generation<1 || receipt?.rootHash!==head.rootHash || receipt?.generation!==head.generation)throw Error('Cabecera/recibo incompatibles');}
    else if(TABLES.some(t=>rows[t].length) || rows.commits.length || (!rows.candidates.length && (rows.images.length || rows.sources.length)))throw Error('Datos sin cabecera: recuperación necesaria');
    return head;
  }
  async function read(){return transaction(STORES,'readonly',(tx,done,fail)=>fetchAll(tx,STORES,rows=>{
    let head;try{head=verifiedHead(rows);}catch(error){fail(error);return;}
    const plan=head?{format:1,header:head.header,rootHash:head.rootHash,tables:Object.fromEntries(TABLES.map(t=>[t,rows[t]])),sourceBackups:rows.sources,images:rows.images.filter(i=>rows.evidence.some(e=>e.value.hash===i.hash))}:null;
    const headReceipt=head?rows.commits.find(c=>c.id===head.id):null;
    done({authority:rows.control.find(r=>r.key==='authority') || null,commitRecords:rows.commits,head,headReceipt,plan,conflict:rows.control.find(r=>r.key==='source-conflict'||r.key==='integrity-block'||r.key==='lineage-conflict') || null,candidates:rows.candidates.map(c=>({id:c.id,rootHash:c.rootHash || c.plan.rootHash,status:c.status})),sources:rows.sources,receipts:rows.commits.length,storedImages:rows.images.length});
  },fail));}
  async function open(){try{const snapshot=await read();if(snapshot.head && (snapshot.head.format!==1 || !Number.isSafeInteger(snapshot.head.generation) || snapshot.head.generation<1 || snapshot.headReceipt?.rootHash!==snapshot.head.rootHash || snapshot.headReceipt?.generation!==snapshot.head.generation))throw Error('Cabecera/recibo incompatibles');if(snapshot.plan)await verifyPlan(snapshot.plan,legacy);if(snapshot.conflict)return {status:'recovery',error:'Fuentes divergentes tras commit',...snapshot};if(protocol){const check=await protocol.opened(snapshot);return {status:snapshot.head?(check.writable?'ready':'readonly'):snapshot.candidates.length?'candidate-awaiting-confirmation':'empty',...snapshot,...check};}return {status:snapshot.head?'ready':snapshot.candidates.length?'candidate-awaiting-confirmation':'empty',...snapshot};}catch(error){return {status:'recovery',error:error.name+': '+error.message};}}
  async function commit(plan,{expected=null,id,replace=false,fault=null,migrationId=null,confirmRestore=false}={}){
    expected=expected===null?null:freeze(structuredClone(expected));plan=freeze(structuredClone(plan));await verifyPlan(plan,legacy);const operationHash=await sha256(canonical({rootHash:plan.rootHash,sources:(plan.sourceBackups || []).map(s=>[s.id,s.hash]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)}));if(typeof id!=='string'||!id.trim())throw Error('Identidad de operación necesaria');
    const context=protocol?await protocol.prepare({plan,id,expected,migrationId,operationHash,restore:confirmRestore}):null;
    const receipt=await transaction(STORES,'readwrite',(tx,done,fail)=>fetchAll(tx,STORES,rows=>{
      try{
        if(rows.control.some(r=>r.key==='source-conflict'||r.key==='integrity-block'||r.key==='lineage-conflict'))throw Error('Fuentes divergentes: escritura bloqueada');
        const previous=rows.commits.find(c=>c.id===id),head=verifiedHead(rows);if(protocol)protocol.apply(context,rows,tx);
        if(previous){if(previous.rootHash!==plan.rootHash || previous.operationHash!==operationHash)throw Error('ID reutilizado para otra operación');done({...previous,repeated:true});return;}
        if((head?.generation || 0)!==(expected?.generation || 0) || (head?.rootHash || null)!==(expected?.rootHash || null))throw Error('Operación obsoleta');
        if(!head && rows.candidates.some(c=>c.status==='staged') && !migrationId)throw Error('Selecciona y confirma un candidato; no se activa otro automáticamente');
        if(head && !replace)retainHistory(rows,plan);
        if(migrationId){const candidate=rows.candidates.find(c=>c.id===migrationId);if(!candidate || candidate.status!=='staged' || candidate.plan.rootHash!==plan.rootHash)throw Error('Candidato cambió');}
        const originalSources=new Map(rows.sources.map(s=>[s.id,s]));for(const s of plan.sourceBackups || []){if(originalSources.has(s.id) && canonical(originalSources.get(s.id))!==canonical(s))throw Error('No se sustituye una copia original');if(!originalSources.has(s.id))tx.objectStore('sources').add(s);}
        if(fault==='before-writes')throw Error('Fallo antes de escribir');
        let changedRows=0,newImages=0;
        for(const t of TABLES){const old=new Map(rows[t].map(r=>[r.key,r])),next=new Set(plan.tables[t].map(r=>r.key)),store=tx.objectStore(t);for(const r of rows[t])if(!next.has(r.key)){store.delete(r.key);changedRows++;}for(const r of plan.tables[t])if(old.get(r.key)?.hash!==r.hash){store.put(r);changedRows++;}}
        const assets=new Map(rows.images.map(i=>[i.hash,i]));for(const image of plan.images)if(!assets.has(image.hash)){tx.objectStore('images').add(image);newImages++;}
        if(fault==='after-records')throw Error('Fallo durante transacción');
        const next={key:'head',format:1,generation:(head?.generation || 0)+1,id,rootHash:plan.rootHash,header:plan.header,...(context?.headFields || {})};tx.objectStore('control').put(next);
        const receipt={id,rootHash:plan.rootHash,generation:next.generation,operationHash,changedRows,newImages,...(context?.receiptFields || {})};tx.objectStore('commits').add(receipt);
        if(migrationId){const c=rows.candidates.find(c=>c.id===migrationId);tx.objectStore('candidates').put({id:c.id,status:'committed',expected:c.expected,selection:c.selection,fingerprint:c.fingerprint,rootHash:c.plan.rootHash,receipt});}
        if(typeof fault==='function')fault(tx);
        done(receipt);
      }catch(error){fail(error);}
    },fail));
    const snapshot=await open();if(snapshot.status!=='ready')throw Error('Commit realizado; lectura no verificada: '+snapshot.error);
    if(protocol)await protocol.confirmed(context,snapshot);return {status:snapshot.head.rootHash===receipt.rootHash&&(!protocol||snapshot.head.generation===receipt.generation&&snapshot.head.id===receipt.id)?'confirmed':'committed-but-superseded',receipt,head:snapshot.head,repeated:!!receipt.repeated};
  }
  async function stageMigration(proposal,{id,expected=null,fault=null}={}){
    proposal=freeze(structuredClone(proposal));
    const rebuilt=await proposeMigration(proposal.sources,proposal.selection,legacy);if(rebuilt.plan.rootHash!==proposal.plan.rootHash || canonical(rebuilt.fingerprint)!==canonical(proposal.fingerprint))throw Error('Candidato no equivale a la fuente v1');
    await verifyPlan(proposal.plan,legacy);if(typeof id!=='string'||!id.trim())throw Error('ID de migración necesario');
    await transaction(STORES,'readwrite',(tx,done,fail)=>fetchAll(tx,STORES,rows=>{
      try{if(rows.control.some(r=>r.key==='source-conflict'||r.key==='integrity-block'||r.key==='lineage-conflict'))throw Error('Fuentes divergentes');const previous=rows.candidates.find(c=>c.id===id),head=verifiedHead(rows);
        if(previous){if((previous.rootHash || previous.plan.rootHash)!==proposal.plan.rootHash || previous.selection!==proposal.selection || canonical(previous.fingerprint)!==canonical(proposal.fingerprint))throw Error('Migración repetida diferente');done();return;}
        if((head?.generation || 0)!==(expected?.generation || 0) || (head?.rootHash || null)!==(expected?.rootHash || null))throw Error('Base de migración obsoleta');
        for(const source of ['main','alias'])tx.objectStore('sources').add({id:canonical([id,source]),migrationId:id,source,raw:proposal.sources[source],hash:proposal.fingerprint[source]});
        const existing=new Set(rows.images.map(i=>i.hash));for(const image of proposal.plan.images)if(!existing.has(image.hash))tx.objectStore('images').add(image);
        const {images,...metadata}=proposal.plan;tx.objectStore('candidates').add({id,status:'staged',expected,selection:proposal.selection,fingerprint:proposal.fingerprint,plan:metadata,imageIds:images.map(i=>i.hash)});
        if(fault==='abort')throw Error('Interrupción de preparación');done();
      }catch(error){fail(error);}
    },fail));
    return verifyCandidate(id);
  }
  async function candidate(id){return transaction(['candidates','images','sources','commits'],'readonly',(tx,done,fail)=>fetchAll(tx,['candidates','images','sources','commits'],rows=>{const c=rows.candidates.find(c=>c.id===id);if(!c){fail(Error('Candidato inexistente'));return;}done({...c,plan:c.status==='staged'?{...c.plan,images:c.imageIds.map(hash=>rows.images.find(i=>i.hash===hash))}:null,verifiedReceipt:rows.commits.find(r=>r.id===c.receipt?.id),sources:Object.fromEntries(rows.sources.filter(s=>s.migrationId===id).map(s=>[s.source,s.raw]))});},fail));}
  async function verifyCandidate(id){const c=await candidate(id),rebuilt=await proposeMigration(c.sources,c.selection,legacy);if(canonical(c.fingerprint)!==canonical(rebuilt.fingerprint) || (c.rootHash || c.plan.rootHash)!==rebuilt.plan.rootHash)throw Error('Fuentes/candidato persistidos no equivalentes');if(c.status==='staged')await verifyPlan(c.plan,legacy);else if(canonical(c.receipt)!==canonical(c.verifiedReceipt))throw Error('Recibo de migración inexistente');return c;}
  async function finalizeMigration(id,{confirm=false,readSources,fault=null}={}){
    if(!confirm || typeof readSources!=='function')throw Error('Se requiere confirmación y relectura explícitas');const c=await verifyCandidate(id);
    const current=await inspectSources(await readSources(),legacy);
    if(canonical(c.fingerprint)!==canonical(sourceFingerprint(current)))throw Error('Las fuentes cambiaron: reconciliar de nuevo');
    let result;
    if(c.status==='committed'){const snapshot=await open();if(snapshot.status!=='ready')throw Error('Recuperación necesaria');result={status:snapshot.head.rootHash===c.receipt.rootHash?'confirmed':'committed-but-superseded',receipt:c.receipt,head:snapshot.head,repeated:true};}
    else result=await commit(c.plan,{expected:c.expected,id:'migration:'+id,migrationId:id,fault});
    const after=sourceFingerprint(await inspectSources(await readSources(),legacy));
    if(canonical(after)!==canonical(c.fingerprint)){
      await transaction(['control'],'readwrite',(tx,done)=>{tx.objectStore('control').put({key:'source-conflict',expected:c.fingerprint,observed:after});done();});
      return {...result,status:'recovery',error:'Fuentes divergentes después del commit; no activar'};
    }
    return result;
  }

  async function listExecutions(day,limit=100){if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('Límite de consulta inválido');return transaction(['executions'],'readonly',(tx,done,fail)=>{const rows=[],request=tx.objectStore('executions').index('byDay').openCursor(globalThis.IDBKeyRange.only(day));request.onerror=()=>fail(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor || rows.length>=limit){done(rows);return;}rows.push(cursor.value);cursor.continue();};});}
  async function readEvidence(owner,id){const value=await transaction(['evidence','images'],'readonly',(tx,done,fail)=>{const e=tx.objectStore('evidence').get(canonical([owner,id]));e.onerror=()=>fail(e.error);e.onsuccess=()=>{if(!e.result){done(null);return;}const image=tx.objectStore('images').get(e.result.value.hash);image.onerror=()=>fail(image.error);image.onsuccess=()=>done({evidence:e.result.value,image:image.result});};});if(!value)return null;const {bytesHash}=require('./storage-model.cjs');if(!value.image || await bytesHash(value.image.blob)!==value.evidence.hash)throw Error('Evidencia corrupta');return {...value.evidence,blob:value.image.blob};}
  async function exportDiagnostic(){const rows=await transaction(STORES,'readonly',(tx,done,fail)=>fetchAll(tx,STORES,done,fail));return require('./storage-diagnostic.cjs').exportDiagnostic(rows);}
  async function protocolSnapshot(){return transaction(['control','commits','candidates'],'readonly',(tx,done,fail)=>fetchAll(tx,['control','commits','candidates'],rows=>done({head:rows.control.find(r=>r.key==='head') || null,authority:rows.control.find(r=>r.key==='authority') || null,conflict:rows.control.find(r=>['lineage-conflict','source-conflict','integrity-block'].includes(r.key)) || null,commitRecords:rows.commits,candidates:rows.candidates.map(c=>({id:c.id,status:c.status}))}),fail));}
  async function protocolOriginals(){return transaction(['sources'],'readonly',(tx,done,fail)=>fetchAll(tx,['sources'],rows=>done(rows.sources),fail));}
  async function protocolFlag(value){return transaction(['control'],'readwrite',(tx,done,fail)=>{const request=tx.objectStore('control').get('lineage-conflict');request.onerror=()=>fail(request.error);request.onsuccess=()=>{try{if(!request.result)tx.objectStore('control').put(value);done();}catch(e){fail(e);}};},true);}
  function close(){if(connection){connection.close();connection=null;}}
  const incremental=schedule?require('./storage-incremental.cjs').createIncrementalAccess({open,transaction,legacy,schedule,protocol,plannerActions}):null;
  return Object.freeze({protocolSnapshot,protocolOriginals,protocolFlag,exportDiagnostic,incremental,open,read,commit,stageMigration,verifyCandidate,finalizeMigration,listExecutions,readEvidence,close});
}
module.exports={createLabDatabase,STORES};
