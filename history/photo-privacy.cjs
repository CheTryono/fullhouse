'use strict';
const { canonical, copy, freeze } = require('./json.cjs'), { verifyPlan } = require('./storage-model.cjs');
// Solo propuesta: no borra blobs, fuentes, candidatos ni archivos del usuario.
async function photoRemovalReport(input, selection, legacy) {
    const plan = structuredClone(input), selected = copy(selection);
    await verifyPlan(plan, legacy);
    if (!Array.isArray(selected) || !selected.length)
        throw Error('Selecciona referencias explícitas');
    const keys = selected.map(s => canonical([s.owner, s.id]));
    if (new Set(keys).size !== keys.length)
        throw Error('Selección duplicada');
    const rows = new Map(plan.tables.evidence.map(r => [r.key, r.value]));
    if (keys.some(k => !rows.has(k)))
        throw Error('Propietario o referencia inexistente');
    const hashes = [...new Set(keys.map(k => rows.get(k).hash))], removed = new Set(keys);
    return freeze({ meaning: 'proposal-only', references: selected, images: hashes.map(hash => { const refs = plan.tables.evidence.filter(r => r.value.hash === hash), remaining = refs.filter(r => !removed.has(r.key)); return { hash, bytes: plan.images.find(i => i.hash === hash).size, selectedReferences: refs.length - remaining.length, remainingReferences: remaining.length, mayRemoveActiveBlob: remaining.length === 0 }; }), originalSourcesNeedExplicitReview: (plan.sourceBackups || []).length, stagedCandidates: 'must-be-reviewed-separately', downloadedBackups: 'cannot-be-revoked', physicalDeletionImplemented: false });
}
module.exports = { photoRemovalReport };
