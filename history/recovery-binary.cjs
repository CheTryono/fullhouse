'use strict';
const { copy, canonical, parse, freeze } = require('./json.cjs'), { sha256 } = require('./persistence.cjs'), archive = require('./storage-archive.cjs');
const MAGIC = 'FULLHOUSE-RECOVERY-1\n', MAX = 512 * 1024 * 1024;
function size(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; }
async function exportRecovery({ id, base, candidate, drafts, operation = null }, legacy) {
    const meta = copy({ format: 'fullhouse-pending-recovery', version: 1, id, base, drafts, operation, candidateRoot: candidate.rootHash, meaning: 'pending-not-confirmed' });
    if (typeof id !== 'string' || !id.trim())
        throw Error('ID de recuperación necesario');
    const file = await archive.exportArchive(candidate, legacy);
    meta.archiveBytes = file.size;
    meta.checksum = await sha256(canonical(meta));
    const bytes = new TextEncoder().encode(JSON.stringify(meta));
    if (bytes.length > 16 * 1024 * 1024 || file.size + bytes.length + MAGIC.length + 8 > MAX)
        throw Error('Recuperación excede presupuesto; no se emite archivo incompleto');
    return new Blob([MAGIC, size(bytes.length), bytes, size(file.size), file], { type: 'application/octet-stream' });
}
async function inspectRecovery(file, legacy) {
    if (!(file instanceof Blob) || file.size > MAX || await file.slice(0, MAGIC.length).text() !== MAGIC)
        throw Error('Paquete de recuperación incompatible');
    let offset = MAGIC.length;
    async function frame(max) { if (offset + 4 > file.size)
        throw Error('Recuperación truncada'); const n = new DataView(await file.slice(offset, offset + 4).arrayBuffer()).getUint32(0); offset += 4; if (n > max || offset + n > file.size)
        throw Error('Parte truncada o excesiva'); const blob = file.slice(offset, offset + n); offset += n; return blob; }
    const meta = parse(await (await frame(16 * 1024 * 1024)).text()), { checksum, ...body } = meta;
    if (![9, 10].includes(Object.keys(meta).length) || !Object.keys(meta).every(k => ['format', 'version', 'id', 'base', 'drafts', 'operation', 'candidateRoot', 'meaning', 'archiveBytes', 'checksum'].includes(k)) || meta.format !== 'fullhouse-pending-recovery' || meta.version !== 1 || meta.meaning !== 'pending-not-confirmed' || typeof meta.id !== 'string' || !meta.id.trim() || checksum !== await sha256(canonical(body)))
        throw Error('Metadatos de recuperación inválidos');
    const candidateFile = await frame(MAX);
    if (candidateFile.size !== meta.archiveBytes || offset !== file.size)
        throw Error('Longitud de recuperación inválida');
    const candidate = await archive.importArchive(candidateFile, legacy);
    if (candidate.rootHash !== meta.candidateRoot)
        throw Error('Candidato no íntegro');
    return { meaning: 'pending-not-confirmed', metadata: freeze(copy(meta)), candidate };
}
module.exports = { exportRecovery, inspectRecovery };
