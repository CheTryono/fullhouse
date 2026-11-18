'use strict';
const { chromium, firefox, webkit } = require('playwright'), assert = require('node:assert/strict');
const { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start({ baseline: true });
    const results = [];
    let cases = 0;
    try {
        for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
            let browser;
            try {
                browser = await type.launch(name === 'chromium' ? { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-precise-memory-info'] } : { headless: true });
            }
            catch (e) {
                if (name === 'chromium')
                    throw e;
                results.push({ browser: name, available: false, error: e.message.slice(0, 1500) });
                continue;
            }
            try {
                for (const width of [1280, 390]) {
                    const context = await browser.newContext({ viewport: { width, height: 950 } }), page = await context.newPage(), errors = [];
                    page.on('pageerror', e => errors.push(e.message));
                    await page.addInitScript(() => {
                        window.storageAttempts = [];
                        for (const name of ['getItem', 'setItem', 'removeItem', 'clear', 'key'])
                            Storage.prototype[name] = function () { storageAttempts.push(name); throw Error('Storage público prohibido'); };
                    });
                    await page.goto(url + '/storage');
                    const small = await page.evaluate(async () => {
                        const H = FullhouseHistory, legacy = H.schedule.validData, doc = H.scenarios(H).list.find(s => s.id === 'partial').doc, db = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-small', legacy, schedule: H.schedule }), plan = await H.storageModel.prepareDocument(doc, legacy);
                        await db.commit(plan, { id: 'init' });
                        const api = db.incremental, opened = await api.openWindow(), key = 'e@2030-01-07', request = { executionId: 'execution', at: '2030-01-07T13:00:00Z', editId: 'note', operationId: 'note', reason: 'Nota explícita', action: { type: 'note', text: 'Nota incremental' } };
                        const operation = await api.prepareExecution(opened.token, key, request);
                        let aborts = 0;
                        for (const fault of ['before-writes', 'after-records']) {
                            try {
                                await api.commitExecution(operation, { fault });
                            }
                            catch {
                                aborts++;
                            }
                            if ((await db.open()).head.generation !== 1)
                                throw Error('Abort dejó cambios');
                        }
                        let ackLost = false;
                        try {
                            await api.commitExecution(operation, { fault: 'lost-ack' });
                        }
                        catch {
                            ackLost = true;
                        }
                        const receipt = await api.inspectOperation(operation), saved = await api.commitExecution(operation), again = await api.commitExecution(operation), view = await api.readExecution(saved.token, key), stats = await api.statistics(saved.token), rows = await api.page(saved.token, { limit: 1, date: '2030-01-07' });
                        let fakeDenied = false;
                        try {
                            await api.commitExecution({ ...operation });
                        }
                        catch {
                            fakeDenied = true;
                        }
                        const packet = await api.exportPending(operation, { note: 'Borrador' }), inspected = await H.recoveryBinary.inspectRecovery(packet, legacy);
                        const acknowledged = await api.resumePending(saved.token, inspected);
                        let staleDenied = false;
                        // Recuperación de un candidato que todavía no se ha persistido.
                        const next = await api.prepareExecution(saved.token, key, { ...request, editId: 'pending', operationId: 'pending', action: { type: 'note', text: 'Recuperado' } }), pendingPacket = await api.exportPending(next, { note: 'Grande' }), parsed = await H.recoveryBinary.inspectRecovery(pendingPacket, legacy), fresh = await api.openWindow(), resumed = await api.resumePending(fresh.token, parsed), recovered = await api.commitExecution(resumed);
                        if ((await api.readExecution(recovered.token, key)).log.note !== 'Recuperado')
                            throw Error('Recuperación cambió el candidato');
                        let superseded = (await api.commitExecution(operation)).status;
                        try {
                            await api.resumePending(recovered.token, inspected);
                        }
                        catch {
                            staleDenied = true;
                        }
                        const firstContext = await api.openWindow(), firstCommand = { executionId: 'new-capture', at: '2030-01-08T12:00:00Z', operationId: 'new-capture', editId: 'new-capture', reason: 'Primera marca', context: { eventId: 'e', date: '2030-01-08', seriesId: 'series', revisionId: 'reused-or-new' }, action: { type: 'step', stepId: 'two', checked: true } }, first = await api.prepareExecution(firstContext.token, 'e@2030-01-08', firstCommand), firstFile = await api.exportPending(first, { note: 'Antes de confirmar' }), firstPacket = await H.recoveryBinary.inspectRecovery(firstFile, legacy), firstResumed = await api.resumePending(firstContext.token, firstPacket), firstSaved = await api.commitExecution(firstResumed);
                        if (firstSaved.status !== 'confirmed' || (await db.open()).status !== 'ready')
                            throw Error('Primera captura no atómica');
                        const firstView = await api.readExecution(firstSaved.token, 'e@2030-01-08');
                        if (firstView.log.history.capture.captureReason !== 'step' || firstView.log.checkedSteps.join() !== 'two')
                            throw Error('Primera marca perdió hechos');
                        const physicalPhoto = await api.readPhoto(firstSaved.token, 'execution:execution', 'photo');
                        if (!physicalPhoto.blob.size)
                            throw Error('Foto no recuperada');
                        const cold = JSON.parse(JSON.stringify(doc));
                        cold.logs = {};
                        cold.recipeRevisions = {};
                        cold.events.forEach(e => { delete e.seriesId; delete e.recipeRevisionId; });
                        const coldDB = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-new-revision', legacy, schedule: H.schedule });
                        await coldDB.commit(await H.storageModel.prepareDocument(cold, legacy), { id: 'seed' });
                        const coldWindow = await coldDB.incremental.openWindow(), photoCommand = { executionId: 'photo-first', at: '2030-01-07T12:00:00Z', operationId: 'photo-first', editId: 'photo-first', reason: 'Foto como primer registro', context: { eventId: 'e', date: '2030-01-07', seriesId: 'new-series', revisionId: 'new-revision' }, action: { type: 'evidence', evidence: { ...doc.logs[key].evidences[0], id: 'first-photo' } } }, photoDelta = await coldDB.incremental.prepareExecution(coldWindow.token, key, photoCommand);
                        try {
                            await coldDB.incremental.commitExecution(photoDelta, { fault: 'after-records' });
                        }
                        catch { }
                        const aborted = await coldDB.open();
                        if (aborted.plan.tables.revisions.length || aborted.plan.tables.executions.length || aborted.storedImages)
                            throw Error('Primera foto parcialmente persistida');
                        const photoPackage = await H.recoveryBinary.inspectRecovery(await coldDB.incremental.exportPending(photoDelta, { note: 'Foto pendiente' }), legacy), photoResume = await coldDB.incremental.resumePending(coldWindow.token, photoPackage);
                        await coldDB.incremental.commitExecution(photoResume);
                        const coldSaved = await coldDB.open();
                        if (coldSaved.plan.tables.revisions.length !== 1 || coldSaved.plan.tables.executions.length !== 1 || coldSaved.storedImages !== 1)
                            throw Error('Primera foto no conservó revisión y captura juntas');
                        coldDB.close();
                        // Dos conexiones compiten por la misma generación; solo una gana.
                        const other = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-small', legacy, schedule: H.schedule }), base1 = await api.openWindow(), base2 = await other.incremental.openWindow(), a = await api.prepareExecution(base1.token, key, { ...request, editId: 'a', operationId: 'a' }), b = await other.incremental.prepareExecution(base2.token, key, { ...request, editId: 'b', operationId: 'b' }), competition = await Promise.allSettled([api.commitExecution(a), other.incremental.commitExecution(b)]);
                        const worker = H.createWorkerPort(() => new Worker('/history-worker.js')), workerPlan = await worker.run('prepare', 'prepare', doc);
                        await worker.run('verify', 'verify', workerPlan);
                        worker.close();
                        const vaultName = 'fullhouse-lab-privacy-' + crypto.randomUUID();
                        await new Promise((resolve, reject) => { const r = indexedDB.open(vaultName, 1); r.onupgradeneeded = () => { r.result.createObjectStore('images'); r.result.createObjectStore('refs'); }; r.onerror = () => reject(r.error); r.onsuccess = () => { window.syntheticPrivacyDB = r.result; resolve(); }; });
                        const tx = syntheticPrivacyDB.transaction(['images', 'refs'], 'readwrite');
                        tx.objectStore('images').put(new Blob(['Synthetic bytes']), 'hash');
                        tx.objectStore('refs').put('hash', 'owner-a');
                        tx.objectStore('refs').put('hash', 'owner-b');
                        await new Promise((res, rej) => { tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
                        async function remove(owner) {
                            const t = syntheticPrivacyDB.transaction(['images', 'refs'], 'readwrite');
                            t.objectStore('refs').delete(owner);
                            const r = t.objectStore('refs').count();
                            r.onsuccess = () => {
                                if (r.result === 0)
                                    t.objectStore('images').delete('hash');
                            };
                            await new Promise((res, rej) => { t.oncomplete = res; t.onabort = () => rej(t.error); });
                            const read = syntheticPrivacyDB.transaction('images').objectStore('images').get('hash');
                            return new Promise(res => { read.onsuccess = () => res(!!read.result); });
                        }
                        const sharedRetained = await remove('owner-a'), lastDeleted = !await remove('owner-b');
                        syntheticPrivacyDB.close();
                        // Corrupción conocida bloquea escrituras también después de reabrir.
                        const trusted = await api.openWindow(), raw = await new Promise((res, rej) => { const r = indexedDB.open('fullhouse-lab-readiness-small', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
                        const corrupt = raw.transaction('executions', 'readwrite'), requestRow = corrupt.objectStore('executions').get(key);
                        requestRow.onsuccess = () => { const row = requestRow.result; row.value.log.note = 'Corrupt outside protocol'; corrupt.objectStore('executions').put(row); };
                        await new Promise((res, rej) => { corrupt.oncomplete = res; corrupt.onabort = () => rej(corrupt.error); });
                        raw.close();
                        let corruptionBlocked = false;
                        try {
                            await api.readExecution(trusted.token, key);
                        }
                        catch {
                            corruptionBlocked = true;
                        }
                        const quarantine = (await db.open()).status, diagnostic = await db.exportDiagnostic();
                        if (await diagnostic.slice(0, 'FULLHOUSE-DIAGNOSTIC-1\n'.length).text() !== 'FULLHOUSE-DIAGNOSTIC-1\n')
                            throw Error('Diagnóstico sin etiqueta');
                        let diagnosticRejected = false;
                        try {
                            await H.storageArchive.importArchive(diagnostic, legacy);
                        }
                        catch {
                            diagnosticRejected = true;
                        }
                        if (!diagnosticRejected)
                            throw Error('Diagnóstico presentado como respaldo');
                        const migration = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-source', legacy, schedule: H.schedule }), sources = { main: JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: [] } } }), alias: null }, proposal = await H.storageSources.proposeMigration(sources, 'main', legacy);
                        await migration.stageMigration(proposal, { id: 'migration' });
                        await migration.finalizeMigration('migration', { confirm: true, readSources: () => sources });
                        let migratedFastBlocked = false;
                        try {
                            await migration.incremental.openWindow();
                        }
                        catch {
                            migratedFastBlocked = true;
                        }
                        const migratedStillReady = (await migration.open()).status;
                        const warm = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-warm-source', legacy, schedule: H.schedule });
                        await warm.commit(plan, { id: 'seed' });
                        const warmWindow = await warm.incremental.openWindow(), warmDelta = await warm.incremental.prepareExecution(warmWindow.token, key, { ...request, editId: 'warm', operationId: 'warm' });
                        await warm.stageMigration(proposal, { id: 'pending-migration', expected: (await warm.open()).head });
                        let warmSourceBlocked = false;
                        try {
                            await warm.incremental.commitExecution(warmDelta);
                        }
                        catch (e) {
                            warmSourceBlocked = /autoridad/.test(e.message);
                        }
                        if (!warmSourceBlocked || (await warm.open()).head.generation !== 1)
                            throw Error('Fuentes nuevas no bloquearon la ventana abierta');
                        warm.close();
                        migration.close();
                        const upgradeName = 'fullhouse-lab-readiness-upgrade', initial = H.createLabDatabase({ factory: indexedDB, name: upgradeName, legacy });
                        await initial.commit(plan, { id: 'seed' });
                        initial.close();
                        const held = await new Promise((res, rej) => { const r = indexedDB.open(upgradeName, 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
                        let blocked = false;
                        await new Promise((res, rej) => { const r = indexedDB.open(upgradeName, 2); r.onblocked = () => { blocked = true; held.close(); }; r.onerror = () => rej(r.error); r.onsuccess = () => { r.result.close(); res(); }; });
                        const incompatible = H.createLabDatabase({ factory: indexedDB, name: upgradeName, legacy });
                        const incompatibleState = await incompatible.open();
                        incompatible.close();
                        db.close();
                        other.close();
                        return { acknowledged: acknowledged.status, corruptionBlocked, quarantine, migratedFastBlocked, migratedStillReady, upgradeBlocked: blocked, incompatible: incompatibleState.status, aborts, ackLost, receipt: receipt.status, status: saved.status, repeated: again.receipt.id === saved.receipt.id, note: view.log.note, photoBytesHydrated: view.photoBytesHydrated, stats, rows: rows.rows.length, fakeDenied, staleDenied, superseded, resumedId: resumed.id, competition: competition.map(r => r.status), workerRoot: workerPlan.rootHash === plan.rootHash, privacy: { sharedRetained, lastDeleted } };
                    });
                    assert.equal(small.acknowledged, 'already-confirmed');
                    assert.ok(small.corruptionBlocked);
                    assert.equal(small.quarantine, 'recovery');
                    assert.ok(small.migratedFastBlocked);
                    assert.equal(small.migratedStillReady, 'ready');
                    assert.ok(small.upgradeBlocked);
                    assert.equal(small.incompatible, 'recovery');
                    assert.equal(small.aborts, 2);
                    assert.ok(small.ackLost);
                    assert.equal(small.receipt, 'persisted-receipt');
                    assert.equal(small.status, 'confirmed');
                    assert.ok(small.repeated);
                    assert.equal(small.note, 'Nota incremental');
                    assert.equal(small.photoBytesHydrated, 0);
                    assert.ok(small.fakeDenied);
                    assert.ok(small.staleDenied);
                    assert.equal(small.superseded, 'committed-but-superseded');
                    assert.equal(small.resumedId, 'pending');
                    assert.equal(small.competition.filter(s => s === 'fulfilled').length, 1);
                    assert.ok(small.workerRoot);
                    assert.ok(small.privacy.sharedRetained && small.privacy.lastDeleted);
                    cases += 28;
                    const second = await context.newPage();
                    await second.goto(url + '/storage');
                    await page.evaluate(async () => { const H = FullhouseHistory, d = H.scenarios(H).list.find(s => s.id === 'partial').doc, db = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-two-pages', legacy: H.schedule.validData, schedule: H.schedule }); await db.commit(await H.storageModel.prepareDocument(d, H.schedule.validData), { id: 'seed' }); db.close(); });
                    for (const p of [page, second])
                        await p.evaluate(async () => { const H = FullhouseHistory; window.race = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-two-pages', legacy: H.schedule.validData, schedule: H.schedule }); window.raceToken = (await race.incremental.openWindow()).token; });
                    const raced = await Promise.all([page, second].map((p, i) => p.evaluate(async (i) => {
                        const operation = await race.incremental.prepareExecution(raceToken, 'e@2030-01-07', { executionId: 'execution', at: '2030-01-07T13:00:00Z', editId: 'tab' + i, operationId: 'tab' + i, reason: 'Dos pestañas', action: { type: 'note', text: 'Tab ' + i } });
                        try {
                            return (await race.incremental.commitExecution(operation)).status;
                        }
                        catch (e) {
                            return e.message;
                        }
                    }, i)));
                    assert.equal(raced.filter(s => s === 'confirmed').length, 1);
                    assert.equal(raced.filter(s => /obsoleta/.test(s)).length, 1);
                    await second.close();
                    cases++;
                    if (name === 'chromium' && !process.env.FULLHOUSE_READINESS_SMALL) {
                        const large = await page.evaluate(async () => {
                            const H = FullhouseHistory, L = H.schedule.validData, now = () => performance.now(), heapSample = () => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null, copy = x => JSON.parse(JSON.stringify(x)), doc = copy(H.scenarios(H).list.find(s => s.id === 'partial').doc), template = copy(Object.values(doc.logs)[0]);
                            doc.logs = {};
                            for (let i = 0; i < 5000; i++) {
                                const date = new Date(Date.UTC(2030, 0, 7 + i)).toISOString().slice(0, 10), log = copy(template);
                                log.evidences = [];
                                Object.assign(log.history.capture, { executionId: 'execution-' + i, scheduledDate: date, capturedAt: date + 'T12:00:00Z' });
                                log.history.state.lastRecordedAt = date + 'T12:00:00Z';
                                doc.logs['e@' + date] = log;
                            }
                            for (let i = 0; i < 500; i++) {
                                const r = copy(Object.values(doc.recipeRevisions)[0]);
                                r.id = 'revision-' + i;
                                r.definition.title = 'Version ' + i;
                                doc.recipeRevisions[r.id] = r;
                            }
                            const keys = Object.keys(doc.logs), canvas = document.createElement('canvas');
                            canvas.width = 1100;
                            canvas.height = 1100;
                            const ctx = canvas.getContext('2d');
                            for (let n = 0; n < 64; n++) {
                                const image = ctx.createImageData(1100, 1100);
                                let seed = n + 1;
                                for (let i = 0; i < image.data.length; i += 4) {
                                    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                                    image.data[i] = seed & 255;
                                    image.data[i + 1] = (seed >>> 8) & 255;
                                    image.data[i + 2] = (seed >>> 16) & 255;
                                    image.data[i + 3] = 255;
                                }
                                ctx.putImageData(image, 0, 0);
                                const date = keys[n].slice(-10);
                                doc.logs[keys[n]].evidences = [{ id: 'photo', kind: 'image', src: canvas.toDataURL('image/jpeg', .66), caption: 'Noise synthetic ' + n, createdAt: date + 'T12:00:00Z' }];
                            }
                            const png = canvas.toDataURL('image/png');
                            doc.logs[keys[64]].evidences = [{ id: 'png', kind: 'image', src: png, caption: 'Large synthetic PNG', createdAt: doc.logs[keys[64]].history.capture.capturedAt }];
                            doc.logs[keys[65]].evidences = copy(doc.logs[keys[64]].evidences);
                            const old = H.baseline, oldDB = old.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-before', legacy: L }), db = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-after', legacy: L, schedule: H.schedule }), engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter });
                            const memoryInput = heapSample();
                            let timer, probe, lastTick, ticks = 0, maxGap = 0;
                            const probeStart = () => { lastTick = now(); ticks = 0; maxGap = 0; timer = setInterval(() => { const t = now(); maxGap = Math.max(maxGap, t - lastTick); lastTick = t; ticks++; }, 16); };
                            const probeEnd = () => { clearInterval(timer); return { ticks, maxObservedGapMs: Math.max(maxGap, now() - lastTick) }; };
                            probeStart();
                            let mark = now(), oldPlan = await old.model.prepareDocument(doc, L);
                            const beforePrepareMs = now() - mark, beforeMainThreadProbe = probeEnd(), memoryAfterBaselinePrepare = heapSample();
                            mark = now();
                            await oldDB.commit(oldPlan, { id: 'seed' });
                            const beforeSeedMs = now() - mark;
                            mark = now();
                            const oldOpen = await oldDB.open(), beforeOpenMs = now() - mark;
                            probeStart();
                            mark = now();
                            const worker = H.createWorkerPort(() => new Worker('/history-worker.js')), plan = await worker.run('seed', 'prepare', doc), workerPrepareMs = now() - mark, workerMainThreadProbe = probeEnd(), memoryAfterWorkerPrepare = heapSample();
                            mark = now();
                            await db.commit(plan, { id: 'seed' });
                            const afterSeedMs = now() - mark;
                            mark = now();
                            let opened = await db.incremental.openWindow(), afterOpenMs = now() - mark, token = opened.token, oldHead = oldOpen.head, current = doc;
                            const commands = [['step', { type: 'step', stepId: 'one', checked: false }], ['note', { type: 'note', text: 'Nota medida' }], ['photo', { type: 'evidence', evidence: { id: 'new-photo', kind: 'image', src: canvas.toDataURL('image/jpeg', .79), caption: 'Foto nueva', createdAt: '2030-01-07T13:00:00Z' } }], ['photo-deduplicated', { type: 'evidence', evidence: { id: 'shared-photo', kind: 'image', src: png, caption: 'PNG sin duplicar bytes', createdAt: '2030-01-07T13:00:00Z' } }]], operations = [];
                            for (const [kind, action] of commands) {
                                const id = 'measured-' + kind, request = { executionId: 'execution-0', at: '2030-01-07T13:00:00Z', editId: id, operationId: id, reason: 'Operación medida', action };
                                const minimal = { version: 2, goals: [], routines: [], events: [], recipeRevisions: { revision: current.recipeRevisions.revision }, logs: { [keys[0]]: current.logs[keys[0]] } }, updated = compat.native(minimal, request).after.logs[keys[0]];
                                const full = { ...current, logs: { ...current.logs, [keys[0]]: updated } };
                                mark = now();
                                const candidate = await old.model.prepareDocument(full, L), beforePrepareMs = now() - mark;
                                mark = now();
                                const slow = await oldDB.commit(candidate, { expected: oldHead, id });
                                const beforeCommitMs = now() - mark;
                                oldHead = slow.head;
                                current = full;
                                mark = now();
                                const delta = await db.incremental.prepareExecution(token, keys[0], request), afterPrepareMs = now() - mark;
                                const saved = await db.incremental.commitExecution(delta);
                                if (saved.status !== 'confirmed' || saved.receipt.rootHash !== slow.receipt.rootHash)
                                    throw Error('Antes/después no conserva los mismos hechos: ' + kind);
                                token = saved.token;
                                operations.push({ kind, beforePrepareMs, beforeCommitMs, afterPrepareMs, writeMs: saved.writeMs, confirmationMs: saved.confirmationMs, changedRows: delta.changedRows, newImages: delta.newImages });
                            }
                            const newDate = new Date(Date.UTC(2030, 0, 7 + 5000)).toISOString().slice(0, 10), newKey = 'e@' + newDate, newRequest = { executionId: 'new-after-5000', at: newDate + 'T12:00:00Z', editId: 'first-after-5000', operationId: 'first-after-5000', reason: 'Primer registro tras años', context: { eventId: 'e', date: newDate, seriesId: 'series', revisionId: 'new-if-required' }, action: { type: 'note', text: 'Primera nota del día nuevo' } };
                            const minimalNew = { ...current, logs: {} }, created = compat.native(minimalNew, newRequest).after.logs[newKey], nextDocument = { ...current, logs: { ...current.logs, [newKey]: created } };
                            mark = now();
                            const slowFirstPlan = await old.model.prepareDocument(nextDocument, L), firstBeforePrepareMs = now() - mark;
                            mark = now();
                            const slowFirst = await oldDB.commit(slowFirstPlan, { expected: oldHead, id: newRequest.operationId }), firstBeforeCommitMs = now() - mark;
                            oldHead = slowFirst.head;
                            current = nextDocument;
                            mark = now();
                            const firstDelta = await db.incremental.prepareExecution(token, newKey, newRequest), firstAfterPrepareMs = now() - mark, firstFast = await db.incremental.commitExecution(firstDelta);
                            if (firstFast.receipt.rootHash !== slowFirst.receipt.rootHash)
                                throw Error('Primera captura difiere de la ruta completa');
                            token = firstFast.token;
                            operations.push({ kind: 'first-capture', beforePrepareMs: firstBeforePrepareMs, beforeCommitMs: firstBeforeCommitMs, afterPrepareMs: firstAfterPrepareMs, writeMs: firstFast.writeMs, confirmationMs: firstFast.confirmationMs, changedRows: firstDelta.changedRows, newImages: firstDelta.newImages });
                            const memoryBeforeEdits = heapSample();
                            mark = now();
                            const baselineSnapshot = await oldDB.open(), baselineOpenAfterChangesMs = now() - mark;
                            mark = now();
                            const baselineFile = await old.archive.exportArchive(baselineSnapshot.plan, L), baselineExportMs = now() - mark;
                            mark = now();
                            const baselineImported = await old.archive.importArchive(baselineFile, L), baselineImportMs = now() - mark, baselineRestore = old.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-before-restore', legacy: L });
                            mark = now();
                            await baselineRestore.commit(baselineImported, { id: 'restore' });
                            const baselineRestoreMs = now() - mark;
                            baselineRestore.close();
                            const comparablePlan = (await db.open()).plan;
                            mark = now();
                            const comparableFile = await worker.run('comparable-export', 'export', comparablePlan), comparableExportMs = now() - mark;
                            mark = now();
                            const comparableImport = await worker.run('comparable-import', 'import', comparableFile), comparableImportMs = now() - mark, comparableRestore = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-after-restore', legacy: L });
                            mark = now();
                            await comparableRestore.commit(comparableImport, { id: 'restore' });
                            const comparableRestoreMs = now() - mark;
                            comparableRestore.close();
                            if (baselineFile.size !== comparableFile.size || baselineSnapshot.head.rootHash !== comparablePlan.rootHash)
                                throw Error('Comparación de archivos sobre conjuntos distintos');
                            mark = now();
                            const execution = await db.incremental.readExecution(token, keys[0]), readExecutionMs = now() - mark;
                            mark = now();
                            const statistics = await db.incremental.statistics(token), statisticsMs = now() - mark;
                            mark = now();
                            const paged = await db.incremental.page(token, { limit: 50 }), pageMs = now() - mark;
                            const edits = [];
                            for (let i = 0; i < 100; i++) {
                                const prepareAt = now();
                                const delta = await db.incremental.prepareExecution(token, keys[0], { executionId: 'execution-0', at: '2030-01-07T13:00:00Z', editId: 'edit-' + i, operationId: 'edit-' + i, reason: 'Edición repetida sintética', action: { type: 'note', text: 'Nota repetida ' + i } });
                                const preparation = now() - prepareAt, saved = await db.incremental.commitExecution(delta);
                                token = saved.token;
                                edits.push({ prepareMs: preparation, writeMs: saved.writeMs, confirmationMs: saved.confirmationMs });
                            }
                            const delta = await db.incremental.prepareExecution(token, keys[0], { executionId: 'execution-0', at: '2030-01-07T13:00:00Z', editId: 'large-pending', operationId: 'large-pending', reason: 'Pendiente sintético grande', action: { type: 'note', text: 'Pendiente grande' } });
                            mark = now();
                            const packet = await db.incremental.exportPending(delta, { note: 'Borrador grande' }), recoveryExportMs = now() - mark;
                            mark = now();
                            const inspected = await H.recoveryBinary.inspectRecovery(packet, L), recoveryReadMs = now() - mark;
                            mark = now();
                            const state = await db.open(), fullVerificationMs = now() - mark;
                            mark = now();
                            const file = await worker.run('export', 'export', state.plan), exportMs = now() - mark;
                            mark = now();
                            const imported = await worker.run('import', 'import', file), importMs = now() - mark, newDB = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-restore', legacy: L });
                            mark = now();
                            await newDB.commit(imported, { id: 'restore' });
                            const restoreCommitMs = now() - mark;
                            if ((await newDB.open()).head.rootHash !== state.head.rootHash || inspected.candidate.rootHash === state.head.rootHash)
                                throw Error('Respaldo/pendiente confundidos');
                            let sinkAborted = false;
                            try {
                                await H.storageArchive.writeArchive(state.plan, L, { write() { throw Error('Disk failure'); }, close() { throw Error('Should not close'); }, abort() { sinkAborted = true; } });
                            }
                            catch { }
                            if (!sinkAborted)
                                throw Error('Exportación fallida no abortó');
                            const last = await db.incremental.readExecution(token, keys[0]), assetBytes = plan.images.reduce((n, i) => n + i.size, 0), heap = performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null;
                            worker.close();
                            db.close();
                            oldDB.close();
                            newDB.close();
                            return { memorySamples: { input: memoryInput, afterBaselinePrepare: memoryAfterBaselinePrepare, afterWorkerPrepare: memoryAfterWorkerPrepare, beforeEdits: memoryBeforeEdits }, beforeMainThreadProbe, workerMainThreadProbe, comparableArchive: { bytes: baselineFile.size, beforeOpenMs: baselineOpenAfterChangesMs, beforeExportMs: baselineExportMs, beforeImportMs: baselineImportMs, beforeRestoreCommitMs: baselineRestoreMs, afterExportMs: comparableExportMs, afterImportMs: comparableImportMs, afterRestoreCommitMs: comparableRestoreMs }, executions: 5000, revisions: 501, images: plan.images.length, assetBytes, years: 5000 / 365.25, initial: { beforePrepareMs, beforeSeedMs, beforeOpenMs, workerPrepareMs, afterSeedMs, afterOpenMs }, operations, readExecutionMs, statisticsMs, statistics, pageMs, pageRows: paged.rows.length, photoBytesHydrated: execution.photoBytesHydrated, edits, diaryEntries: last.log.recordEdits.entries.length, fullVerificationMs, archiveBytes: file.size, exportMs, importMs, restoreCommitMs, recoveryBytes: packet.size, recoveryExportMs, recoveryReadMs, heap, sinkAborted };
                        });
                        const retained = {};
                        for (const mode of ['full-session', 'incremental-window']) {
                            const memoryPage = await context.newPage();
                            await memoryPage.goto(url + '/storage');
                            const before = await memoryPage.evaluate(async (mode) => {
                                const H = FullhouseHistory, L = H.schedule.validData, db = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-readiness-after', legacy: L, schedule: H.schedule });
                                window.memoryDatabase = db;
                                if (mode === 'full-session') {
                                    const engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ engine, adapter, legacy: L });
                                    window.memoryHandle = H.createCompatSession({ database: db, compat, legacy: L, plannerActions: H.plannerActions, engine });
                                    await memoryHandle.open();
                                    return { root: memoryHandle.state().head.rootHash };
                                }
                                window.memoryHandle = await db.incremental.openWindow();
                                return { root: memoryHandle.token.rootHash };
                            }, mode);
                            let gcRequested = false;
                            try {
                                await memoryPage.requestGC();
                                gcRequested = true;
                            }
                            catch { }
                            const memory = await memoryPage.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null);
                            retained[mode] = { ...before, gcRequested, memory };
                            await memoryPage.evaluate(() => memoryDatabase.close());
                            await memoryPage.close();
                        }
                        assert.equal(retained['full-session'].root, retained['incremental-window'].root);
                        large.retainedHeapProbe = retained;
                        assert.equal(large.executions, 5000);
                        assert.equal(large.revisions, 501);
                        assert.ok(large.assetBytes > 40000000);
                        assert.equal(large.photoBytesHydrated, 0);
                        assert.equal(large.pageRows, 50);
                        assert.ok(large.diaryEntries >= 103);
                        results.push({ browser: name, version: browser.version(), width, available: true, small, large });
                        cases += 10;
                    }
                    else
                        results.push({ browser: name, version: browser.version(), width, available: true, small });
                    const capabilities = await page.evaluate(async () => ({ indexedDB: !!globalThis.indexedDB, webLocks: !!navigator.locks, broadcastChannel: !!globalThis.BroadcastChannel, persisted: navigator.storage?.persisted ? await navigator.storage.persisted() : null, persistGranted: navigator.storage?.persist ? await navigator.storage.persist() : null, estimate: navigator.storage?.estimate ? await navigator.storage.estimate() : null }));
                    if (results.at(-1)?.available)
                        results.at(-1).capabilities = capabilities;
                    assert.deepEqual(errors, []);
                    assert.deepEqual(await page.evaluate(() => storageAttempts), []);
                    await context.close();
                }
            }
            finally {
                await browser.close();
            }
        }
        console.log(JSON.stringify({ base: '35ca45c', node: process.version, cases, results }, null, 2));
    }
    finally {
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
