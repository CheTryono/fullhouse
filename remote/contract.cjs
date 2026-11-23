'use strict';
const {createHash} = require('node:crypto');
const {validData} = require('./v1-validator.cjs');
const LIMITS = Object.freeze({backupBytes: 8 * 1024 * 1024, snapshotBytes: 9 * 1024 * 1024, photoBytes: 2 * 1024 * 1024, photos: 2000, logKeyBytes: 1024, nodes: 100000, depth: 64});
class RemoteError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, text) => { throw new RemoteError(code, text); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const isId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(x);
const isHash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function fields(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(k => !Object.hasOwn(value,k))) fail('invalid-argument', 'La operación está incompleta o contiene campos no admitidos.');
}
function identity(auth) {
  if (!auth || typeof auth.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(auth.uid)) fail('unauthenticated', 'Inicia sesión antes de acceder a tus datos.');
  if (auth.token?.email_verified !== true) fail('permission-denied', 'Verifica tu correo antes de acceder a tus datos.');
  return auth.uid;
}
function operation(data, kind) {
  fields(data, ['operationId', 'baseRevision', kind === 'save' ? 'backup' : 'restoreRevision']);
  if (!isId(data.operationId) || !(data.baseRevision === null || isId(data.baseRevision)) || (kind === 'restore' && !isId(data.restoreRevision))) fail('invalid-argument', 'Las identidades de la operación no son válidas.');
}
function parseBackup(raw) {
  if (typeof raw !== 'string') fail('invalid-argument', 'Envía un respaldo JSON de Fullhouse.');
  if (Buffer.byteLength(raw) > LIMITS.backupBytes) fail('resource-exhausted', 'El respaldo supera el límite provisional de 8 MiB; conserva tu archivo local.');
  let data;
  try { data = JSON.parse(raw); } catch { fail('invalid-argument', 'No pudimos leer el JSON del respaldo.'); }
  const pending = [[data,0]]; let nodes = 0;
  while (pending.length) {
    const [value, depth] = pending.pop();
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) fail('resource-exhausted', 'La estructura del respaldo supera los límites de validación.');
    if (value && typeof value === 'object') {
      const count=Array.isArray(value)?value.length:Object.keys(value).length;
      if (count+nodes+pending.length > LIMITS.nodes) fail('resource-exhausted','El respaldo contiene demasiados elementos para validarlo con seguridad.');
      for (const child of Object.values(value)) pending.push([child,depth+1]);
    }
  }
  if (!validData(data)) fail('invalid-argument', 'El respaldo contiene datos incompatibles o incompletos. No se ha reemplazado tu información.');
  return data;
}
function packBackup(raw) {
  const data = parseBackup(raw), backup = JSON.stringify(data), backupHash = hash(backup);
  const photos = new Map(), attachments = [];
  for (const [logKey,log] of Object.entries(data.logs)) for (const [position,photo] of (log.evidences || []).entries()) {
    if (Buffer.byteLength(logKey) > LIMITS.logKeyBytes) fail('resource-exhausted','Una referencia de fotografía supera el límite provisional.');
    const bytes = Buffer.from(photo.src, 'utf8');
    if (bytes.length > LIMITS.photoBytes || attachments.length >= LIMITS.photos) fail('resource-exhausted', 'Las fotografías superan los límites provisionales. Conserva tu respaldo original.');
    const sha256 = hash(bytes); photos.set(sha256,bytes);
    attachments.push({logKey,position,sha256,bytes:bytes.length});
    photo.src = ''; // Internal envelope, never an exportable v1 backup.
  }
  const encoded = JSON.stringify({format:'fullhouse-remote-v1',data,attachments});
  if (Buffer.byteLength(encoded) > LIMITS.snapshotBytes) fail('resource-exhausted','La revisión excede el límite de almacenamiento admitido.');
  const snapshot = Buffer.from(encoded);
  return {backupHash,snapshot,snapshotHash:hash(snapshot),photos};
}
async function unpackBackup(snapshot, readPhoto) {
  let envelope;
  try { envelope = JSON.parse(snapshot.toString('utf8')); } catch { fail('data-loss', 'La revisión almacenada no se puede leer. Conservamos las demás revisiones.'); }
  try { fields(envelope,['format','data','attachments']); } catch { fail('data-loss', 'El manifiesto de la revisión no es válido.'); }
  if (envelope.format !== 'fullhouse-remote-v1' || !Array.isArray(envelope.attachments) || envelope.attachments.length > LIMITS.photos || !envelope.data?.logs) fail('data-loss', 'Formato de revisión incompatible.');
  const seen = new Set(), cache = new Map(); let totalPhotoBytes=0;
  for (const a of envelope.attachments) {
    try { fields(a,['logKey','position','sha256','bytes']); } catch { fail('data-loss','Referencia de fotografía inválida.'); }
    const key = JSON.stringify([a.logKey,a.position]);
    if (typeof a.logKey !== 'string' || Buffer.byteLength(a.logKey) > LIMITS.logKeyBytes || !Object.hasOwn(envelope.data.logs,a.logKey) || !Number.isSafeInteger(a.position) || a.position < 0 || !isHash(a.sha256) || !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > LIMITS.photoBytes || seen.has(key)) fail('data-loss','Referencia de fotografía inválida o duplicada.');
    totalPhotoBytes += a.bytes;
    if (totalPhotoBytes > LIMITS.backupBytes) fail('data-loss','Las fotografías referenciadas exceden el límite del respaldo.');
    seen.add(key);
    const photo = envelope.data.logs[a.logKey]?.evidences?.[a.position];
    if (!photo || photo.src !== '') fail('data-loss','La fotografía no pertenece al registro esperado.');
    if (!cache.has(a.sha256)) cache.set(a.sha256, await readPhoto(a.sha256,a.bytes));
    const bytes = cache.get(a.sha256);
    if (bytes.length !== a.bytes || hash(bytes) !== a.sha256) fail('data-loss','La fotografía no coincide con su huella.');
    photo.src = bytes.toString('utf8');
  }
  const raw = JSON.stringify(envelope.data);
  try { parseBackup(raw); } catch { fail('data-loss','La revisión recuperada no es un respaldo v1 válido.'); }
  return raw;
}
module.exports = {LIMITS,RemoteError,fail,hash,isId,isHash,fields,identity,operation,parseBackup,packBackup,unpackBackup};
