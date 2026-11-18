'use strict';
const { copy, canonical, same, freeze } = require('./json.cjs');
const { sha256 } = require('./persistence.cjs');
const { inspectSources, fingerprint } = require('./storage-sources.cjs');
const CAPS = Object.freeze(['authority-v1', 'source-watch-v1', 'receipt-chain-v1']);
const hash = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const nonempty = v => typeof v === 'string' && !!v.trim();
const fail = s => { throw Error(s); };
const fields = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
async function seal(value) { return freeze({ ...copy(value), checksum: await sha256(canonical(value)) }); }
async function receiptHash(r) { return sha256(canonical({ id: r.id, generation: r.generation, rootHash: r.rootHash, operationHash: r.operationHash, lineage: r.lineage })); }
async function verifyAuthority(a, head, receipts) {
    if (!fields(a, ['key', 'protocol', 'databaseVersion', 'recordFormat', 'documentVersion', 'requiredCapabilities', 'id', 'identityHash', 'origin', 'genesis', 'tip', 'checksum']) || a.key !== 'authority' || a.protocol !== 1 || a.databaseVersion !== 2 || a.recordFormat !== 1 || a.documentVersion !== 2 || !same(a.requiredCapabilities, CAPS) || !nonempty(a.id))
        fail('Manifiesto de autoridad incompatible');
    const { checksum, ...body } = a;
    if (checksum !== await sha256(canonical(body)))
        fail('Checksum de autoridad inválido');
    if (!fields(a.origin, ['kind', 'migrationId', 'selected', 'keys', 'fingerprints']) || !same(a.origin.keys, { main: 'fullhouse-v01', alias: 'botanica-planificador-v01' }) || !fields(a.origin.fingerprints, ['main', 'alias']) || !Object.values(a.origin.fingerprints).every(h => h === null || hash(h)))
        fail('Origen de autoridad inválido');
    if (!['native', 'migration', 'restored'].includes(a.origin.kind))
        fail('Tipo de origen inválido');
    if (a.origin.kind === 'migration' ? !nonempty(a.origin.migrationId) || !['main', 'alias'].includes(a.origin.selected) || !hash(a.origin.fingerprints[a.origin.selected]) : a.origin.migrationId !== null || a.origin.selected !== null || Object.values(a.origin.fingerprints).some(h => h !== null))
        fail('Selección de origen inválida');
    for (const t of [a.genesis, a.tip])
        if (!fields(t, ['id', 'generation', 'rootHash', 'receiptHash']) || !nonempty(t.id) || !Number.isSafeInteger(t.generation) || t.generation < 1 || !hash(t.rootHash) || !hash(t.receiptHash))
            fail('Punta de autoridad inválida');
    if (a.genesis.generation !== 1 || !head || head.generation !== a.tip.generation || head.id !== a.tip.id || head.rootHash !== a.tip.rootHash || head.authorityId !== a.id || head.receiptHash !== a.tip.receiptHash)
        fail('Cabeza y autoridad no coinciden');
    const identity = await sha256(canonical({ id: a.id, origin: a.origin, genesis: { id: a.genesis.id, generation: 1, rootHash: a.genesis.rootHash }, databaseVersion: 2, recordFormat: 1, documentVersion: 2, requiredCapabilities: CAPS }));
    if (a.identityHash !== identity)
        fail('Identidad de autoridad alterada');
    const ordered = [...receipts].sort((x, y) => x.generation - y.generation);
    if (ordered.length !== a.tip.generation)
        fail('Cadena incompleta o recibos ajenos');
    let parent = null;
    for (let i = 0; i < ordered.length; i++) {
        const r = ordered[i];
        if (r.generation !== i + 1 || !fields(r.lineage, ['protocol', 'authorityId', 'authorityHash', 'genesis', 'parent']) || r.lineage.protocol !== 1 || r.lineage.authorityId !== a.id || r.lineage.authorityHash !== a.identityHash || !same(r.lineage.genesis, { id: a.genesis.id, generation: 1, rootHash: a.genesis.rootHash }) || !same(r.lineage.parent, parent) || r.receiptHash !== await receiptHash(r))
            fail('Recibo/parentesco inválidos');
        parent = { id: r.id, generation: r.generation, rootHash: r.rootHash, receiptHash: r.receiptHash };
    }
    if (!same(parent, a.tip) || !same({ id: ordered[0].id, generation: 1, rootHash: ordered[0].rootHash, receiptHash: ordered[0].receiptHash }, a.genesis))
        fail('Génesis o punta inconsistentes');
    return true;
}
function createLineageDatabase({ factory, name, legacy, schedule, plannerActions=null, readSources, writerCapabilities = CAPS, readOnly = false }) {
    if (typeof readSources !== 'function')
        fail('readSources inyectado es obligatorio');
    const capabilities = copy(writerCapabilities), readonly = readOnly || !Array.isArray(capabilities) || !CAPS.every(c => capabilities.includes(c));
    let db, memoryConflict = null;
    async function observe() { const copies = copy(await readSources()); const inspection = await inspectSources(copies, legacy); return { copies, fingerprints: fingerprint(inspection), status: inspection.status }; }
    async function quarantine(reason, expected, observed = null) {
        const full = await seal({ key: 'lineage-conflict', protocol: 1, reason, expected: copy(expected), observed: observed ? copy(observed) : null });
        memoryConflict = full;
        if (readonly)
            return;
        try {
            await db.protocolFlag(full);
        }
        catch {
            try {
                const minimal = await seal({ key: 'lineage-conflict', protocol: 1, reason, expected: expected?.fingerprints ? { fingerprints: expected.fingerprints, copiesNotPersisted: true } : copy(expected), observed: observed ? { fingerprints: observed.fingerprints, status: observed.status, copiesNotPersisted: true } : null });
                await db.protocolFlag(minimal);
            }
            catch { }
        }
    }
    async function watch(expected, originalCopies = null) {
        let observed;
        try {
            observed = await observe();
        }
        catch (e) {
            await quarantine('Fuente ilegible: ' + e.message, originalCopies ? { fingerprints: expected, copies: originalCopies } : expected);
            fail('Fuente ilegible: escrituras detenidas; conserva copias y recuperación');
        }
        if (!same(expected, observed.fingerprints)) {
            await quarantine('Fuentes divergentes', originalCopies ? { fingerprints: expected, copies: originalCopies } : expected, observed);
            fail('Fuentes divergentes: escrituras detenidas; no se selecciona una rama');
        }
        return observed;
    }
    const protocol = { version: 1, readonly,
        assertWritable() { if (readonly)
            fail('Escritor sin capacidades: solo lectura'); if (memoryConflict)
            fail('Conflicto observado: recuperación explícita necesaria'); },
        async opened(snapshot) {
            if (snapshot.head) {
                try {
                    await verifyAuthority(snapshot.authority, snapshot.head, snapshot.commitRecords);
                }
                catch (e) {
                    if (!e.message.includes('incompatible'))
                        await quarantine(e.message, snapshot.authority?.origin?.fingerprints || null);
                    throw e;
                }
                if (snapshot.authority.origin.kind === 'migration') {
                    try {
                        const origin = snapshot.authority.origin;
                        for (const source of ['main', 'alias']) {
                            const entry = snapshot.sources.find(r => r.id === canonical([origin.migrationId, source]));
                            if (!entry || entry.hash !== origin.fingerprints[source]) {
                                await quarantine('Original no vinculado al manifiesto', origin.fingerprints);
                                fail('Original no vinculado al manifiesto');
                            }
                        }
                        const c = await db.verifyCandidate(origin.migrationId);
                        if (c.rootHash !== snapshot.authority.genesis.rootHash || c.selection !== origin.selected || !same(c.fingerprint, origin.fingerprints))
                            fail('Génesis no corresponde al candidato elegido');
                    }
                    catch (e) {
                        await quarantine(e.message, snapshot.authority.origin.fingerprints);
                        throw e;
                    }
                }
                await watch(snapshot.authority.origin.fingerprints);
            }
            else if (snapshot.authority)
                fail('Autoridad sin génesis confirmado');
            else
                await observe();
            return { writable: !readonly, authority: snapshot.authority || null };
        },
        async prepare({ plan, id, expected, migrationId, operationHash, restore = false }) {
            protocol.assertWritable();
            const state = await db.protocolSnapshot();
            if (state.conflict)
                fail('Conflicto persistente: escrituras detenidas');
            let a = state.authority, origin, selectedCopies = null;
            if (state.head) {
                try {
                    await verifyAuthority(a, state.head, state.commitRecords);
                }
                catch (e) {
                    if (!e.message.includes('incompatible'))
                        await quarantine(e.message, a?.origin?.fingerprints || null);
                    throw e;
                }
                await watch(a.origin.fingerprints);
                const previous = state.commitRecords.find(r => r.id === id);
                if (previous) {
                    if (previous.rootHash !== plan.rootHash || previous.operationHash !== operationHash)
                        fail('ID reutilizado');
                    return { previousAuthority: a, previousHead: state.head, repeated: true };
                }
                if (!same(expected, state.head))
                    fail('Operación obsoleta');
                origin = a.origin;
            }
            else {
                if (a || state.commitRecords.length)
                    fail('Autoridad parcial: recuperar antes de escribir');
                if (expected)
                    fail('Operación obsoleta');
                if (migrationId) {
                    const c = await db.verifyCandidate(migrationId);
                    if (c.status !== 'staged' || c.expected !== null || c.plan.rootHash !== plan.rootHash)
                        fail('Migración no apta para génesis');
                    await watch(c.fingerprint);
                    selectedCopies = c.sources;
                    origin = { kind: 'migration', migrationId, selected: c.selection, keys: { main: 'fullhouse-v01', alias: 'botanica-planificador-v01' }, fingerprints: c.fingerprint };
                }
                else {
                    const observed = await observe();
                    if (Object.values(observed.fingerprints).some(v => v !== null))
                        fail('Fuentes v1 presentes: se requiere selección y migración explícitas');
                    if (plan.sourceBackups?.length && !restore)
                        fail('Respaldo con originales: confirma restauración en destino nuevo');
                    origin = { kind: restore ? 'restored' : 'native', migrationId: null, selected: null, keys: { main: 'fullhouse-v01', alias: 'botanica-planificador-v01' }, fingerprints: observed.fingerprints };
                }
            }
            const generation = (state.head?.generation || 0) + 1, authorityId = a?.id || 'authority:' + id, genesis = a ? { id: a.genesis.id, generation: 1, rootHash: a.genesis.rootHash } : { id, generation: 1, rootHash: plan.rootHash };
            const identityHash = a?.identityHash || await sha256(canonical({ id: authorityId, origin, genesis, databaseVersion: 2, recordFormat: 1, documentVersion: 2, requiredCapabilities: CAPS }));
            const lineage = { protocol: 1, authorityId, authorityHash: identityHash, genesis, parent: a?.tip || null }, r = { id, generation, rootHash: plan.rootHash, operationHash, lineage }, digest = await receiptHash(r), tip = { id, generation, rootHash: plan.rootHash, receiptHash: digest };
            const next = await seal({ key: 'authority', protocol: 1, databaseVersion: 2, recordFormat: 1, documentVersion: 2, requiredCapabilities: CAPS, id: authorityId, identityHash, origin, genesis: a?.genesis || tip, tip });
            return freeze({ previousAuthority: a || null, previousHead: state.head || null, next, receiptFields: { lineage, receiptHash: digest }, headFields: { authorityId, receiptHash: digest }, migrationId: migrationId || null, selectedCopies });
        },
        apply(ctx, rows, tx) {
            protocol.assertWritable();
            if (rows.control.some(r => ['lineage-conflict', 'source-conflict', 'integrity-block'].includes(r.key)))
                fail('Conflicto persistente');
            const current = rows.control.find(r => r.key === 'authority') || null, head = rows.control.find(r => r.key === 'head') || null;
            if (!same(current, ctx.previousAuthority) || !same(head, ctx.previousHead))
                fail('Operación obsoleta: autoridad cambió');
            if (ctx.repeated)
                return;
            if (ctx.migrationId)
                for (const source of ['main', 'alias']) {
                    const row = rows.sources.find(s => s.id === canonical([ctx.migrationId, source]));
                    if (!row || row.raw !== ctx.selectedCopies[source] || row.hash !== ctx.next.origin.fingerprints[source])
                        fail('Original de migración cambió');
                }
            tx.objectStore('control').put(ctx.next);
        },
        async confirmed(ctx, snapshot) { if (!ctx)
            return; const authority = ctx.next || ctx.previousAuthority; if (snapshot?.head?.generation === authority.tip.generation && (!same(snapshot.authority, authority) || snapshot.head.authorityId !== authority.id || snapshot.head.receiptHash !== authority.tip.receiptHash)) {
            await quarantine('Autoridad no confirmada', authority.origin.fingerprints);
            fail('Autoridad no confirmada');
        } await watch(authority.origin.fingerprints); }
    };
    db = require('./storage-idb.cjs').createLabDatabase({ factory, name, legacy, schedule, plannerActions, physicalVersion: 2, protocol, readOnly: readonly });
    async function stageMigration(proposal, options) { proposal = freeze(structuredClone(proposal)); options = freeze(structuredClone(options)); protocol.assertWritable(); const s = await db.protocolSnapshot(); if (s.head)
        fail('No se prepara otra migración sobre una autoridad activa'); await watch(proposal.fingerprint, proposal.sources); const result = await db.stageMigration(proposal, options); await watch(proposal.fingerprint, proposal.sources); return result; }
    async function finalizeMigration(id, { confirm = false, ...options } = {}) { if (!confirm)
        fail('Confirma explícitamente la migración'); const c = await db.verifyCandidate(id); if (c.status === 'committed') {
        const s = await db.open();
        if (s.status !== 'ready' || s.authority?.origin.migrationId !== id)
            fail('Recuperación necesaria');
        return { status: s.head.rootHash === c.receipt.rootHash && s.head.id === c.receipt.id && s.head.generation === c.receipt.generation ? 'confirmed' : 'committed-but-superseded', receipt: c.receipt, head: s.head, repeated: true };
    } return db.commit(c.plan, { ...options, expected: c.expected, id: 'migration:' + id, migrationId: id }); }
    async function sourceRecovery() { let current; try {
        current = await observe();
    }
    catch (e) {
        current = { error: e.message };
    } const originals = await db.protocolOriginals(); return { format: 'fullhouse-lineage-recovery', version: 1, meaning: 'sources-and-authority-not-a-complete-data-backup', originals, current, memoryConflict, state: await db.protocolSnapshot() }; }
    const { protocolSnapshot, protocolOriginals, protocolFlag, ...publicDB } = db;
    return Object.freeze({ ...publicDB, commit: (plan, options = {}) => { if (options.replace)
            fail('Restaurar únicamente en destino nuevo; no se reemplaza el historial activo'); return db.commit(plan, options); }, stageMigration, finalizeMigration, sourceRecovery, auditLineage: async () => { const state = await db.protocolSnapshot(); await verifyAuthority(state.authority, state.head, state.commitRecords); await watch(state.authority.origin.fingerprints); return { valid: true, authority: state.authority }; } });
}
module.exports = { CAPS, verifyAuthority, createLineageDatabase };
