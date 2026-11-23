'use strict';
const {LIMITS,fail,hash,isId,isHash,fields,identity,operation,packBackup,unpackBackup} = require('./contract.cjs');
const RECEIPT_FIELDS = ['uid','operationId','revisionId','baseRevision','sequence','requestHash','kind','restoredFrom','createdAt'];
const REVISION_FIELDS = [...RECEIPT_FIELDS,'backupHash','snapshotHash','snapshotBytes','photoCount'];
const MAX_SNAPSHOT = LIMITS.snapshotBytes;
function createService({db,bucket,now,fault = async () => {}}) {
  const ref = (uid, collection, id) => db.doc(`users/${uid}/${collection}/${id}`);
  const object = (uid, name) => bucket.file(`users/${uid}/${name}`);
  function shape(value, names) { try { fields(value,names); } catch { fail('data-loss','Los metadatos guardados no son válidos. No se ha sobrescrito la revisión.'); } }
  function receipt(value, uid) {
    shape(value,RECEIPT_FIELDS);
    if (value.uid !== uid || !isId(value.operationId) || value.revisionId !== value.operationId || !(value.baseRevision === null || isId(value.baseRevision)) || !Number.isSafeInteger(value.sequence) || value.sequence < 1 || !isHash(value.requestHash) || !['save','restore'].includes(value.kind) || !(value.restoredFrom === null || isId(value.restoredFrom)) || (value.kind === 'save') !== (value.restoredFrom === null) || !Number.isFinite(value.createdAt?.toMillis?.())) fail('data-loss','El recibo almacenado es incompatible.');
    return value;
  }
  function revision(value,uid) {
    shape(value,REVISION_FIELDS);
    receipt(Object.fromEntries(RECEIPT_FIELDS.map(k=>[k,value[k]])),uid);
    if (!isHash(value.backupHash) || !isHash(value.snapshotHash) || !Number.isSafeInteger(value.snapshotBytes) || value.snapshotBytes < 1 || value.snapshotBytes > MAX_SNAPSHOT || !Number.isSafeInteger(value.photoCount) || value.photoCount < 0 || value.photoCount > LIMITS.photos) fail('data-loss','La revisión almacenada es incompatible.');
    return value;
  }
  function head(value,uid) {
    shape(value,['uid','revisionId','sequence','format']);
    if (value.uid !== uid || !isId(value.revisionId) || !Number.isSafeInteger(value.sequence) || value.sequence < 1 || value.format !== 1) fail('data-loss','El índice de revisiones no es válido.');
    return value;
  }
  async function readObject(uid,name,sha,bytes) {
    try {
      const file = object(uid,name), [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== bytes) fail('data-loss','El tamaño de un archivo guardado no coincide.');
      const [content] = await file.download();
      if (content.length !== bytes || hash(content) !== sha) fail('data-loss','Un archivo guardado no coincide con su huella.');
      return content;
    } catch (e) {
      if (e.code === 404) fail('data-loss','Falta un archivo de la revisión. No se sustituirá por datos vacíos.');
      throw e;
    }
  }
  async function putImmutable(uid,name,content,contentType) {
    try {
      await object(uid,name).save(content,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0},metadata:{contentType,cacheControl:'private,no-store'}});
    } catch (e) {
      if (e.code !== 412 && e.code !== 409) throw e;
      // A retry can reuse only byte-identical content; it never replaces an object.
    }
    await readObject(uid,name,hash(content),content.length);
  }
  async function loadRevision(uid,id) {
    const snap = await ref(uid,'revisions',id).get();
    if (!snap.exists) fail('not-found','No se encontró esa revisión en tu cuenta.');
    const r = revision(snap.data(),uid);
    if (r.revisionId !== id) fail('data-loss','La revisión tiene otra identidad.');
    const content = await readObject(uid,`revisions/${id}.json`,r.snapshotHash,r.snapshotBytes);
    const backup = await unpackBackup(content,(sha,bytes)=>readObject(uid,`photos/${sha}.dataurl`,sha,bytes));
    if (hash(backup) !== r.backupHash) fail('data-loss','El respaldo reconstruido no coincide con la revisión.');
    return {metadata:r,backup};
  }
  async function confirmed(uid,value) {
    const r = receipt(value,uid), stored = await ref(uid,'operations',r.operationId).get();
    if (!stored.exists) fail('unavailable','No se pudo confirmar el recibo. Conserva el pendiente e inspecciona la operación antes de reintentar.');
    const actual = receipt(stored.data(),uid);
    if (actual.requestHash !== r.requestHash || actual.sequence !== r.sequence || actual.createdAt.toMillis() !== r.createdAt.toMillis()) fail('data-loss','El recibo confirmado no coincide con la operación.');
    const loaded = await loadRevision(uid,r.revisionId);
    for (const k of RECEIPT_FIELDS.filter(k=>k!=='createdAt')) if (loaded.metadata[k] !== actual[k]) fail('data-loss','El recibo y la revisión no coinciden.');
    if (loaded.metadata.createdAt.toMillis() !== actual.createdAt.toMillis()) fail('data-loss','Las fechas del recibo y la revisión no coinciden.');
    return {operationId:actual.operationId,revisionId:actual.revisionId,sequence:actual.sequence,baseRevision:actual.baseRevision,backupHash:loaded.metadata.backupHash};
  }
  async function publish(auth,command,kind) {
    const uid = identity(auth); operation(command,kind);
    const raw = kind === 'restore' ? (await loadRevision(uid,command.restoreRevision)).backup : command.backup;
    const packed = packBackup(raw);
    const requestHash = hash(JSON.stringify({uid,kind,operationId:command.operationId,baseRevision:command.baseRevision,backupHash:packed.backupHash,restoredFrom:command.restoreRevision || null}));
    const operationRef = ref(uid,'operations',command.operationId), revisionRef = ref(uid,'revisions',command.operationId), headRef = ref(uid,'storage','head');
    const previous = await operationRef.get();
    if (previous.exists) {
      const r = receipt(previous.data(),uid);
      if (r.requestHash !== requestHash) fail('already-exists','Esta identidad ya pertenece a otra operación. Conserva ambos borradores.');
      return confirmed(uid,r);
    }
    const current = await headRef.get();
    if ((current.exists ? head(current.data(),uid).revisionId : null) !== command.baseRevision) fail('failed-precondition','Hay una revisión diferente en el servidor. Conserva tu borrador y concilia los cambios.');
    await fault('before-upload');
    for (const [sha,bytes] of packed.photos) await putImmutable(uid,`photos/${sha}.dataurl`,bytes,'text/plain; charset=utf-8');
    await putImmutable(uid,`revisions/${command.operationId}.json`,packed.snapshot,'application/json');
    await fault('after-upload');
    await fault('before-transaction');
    const result = await db.runTransaction(async tx => {
      const [op,active,target] = await tx.getAll(operationRef,headRef,revisionRef);
      if (op.exists) {
        const r = receipt(op.data(),uid);
        if (r.requestHash !== requestHash) fail('already-exists','La identidad de operación ya está utilizada.');
        return r;
      }
      const base = active.exists ? head(active.data(),uid) : null;
      if ((base?.revisionId || null) !== command.baseRevision) fail('failed-precondition','Otra sesión guardó cambios. Tu borrador se conserva y requiere conciliación.');
      if (target.exists) fail('data-loss','Existe una revisión sin recibo coherente. Se requiere recuperación explícita.');
      if (base) {
        const parent = await tx.get(ref(uid,'revisions',base.revisionId));
        if (!parent.exists || revision(parent.data(),uid).sequence !== base.sequence || parent.data().revisionId !== base.revisionId) fail('data-loss','Falta la revisión base o su identidad/secuencia no coincide.');
      }
      const r = {uid,operationId:command.operationId,revisionId:command.operationId,baseRevision:command.baseRevision,sequence:(base?.sequence || 0)+1,requestHash,kind,restoredFrom:command.restoreRevision || null,createdAt:now()};
      if (!Number.isSafeInteger(r.sequence)) fail('resource-exhausted','Se alcanzó el límite de revisiones admitidas.');
      tx.create(revisionRef,{...r,backupHash:packed.backupHash,snapshotHash:packed.snapshotHash,snapshotBytes:packed.snapshot.length,photoCount:packed.photos.size});
      tx.create(operationRef,r);
      tx.set(headRef,{uid,revisionId:r.revisionId,sequence:r.sequence,format:1});
      await fault('transaction');
      return r;
    });
    await fault('after-commit');
    await fault('confirmation');
    return confirmed(uid,result);
  }
  return {
    save: (auth,data)=>publish(auth,data,'save'),
    restore: (auth,data)=>publish(auth,data,'restore'),
    async read(auth,data) {
      const uid = identity(auth); fields(data,['revisionId']);
      if (!(data.revisionId === null || isId(data.revisionId))) fail('invalid-argument','Revisión no válida.');
      let id = data.revisionId;
      if (!id) {
        const current = await ref(uid,'storage','head').get();
        if (!current.exists) return null;
        const h = head(current.data(),uid); id = h.revisionId;
        const loaded = await loadRevision(uid,id);
        if (loaded.metadata.sequence !== h.sequence) fail('data-loss','El índice y la revisión no coinciden.');
        return {revisionId:id,backup:loaded.backup,backupHash:loaded.metadata.backupHash};
      }
      const loaded = await loadRevision(uid,id);
      return {revisionId:id,backup:loaded.backup,backupHash:loaded.metadata.backupHash};
    },
    async inspect(auth,data) {
      const uid = identity(auth); fields(data,['operationId']);
      if (!isId(data.operationId)) fail('invalid-argument','Identidad de operación no válida.');
      const op = await ref(uid,'operations',data.operationId).get();
      return op.exists ? confirmed(uid,op.data()) : null;
    }
  };
}
module.exports = {createService};
