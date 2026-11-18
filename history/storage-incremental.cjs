'use strict';
// Acceso experimental por capacidades: ninguna escritura pública ni factoría global.
const { copy, freeze, canonical, same } = require('./json.cjs');
const model = require('./storage-model.cjs'), { sha256 } = require('./persistence.cjs');
const { createEngine } = require('./engine.cjs'), { createAdapter } = require('./adapter.cjs'), { createLegacyCompat } = require('./legacy-compat.cjs');
const { TABLES } = model;
// Solo sobre subárboles de la base ya congelada profundamente o nodos recién construidos.
function freezeShared(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value))
        return value;
    Object.values(value).forEach(freezeShared);
    return Object.freeze(value);
}
const clock = () => globalThis.performance?.now() ?? Date.now();
function createIncrementalAccess({ open, transaction, legacy, schedule, protocol=null, plannerActions=null }) {
    let integrityBlocked = false;
    const tokens = new WeakMap(), operations = new WeakMap(), engine = createEngine(legacy), adapter = createAdapter(schedule), compat = createLegacyCompat({ legacy, engine, adapter });
    const fail = s => { throw Error(s); };
    function token(plan, head, previousGoalIds=null,previousRoutineIndex=null) { const t = Object.freeze({ format: 'verified-history-window', generation: head.generation, rootHash: head.rootHash }); tokens.set(t, { plan, head, routineIndex:previousRoutineIndex||require('./storage-routines.cjs').index(plan), historicalGoalIds:previousGoalIds||new Set(plan.tables.executions.flatMap(r=>(r.value.log.history?.capture.plan.goals||[]).map(g=>g.id))), maps: Object.fromEntries(TABLES.map(n => [n, new Map(plan.tables[n].map(r => [r.key, r]))])), assets: new Map(plan.images.map(i => [i.hash, i])) }); return t; }
    const base = t => integrityBlocked ? fail('Verificación completa falló: recuperación explícita necesaria') : tokens.get(t) || fail('Ventana no verificada o de otra conexión');
    async function quarantine(reason) {
        integrityBlocked = true;
        try {
            await transaction(['control'], 'readwrite', (tx, done) => { tx.objectStore('control').put({ key: 'integrity-block', reason }); done(); });
        }
        catch { }
    }
    async function openWindow() {
        const start = clock(), s = await open();
        if (s.status !== 'ready') {
            if (s.status === 'recovery')
                await quarantine(s.error);
            else
                integrityBlocked = true;
            fail('Recuperación necesaria: ' + (s.error || s.status));
        }
        if (s.plan.sourceBackups?.length && !protocol)
            fail('Origen migrado: falta autoridad persistente y vigilancia de ambas fuentes para la ruta incremental');
        const plan = freeze(s.plan);
        return { token: token(plan, freeze(s.head)), verifiedMs: clock() - start, executions: plan.tables.executions.length, photoBytesHydrated: 0 };
    }
    function guard(head, conflict, receipt, b) {
        if (conflict)
            fail('Fuentes divergentes: escrituras detenidas');
        if (!same(head, b.head) || receipt?.rootHash !== head?.rootHash || receipt?.generation !== head?.generation)
            fail('Ventana obsoleta o recibo incompatible: reabrir y reconciliar');
    }
    function fetch(tx, requests, done, abort) {
        const values = {};
        let left = requests.length;
        for (const [key, store, id, method] of requests) {
            const r = method === 'count' ? tx.objectStore(store).count() : tx.objectStore(store).get(id);
            r.onerror = () => abort(r.error);
            r.onsuccess = () => {
                values[key] = r.result ?? null;
                if (--left === 0)
                    done(values);
            };
        }
    }
    async function checkHead(b) {
        return transaction(['control', 'commits'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['receipt', 'commits', b.head.id]], s => {
            try {
                guard(s.head, s.conflict || s.integrity || s.lineageConflict, s.receipt, b);
                done();
            }
            catch (e) {
                abort(e);
            }
        }, abort));
    }
    function scope(b, key, command = null) {
        const row = b.maps.executions.get(key), c = row?.value.log.history?.capture, link = row?.value.log.recordEdits?.adoption, keys = new Set(row ? [key] : []);
        if (!row) {
            if (!command?.context || key !== command.context.eventId + '@' + command.context.date)
                fail('La primera captura exige contexto e identidad exactos');
            if (b.plan.tables.executions.some(r => r.executionId === command.executionId || same(r.seriesDay, [command.context.seriesId, command.context.date])))
                fail('Identidad/ocurrencia ya capturada');
            for (const r of b.plan.tables.executions)
                if (r.day === command.context.date)
                    keys.add(r.key);
        }
        if (c?.adoption)
            keys.add(c.adoption.legacyKey);
        if (link)
            keys.add(link.logKey);
        // Incluir enlaces del día y referencias vigentes, sin leer años de ejecuciones.
        for (const k of keys) {
            const l = b.maps.executions.get(k)?.value.log;
            if (l?.history?.capture.adoption)
                keys.add(l.history.capture.adoption.legacyKey);
            if (l?.recordEdits?.adoption)
                keys.add(l.recordEdits.adoption.logKey);
        }
        const rows = [...keys].map(k => b.maps.executions.get(k) || fail('Falta enlace histórico'));
        const revisions = new Set(rows.map(r => r.value.log.history?.capture.recipeRevisionId).filter(Boolean));
        if (!row) {
            for (const e of b.plan.tables.events)
                if (e.value.recipeRevisionId)
                    revisions.add(e.value.recipeRevisionId);
            const event = b.maps.events.get(command.context.eventId)?.value, routine = event && b.maps.routines.get(event.routineId)?.value;
            for (const r of b.plan.tables.revisions)
                if (r.value.sourceRoutineId === routine?.id && same(r.value.definition, routine))
                    revisions.add(r.key);
        }
        const evidenceKeys = new Set(rows.flatMap(r => r.value.evidenceKeys)), tables = Object.fromEntries(TABLES.map(t => [t, t === 'executions' ? rows : t === 'revisions' ? [...revisions].map(k => b.maps.revisions.get(k)) : t === 'evidence' ? [...evidenceKeys].map(k => b.maps.evidence.get(k)) : !row && ['goals', 'routines', 'events'].includes(t) ? b.plan.tables[t] : []]));
        const plan = { format: 1, header: { version: 2, goalIds: tables.goals.map(r => r.key), routineIds: tables.routines.map(r => r.key), eventIds: tables.events.map(r => r.key), revisionIds: [...revisions], logKeys: [...keys], reviewDates: [], dayReviewsPresent: false }, tables, images: [] };
        return { row, rows, plan, document: model.structuralDocument(plan) };
    }
    const scopeRecords = s => TABLES.flatMap(store => s.plan.tables[store].map(row => ({ store, row })));
    async function prepareExecution(t, key, command) {
        const started = clock(), b = base(t), cmd = copy(command), s = scope(b, key, cmd), old = s.row?.value.log, id = cmd.id || cmd.operationId;
        if (typeof id !== 'string' || !id.trim())
            fail('Reserva un ID estable');
        let after;
        const action = cmd.action?.type === 'annotate' ? cmd.action.action : cmd.action;
        if (action?.type === 'evidence' && (s.document.logs[key]?.evidences || []).some(e => e.id === action.evidence?.id))
            fail('La evidencia ya existe: reintenta el delta pendiente, no la acción de adjuntar');
        if (!old || old.history) {
            if (old && cmd.executionId !== old.history.capture.executionId)
                fail('El comando pertenece a otra ejecución');
            after = compat.native(s.document, cmd).after;
            const log = after.logs[key];
            if (!log?.history)
                fail('No hay registro significativo: no se crea una ejecución');
            const r = log.history.resolution;
            if (cmd.action.type === 'step' && cmd.action.checked && r.unitsKnown && r.unitStepIds.length && r.unitStepIds.every(k => log.checkedSteps.includes(k)) && log.history.state.status === 'active')
                after = compat.native(after, { executionId: cmd.executionId, at: cmd.at, editId: cmd.editId + ':complete', reason: 'Todas las unidades aplicables marcadas', action: { type: 'complete', source: 'steps' } }).after;
        }
        else
            after = compat.edit(s.document, key, cmd).after;
        const partial = await model.prepareDocument(after, legacy), oldEvidence = new Map(s.plan.tables.evidence.map(e => [e.key, e])), changed = [];
        for (const r of partial.tables.evidence) {
            const prior = oldEvidence.get(r.key);
            if (prior) {
                const ownerRow = s.rows.find(row => row.value.owner === prior.value.owner), beforePhoto = s.document.logs[ownerRow.key].evidences?.find(e => e.id === prior.value.id), afterPhoto = after.logs[ownerRow.key].evidences?.find(e => beforePhoto?.id === e.id);
                if (beforePhoto && same(beforePhoto, afterPhoto))
                    r.value = prior.value;
                else if (!same(prior.value, r.value))
                    fail('No se reemplaza una evidencia existente');
            }
            r.hash = await sha256(canonical(r.value));
        }
        const nextRow = partial.tables.executions.find(r => r.key === key);
        if (!nextRow)
            fail('Ejecución perdida');
        nextRow.hash = await sha256(canonical(nextRow.value));
        model.retainHistory(s.plan.tables, { tables: partial.tables });
        for (const r of partial.tables.executions)
            if (r.key !== key && !same(r, b.maps.executions.get(r.key)))
                fail('La acción alteró otra ejecución');
        changed.push({ store: 'executions', row: nextRow });
        for (const r of partial.tables.evidence)
            if (!b.maps.evidence.has(r.key))
                changed.push({ store: 'evidence', row: r });
        for (const store of ['events', 'revisions'])
            for (const r of partial.tables[store])
                if (!same(r, b.maps[store].get(r.key))) {
                    if (store === 'revisions' && b.maps.revisions.has(r.key))
                        fail('No se reutiliza una revisión para otra definición');
                    changed.push({ store, row: r });
                }
        const needed = new Set(changed.filter(c => c.store === 'evidence').map(c => c.row.value.hash)), images = partial.images.filter(i => needed.has(i.hash) && !b.assets.has(i.hash)), tables = { ...b.plan.tables };
        for (const store of ['executions', 'evidence', 'events', 'revisions']) {
            const changes = new Map(changed.filter(c => c.store === store).map(c => [c.row.key, c.row]));
            tables[store] = b.plan.tables[store].map(r => changes.get(r.key) || r).concat([...changes.values()].filter(r => !b.maps[store].has(r.key)));
        }
        const header = { ...b.plan.header, logKeys: [...b.plan.header.logKeys, ...changed.filter(c => c.store === 'executions' && !b.maps.executions.has(c.row.key)).map(c => c.row.key)], revisionIds: [...b.plan.header.revisionIds, ...changed.filter(c => c.store === 'revisions' && !b.maps.revisions.has(c.row.key)).map(c => c.row.key)] }, plan = { ...b.plan, header, tables, images: [...b.plan.images, ...images] };
        plan.rootHash = await model.rootHash(plan);
        return seal(b, plan, changed, images, id, scopeRecords(s), started, { key, command: cmd });
    }
    async function verifyRows(b, records) {
        const actual = await transaction(['control', 'commits', ...new Set(records.map(r => r.store))], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'], ['lineage', 'control', 'lineage-conflict'], ['receipt', 'commits', b.head.id], ...records.map((r, i) => ['row' + i, r.store, r.row.key])], v => { try {
            guard(v.head, v.conflict || v.integrity || v.lineage, v.receipt, b);
            done(v);
        }
        catch (e) {
            abort(e);
        } }, abort));
        for (let i = 0; i < records.length; i++)
            if (!same(actual['row' + i], records[i].row) || await sha256(canonical(actual['row' + i].value)) !== actual['row' + i].hash) {
                await quarantine('Entidad relacionada corrupta');
                fail('Entidad relacionada corrupta');
            }
    }
    async function readGoal(t, id) {
        const started = clock(), b = base(t), records = require('./storage-goals.cjs').relatedRows(b.plan, id);
        await verifyRows(b, records);
        return freeze({ goal: copy(b.maps.goals.get(id)?.value || null), related: records.map(r => ({ store: r.store, key: r.row.key, value: copy(r.row.value) })), photoBytesHydrated: 0, readMs: clock() - started });
    }
    async function readDayReview(t, date) {
        const started = clock(), b = base(t), row = b.maps.reviews.get(date);
        await verifyRows(b, row ? [{ store: 'reviews', row }] : []);
        return freeze({ date, review: copy(row?.value || null), photoBytesHydrated: 0, readMs: clock() - started });
    }
    async function readRoutine(t,id,{after=null,revisionAfter=null,limit=50}={}) {
        if(!Number.isSafeInteger(limit)||limit<1||limit>1000)fail('Página fuera del presupuesto');const started=clock(),b=base(t),library=require('./storage-routines.cjs'),refs=b.routineIndex.get(id)||{revisions:[],executions:[]},records=library.relatedRows(b.plan,id),captures=refs.executions.filter(r=>!after||r.key>after).slice(0,limit);for(const c of captures)records.push({store:'executions',row:b.maps.executions.get(c.key)});
        for(const key of refs.revisions.filter(key=>!revisionAfter||key>revisionAfter).slice(0,limit))records.push({store:'revisions',row:b.maps.revisions.get(key)});
        await verifyRows(b,records);
        return freeze({routine:copy(b.maps.routines.get(id)?.value||null),related:records.filter(r=>r.store!=='executions').map(r=>({store:r.store,key:r.row.key,value:copy(r.row.value)})),revisionCount:refs.revisions.length,revisionCatalog:refs.revisions.map(key=>({key,hash:b.maps.revisions.get(key).hash})),captureCount:refs.executions.length,captures:copy(captures),next:captures.length===limit?captures.at(-1).key:null,photoBytesHydrated:0,readMs:clock()-started});
    }
    async function prepareRoutine(t,method,payload,context) {
        if(!protocol)fail('Las rutinas incrementales requieren autoridad persistente');
        const started=clock(),b=base(t),library=require('./storage-routines.cjs'),scope=library.selectScope(b.plan,method,payload,context);
        if(method==='saveRoutine'&&!scope.payload.id&&b.routineIndex.has(scope.id))fail('ID reservado ya aparece en definiciones o relaciones anteriores');
        const relationsAt=clock();await verifyRows(b,scope.rows);const relationsMs=clock()-relationsAt;
        const {partial,proof,validationMs}=await library.buildChange(scope,{legacy,schedule,plannerActions}),changed=[],tables={...b.plan.tables};
        for(const store of ['routines','events']){
            const next=new Map(partial.tables[store].map(r=>[r.key,r]));
            for(const row of partial.tables[store])if(!same(row,b.maps[store].get(row.key)))changed.push({store,row});
            const selected=new Set(scope.rows.filter(r=>r.store===store).map(r=>r.row.key));
            for(const row of b.plan.tables[store])if(selected.has(row.key)&&!next.has(row.key))changed.push({store,row,deleted:true});
            const changes=new Map(changed.filter(c=>c.store===store).map(c=>[c.row.key,c]));tables[store]=b.plan.tables[store].filter(r=>!changes.get(r.key)?.deleted).map(r=>changes.get(r.key)?.row||r).concat(partial.tables[store].filter(r=>!b.maps[store].has(r.key)));
        }
        const header={...b.plan.header,routineIds:b.plan.header.routineIds.filter(id=>!changed.some(c=>c.store==='routines'&&c.deleted&&c.row.key===id)).concat(partial.header.routineIds.filter(id=>!b.maps.routines.has(id))),eventIds:b.plan.header.eventIds.filter(id=>!changed.some(c=>c.store==='events'&&c.deleted&&c.row.key===id))},plan={...b.plan,tables,header};plan.rootHash=await model.rootHash(plan);
        const operation=await seal(b,plan,changed,[],scope.context.operationId,scope.rows,started,{kind:'routine',method,payload:scope.payload,context:scope.context});
        operations.get(operation).metrics={relationsMs,validationMs,proof};
        return operation;
    }
    async function preparePlanning(t, method, payload, context) {
        if (!protocol)
            fail('Las operaciones B.1 requieren wrapper con linaje');
        const started = clock(), b = base(t), goals = require('./storage-goals.cjs'), scope = goals.selectScope(b.plan, method, payload, context);
        if(method==='saveGoal'&&!scope.request.payload.id&&b.historicalGoalIds.has(scope.request.goalId))fail('El ID reservado ya pertenece a una meta histórica');
        await verifyRows(b, scope.rows);
        const { partial, request } = await goals.buildChange(scope, { legacy, schedule, plannerActions }), changed = [], tables = { ...b.plan.tables };
        for (const store of ['goals', 'events', 'reviews']) {
            for (const row of partial.tables[store])
                if (!same(row, b.maps[store].get(row.key)))
                    changed.push({ store, row });
        }
        const reviewId = 'review-' + request.goalId;
        if (method === 'saveGoal' && b.maps.events.has(reviewId) && !partial.tables.events.some(r => r.key === reviewId))
            changed.push({ store: 'events', row: b.maps.events.get(reviewId), deleted: true });
        for (const store of ['goals', 'events', 'reviews']) {
            const deltas = changed.filter(c => c.store === store), updates = new Map(deltas.map(c => [c.row.key, c]));
            tables[store] = b.plan.tables[store].filter(r => !updates.get(r.key)?.deleted).map(r => updates.get(r.key)?.row || r).concat(deltas.filter(c => !c.deleted && !b.maps[store].has(c.row.key)).map(c => c.row));
        }
        const header = { ...b.plan.header, goalIds: [...b.plan.header.goalIds, ...changed.filter(c => c.store === 'goals' && !b.maps.goals.has(c.row.key)).map(c => c.row.key)], reviewDates: [...b.plan.header.reviewDates, ...changed.filter(c => c.store === 'reviews' && !b.maps.reviews.has(c.row.key)).map(c => c.row.key)], dayReviewsPresent: b.plan.header.dayReviewsPresent || method === 'saveDayReview' };
        // Planner coloca review-* al final al editar, incluso si la fila no cambia.
        header.eventIds = method === 'saveGoal' ? [...b.plan.header.eventIds.filter(id => id !== reviewId), ...partial.tables.events.map(r => r.key)] : b.plan.header.eventIds;
        const plan = { ...b.plan, tables, header };
        plan.rootHash = await model.rootHash(plan);
        return seal(b, plan, changed, [], request.context.operationId, scope.rows, started, { kind: 'planning', method, payload: request.payload, context: request.context });
    }
    async function seal(b, plan, changed, images, id, scopeRows, started, command = null) {
        const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
        changed.sort((a, b) => order(a.store, b.store) || order(a.row.key, b.row.key));
        images.sort((a, b) => order(a.hash, b.hash));
        const operationHash = await sha256(canonical({ id, base: b.head, rootHash: plan.rootHash, changes: changed.map(c => [c.store, c.row.key, c.row.hash,...(c.deleted?[true]:[])]), images: images.map(i => [i.hash, i.size]) }));
        const frozenPlan = freezeShared(plan), frozenChanges = freezeShared(changed), frozenImages = freezeShared(images);
        const op = Object.freeze({ format: 'prepared-history-delta', id, prepareMs: clock() - started, changedRows: changed.length, newImages: images.length });
        operations.set(op, { base: b, plan: frozenPlan, changed: frozenChanges, images: frozenImages, operationHash, scopeRows, command });
        return op;
    }
    async function resumePending(t, packet) {
        const b = base(t), start = clock(), metadata = copy(packet.metadata), candidate = freeze(structuredClone(packet.candidate));
        if (packet.meaning !== 'pending-not-confirmed' || metadata.meaning !== 'pending-not-confirmed' || metadata.candidateRoot !== candidate.rootHash || typeof metadata.id !== 'string' || !metadata.id.trim())
            fail('Pendiente obsoleto: conservar para reconciliación o restaurar aparte');
        await model.verifyPlan(candidate, legacy);
        if (metadata.id === b.head.id && candidate.rootHash === b.head.rootHash) {
            await checkHead(b);
            return Object.freeze({ status: 'already-confirmed', id: metadata.id, token: t });
        }
        if (!same(metadata.base, b.head))
            fail('Pendiente obsoleto: preservar para reconciliar o restaurar aparte');
        if (metadata.operation?.kind==='routine') {
            const command=copy(metadata.operation),rebuilt=await prepareRoutine(t,command.method,command.payload,command.context),value=operations.get(rebuilt);
            if(rebuilt.id!==metadata.id||value.plan.rootHash!==candidate.rootHash||!same(value.plan.sourceBackups,candidate.sourceBackups))fail('El comando no reproduce el candidato íntegro');return rebuilt;
        }
        if (metadata.operation?.kind==='planning') {
            const command=copy(metadata.operation),rebuilt=await preparePlanning(t,command.method,command.payload,command.context),value=operations.get(rebuilt);
            if(rebuilt.id!==metadata.id||value.plan.rootHash!==candidate.rootHash||!same(value.plan.sourceBackups,candidate.sourceBackups))fail('El comando no reproduce el candidato íntegro');
            return rebuilt;
        }
        if (metadata.operation) {
            const { key, command } = copy(metadata.operation), action = command.action?.type === 'annotate' ? command.action.action : command.action;
            if (action?.type === 'evidence' && !Object.hasOwn(action.evidence, 'src')) {
                const row = candidate.tables.executions.find(r => r.key === key), e = candidate.tables.evidence.find(r => r.key === canonical([row?.value.owner, action.evidence.id]))?.value;
                if (!e)
                    fail('Falta evidencia del comando');
                const image = candidate.images.find(i => i.hash === e.hash);
                action.evidence.src = await model.dataURL(image, e.mime);
            }
            const rebuilt = await prepareExecution(t, key, command), value = operations.get(rebuilt);
            if (rebuilt.id !== metadata.id || value.plan.rootHash !== candidate.rootHash || !same(value.plan.sourceBackups, candidate.sourceBackups))
                fail('El comando no reproduce el candidato íntegro');
            return rebuilt;
        }
        if (!same(candidate.header, b.plan.header) || !same(candidate.sourceBackups, b.plan.sourceBackups))
            fail('El paquete altera otras secciones');
        const changed = [];
        for (const store of TABLES) {
            for (const old of b.plan.tables[store])
                if (!candidate.tables[store].some(r => r.key === old.key))
                    fail('El paquete elimina hechos');
            for (const row of candidate.tables[store]) {
                const old = b.maps[store].get(row.key);
                if (!same(old, row)) {
                    if (!['executions', 'evidence'].includes(store) || store === 'evidence' && old)
                        fail('Cambio ajeno al delta');
                    changed.push({ store, row });
                }
            }
        }
        const execution = changed.filter(c => c.store === 'executions');
        if (execution.length !== 1 || !b.maps.executions.has(execution[0].row.key))
            fail('El paquete no es una operación incremental de una ejecución existente');
        model.retainHistory(b.plan.tables, candidate);
        const oldHashes = new Set(b.plan.images.map(i => i.hash));
        if (b.plan.images.some(i => !candidate.images.some(n => n.hash === i.hash)))
            fail('El paquete elimina imágenes');
        return seal(b, candidate, changed, candidate.images.filter(i => !oldHashes.has(i.hash)), metadata.id, scopeRecords(scope(b, execution[0].row.key)), start);
    }
    async function inspectOperation(operation) {
        const op = operations.get(operation);
        if (!op)
            fail('Delta ajeno');
        return transaction(['control', 'commits'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'], ['receipt', 'commits', operation.id], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict']], s => {
            if (s.conflict || s.integrity || s.lineageConflict) {
                done({ status: 'recovery' });
                return;
            }
            if (!s.receipt) {
                done({ status: 'not-confirmed-at-inspection' });
                return;
            }
            done({ status: s.receipt.operationHash === op.operationHash ? 'persisted-receipt' : 'recovery', receipt: s.receipt, head: s.head });
        }, abort));
    }
    async function commitExecution(operation, { fault = null } = {}) {
        const op = operations.get(operation);
        if (!op)
            fail('Delta no preparado por esta conexión');
        const start = clock(), b = op.base;
        const context=protocol?await protocol.prepare({plan:op.plan,id:operation.id,expected:b.head,migrationId:null,operationHash:op.operationHash}):null;
        const transactionAt = clock(), lineagePrepareMs=transactionAt-start;
        const receipt = await transaction(['control', 'commits', ...TABLES, 'images', 'sources', 'candidates'], 'readwrite', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['baseReceipt', 'commits', b.head.id], ['previous', 'commits', operation.id], ['sourceCount', 'sources', null, 'count'], ['candidateCount', 'candidates', null, 'count'], ...op.scopeRows.map((r, i) => ['row' + i, r.store, r.row.key]), ...op.changed.filter(c => !b.maps[c.store].has(c.row.key)).map((c, i) => ['newRef' + i, c.store, c.row.key])], s => {
            try {
                if (s.conflict || s.integrity || s.lineageConflict)
                    fail('Fuentes divergentes: escrituras detenidas');
                if (!protocol && (s.sourceCount || s.candidateCount))
                    fail('Fuentes o candidatos aparecieron: falta autoridad persistente; recuperación necesaria');
                if(protocol)protocol.apply(context,{control:[s.head,s.authority,s.conflict,s.integrity,s.lineageConflict].filter(Boolean)},tx);
                if (s.previous) {
                    if (s.previous.operationHash !== op.operationHash)
                        fail('ID reutilizado');
                    done({ ...s.previous, repeated: true });
                    return;
                }
                guard(s.head, s.conflict || s.integrity || s.lineageConflict, s.baseReceipt, b);
                for (let i = 0; i < op.scopeRows.length; i++)
                    if (!same(s['row' + i], op.scopeRows[i].row))
                        fail('Registro cambiado/corrupto fuera del protocolo');
                for (let i = 0; i < op.changed.filter(c => !b.maps[c.store].has(c.row.key)).length; i++)
                    if (s['newRef' + i] !== null)
                        fail('Referencia nueva ya existente fuera del protocolo');
                if (fault === 'before-writes')
                    fail('Fallo antes de escribir');
                for (const c of op.changed)
                    if(c.deleted)tx.objectStore(c.store).delete(c.row.key);else tx.objectStore(c.store).put(c.row);
                for (const image of op.images)
                    tx.objectStore('images').put(image);
                if (fault === 'after-records')
                    fail('Fallo dentro de la transacción');
                const head = { ...b.head, generation: b.head.generation + 1, id: operation.id, rootHash: op.plan.rootHash, header: op.plan.header,...(context?.headFields || {}) };
                tx.objectStore('control').put(head);
                const r = { id: operation.id, generation: head.generation, rootHash: head.rootHash, operationHash: op.operationHash, changedRows: op.changed.length, newImages: op.images.length,...(context?.receiptFields || {}) };
                tx.objectStore('commits').add(r);
                if (typeof fault === 'function')
                    fault(tx);
                done(r);
            }
            catch (e) {
                abort(e);
            }
        }, abort)).catch(async (error) => {
            if (error.message.includes('fuera del protocolo'))
                await quarantine(error.message);
            throw error;
        });
        const transactionMs=clock()-transactionAt, writeMs = clock() - start, readAt = clock();
        if (fault === 'lost-ack')
            fail('Commit realizado; acuse perdido: conserva el mismo delta para reintentar');
        const snapshot = await transaction(['control', 'commits', ...TABLES, 'images'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['receipt', 'commits', receipt.id], ...op.changed.map((c, i) => ['change' + i, c.store, c.row.key]), ...op.images.map((r, i) => ['image' + i, 'images', r.hash])], done, abort));
        if (snapshot.conflict || snapshot.integrity || snapshot.lineageConflict)
            fail('Conflicto tras escribir: recuperación necesaria');
        const { repeated, ...expectedReceipt } = receipt;
        if (!same(expectedReceipt, snapshot.receipt)) {
            await quarantine('Recibo no verificable');
            fail('Recibo no verificable');
        }
        if (snapshot.head?.rootHash !== op.plan.rootHash || snapshot.head?.generation !== receipt.generation)
            {const checkedAt=clock();if(protocol)await protocol.confirmed(context,snapshot);const lineageAfterMs=clock()-checkedAt;return { status: 'committed-but-superseded', receipt, token: null, writeMs, transactionMs, lineagePrepareMs, lineageAfterMs, confirmationMs: clock() - readAt };}
        if (!same(snapshot.head.header, op.plan.header)) {
            await quarantine('Cabecera posterior corrupta');
            fail('Cabecera posterior corrupta');
        }
        for (let i = 0; i < op.changed.length; i++) {
            const row = snapshot['change' + i];
            if (op.changed[i].deleted?row!==null:!same(row, op.changed[i].row) || await sha256(canonical(row.value)) !== row.hash) {
                await quarantine('Lectura posterior corrupta');
                fail('Lectura posterior corrupta');
            }
        }
        for (let i = 0; i < op.images.length; i++) {
            const image = snapshot['image' + i];
            if (!image || image.size !== op.images[i].size || image.blob.size !== image.size || await model.bytesHash(image.blob) !== image.hash) {
                await quarantine('Foto no confirmada');
                fail('Foto no confirmada');
            }
        }
        const checkedAt=clock();if(protocol)await protocol.confirmed(context,snapshot);const lineageAfterMs=clock()-checkedAt;
        return { status: 'confirmed', receipt, token: token(op.plan, freeze(snapshot.head),['planning','routine'].includes(op.command?.kind)?b.historicalGoalIds:null,['planning','routine'].includes(op.command?.kind)?b.routineIndex:null), writeMs, transactionMs, lineagePrepareMs, lineageAfterMs, confirmationMs: clock() - readAt };
    }
    async function page(t, { after = null, limit = 50, date = null } = {}) {
        const b = base(t);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
            fail('Página fuera de presupuesto');
        const start = clock();
        const rows = await transaction(['control', 'commits', 'executions'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['receipt', 'commits', b.head.id]], s => {
            try {
                guard(s.head, s.conflict || s.integrity || s.lineageConflict, s.receipt, b);
                const results = [], store = tx.objectStore('executions'), index = date ? store.index('byDay') : store;
                const range = date ? IDBKeyRange.only(date) : after ? IDBKeyRange.lowerBound(after, true) : null, r = index.openCursor(range);
                r.onerror = () => abort(r.error);
                r.onsuccess = () => {
                    const c = r.result;
                    if (!c || results.length === limit) {
                        done(results);
                        return;
                    }
                    if (!after || c.primaryKey > after)
                        results.push(c.value);
                    c.continue();
                };
            }
            catch (e) {
                abort(e);
            }
        }, abort));
        for (const row of rows)
            if (!same(row, b.maps.executions.get(row.key)) || await sha256(canonical(row.value)) !== row.hash) {
                await quarantine('Página corrupta');
                fail('Página corrupta');
            }
        return { rows, next: rows.length === limit ? rows.at(-1).key : null, readMs: clock() - start, photoBytesHydrated: 0 };
    }
    async function readExecution(t, key) {
        const b = base(t), s = scope(b, key), expected = scopeRecords(s), actual = await transaction(['control', 'commits', 'executions', 'revisions', 'evidence'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['receipt', 'commits', b.head.id], ...expected.map((r, i) => ['scope' + i, r.store, r.row.key])], v => {
            try {
                guard(v.head, v.conflict || v.integrity || v.lineageConflict, v.receipt, b);
                done(v);
            }
            catch (e) {
                abort(e);
            }
        }, abort));
        for (let i = 0; i < expected.length; i++) {
            const row = actual['scope' + i];
            if (!same(row, expected[i].row) || await sha256(canonical(row.value)) !== row.hash) {
                await quarantine('Ejecución o referencia corrupta');
                fail('Ejecución o referencia corrupta');
            }
        }
        const row = s.row;
        return freeze({ key, log: copy(row.value.log), revision: copy(row.value.log.history?.capture.recipeRevisionId ? b.maps.revisions.get(row.value.log.history.capture.recipeRevisionId).value : null), evidence: row.value.evidenceKeys.map(k => copy(b.maps.evidence.get(k).value)), photoBytesHydrated: 0 });
    }
    async function readPhoto(t, owner, id) {
        const b = base(t), key = canonical([owner, id]), expected = b.maps.evidence.get(key), execution = b.plan.tables.executions.find(r => r.value.owner === owner);
        if (!expected)
            fail('Referencia inexistente');
        const value = await transaction(['control', 'commits', ...TABLES, 'images'], 'readonly', (tx, done, abort) => fetch(tx, [['head', 'control', 'head'],['authority','control','authority'], ['conflict', 'control', 'source-conflict'], ['integrity', 'control', 'integrity-block'],['lineageConflict','control','lineage-conflict'], ['receipt', 'commits', b.head.id], ['execution', 'executions', execution?.key || ''], ['evidence', 'evidence', key], ['image', 'images', expected.value.hash]], v => {
            try {
                guard(v.head, v.conflict || v.integrity || v.lineageConflict, v.receipt, b);
                done(v);
            }
            catch (e) {
                abort(e);
            }
        }, abort));
        try {
            if (!same(value.execution, execution) || !same(value.evidence, expected) || !value.image || value.image.blob.size !== value.image.size || await model.bytesHash(value.image.blob) !== expected.value.hash)
                fail('Foto corrupta: no se puede confirmar integridad');
            return { metadata: copy(expected.value), blob: value.image.blob };
        }
        catch (e) {
            await quarantine(e.message);
            throw e;
        }
    }
    async function statistics(t, { from = '', to = '9999-12-31' } = {}) {
        const b = base(t);
        await checkHead(b);
        const result = { recorded: { done: 0, total: 0, completed: 0, executions: 0 }, adopted: 0, legacy: 0 };
        for (const row of b.plan.tables.executions) {
            if (!row.day || row.day < from || row.day > to)
                continue;
            const log = row.value.log, h = log.history;
            if (!h) {
                result.legacy++;
                continue;
            }
            if (h.capture.provenance !== 'recorded') {
                result.adopted++;
                continue;
            }
            result.recorded.executions++;
            if (log.completed)
                result.recorded.completed++;
            if (h.resolution.unitsKnown) {
                result.recorded.total += h.resolution.unitStepIds.length;
                result.recorded.done += h.resolution.unitStepIds.filter(id => log.checkedSteps.includes(id)).length;
            }
        }
        return result;
    }
    async function exportPending(operation, drafts) {
        const op = operations.get(operation);
        if (!op)
            fail('Delta ajeno');
        let command = op.command ? copy(op.command) : null;
        if (command && !['planning','routine'].includes(command.kind)) {
            const action = command.command.action?.type === 'annotate' ? command.command.action.action : command.command.action;
            if (action?.type === 'evidence')
                delete action.evidence.src;
        }
        return require('./recovery-binary.cjs').exportRecovery({ id: operation.id, base: op.base.head, candidate: op.plan, drafts: copy(drafts), operation: command }, legacy);
    }
    return Object.freeze({ readRoutine,prepareRoutine,commitRoutine:commitExecution,routineMetrics:operation=>copy(operations.get(operation)?.metrics||null),readGoal,readDayReview,preparePlanning,commitPlanning:commitExecution,resumePending, inspectOperation, exportPending, openWindow, prepareExecution, commitExecution, page, readExecution, readPhoto, statistics });
}
module.exports = { createIncrementalAccess };
