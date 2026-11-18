'use strict';
const { copy } = require('./json.cjs'), { bytesHash } = require('./storage-model.cjs');
// Artefacto de diagnóstico, no respaldo validado ni formato de restauración automática.
async function exportDiagnostic(snapshot) {
    const rows = structuredClone(snapshot), parts = ['FULLHOUSE-DIAGNOSTIC-1\n'];
    let total = parts[0].length;
    const add = part => { const size = typeof part === 'string' ? new TextEncoder().encode(part).length : part.size ?? part.byteLength; if (size > 16 * 1024 * 1024 || (total += size + 4) > 512 * 1024 * 1024)
        throw Error('Diagnóstico excede presupuesto; originales conservados'); const n = new Uint8Array(4); new DataView(n.buffer).setUint32(0, size); parts.push(n, part); };
    add(JSON.stringify({ format: 'fullhouse-unverified-diagnostic', version: 1, meaning: 'NOT-A-VALIDATED-BACKUP', stores: Object.fromEntries(Object.entries(rows).map(([store, items]) => [store, items.length])) }));
    for (const [store, items] of Object.entries(rows))
        for (const row of items) {
            if (store === 'images') {
                const { blob, ...stored } = row;
                if (!(blob instanceof Blob))
                    throw Error('Blob no representable; no se emite diagnóstico parcial');
                add(JSON.stringify({ store, row: copy(stored), actualBytes: blob.size, actualHash: await bytesHash(blob) }));
                add(blob);
            }
            else
                add(JSON.stringify({ store, row: copy(row) }));
        }
    return new Blob(parts, { type: 'application/octet-stream' });
}
module.exports = { exportDiagnostic };
