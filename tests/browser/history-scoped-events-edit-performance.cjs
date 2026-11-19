'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
        const context = await browser.newContext({ timezoneId: 'UTC' }), page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[k] = () => { throw Error('No public storage'); }; });
        await page.goto(url + '/storage');
        const result = await page.evaluate(async () => {
            const H = FullhouseHistory, L = H.schedule.validData, now = () => performance.now(), heapSample = () => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null, copy = x => JSON.parse(JSON.stringify(x)), doc = copy(H.scenarios(H).list.find(s => s.id === 'edited').doc), template = copy(Object.values(doc.logs)[0]);
            doc.logs = {};
            for (let i = 0; i < 5000; i++) {
                const date = new Date(Date.UTC(2030, 0, 7 + i)).toISOString().slice(0, 10), log = copy(template);
                log.evidences = [];
                Object.assign(log.history.capture, { executionId: 'execution-' + i, scheduledDate: date, capturedAt: date + 'T12:00:00Z' });
                log.history.state.lastRecordedAt = date + 'T12:00:00Z';
                if (log.completed)
                    log.history.state.completedRecordedAt = date + 'T12:00:00Z';
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
            const opts = { factory: indexedDB, legacy: L, schedule: H.schedule, plannerActions: H.plannerActions }, db = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-edit-performance', readSources: () => ({ main: null, alias: null }) }), old = H.createLabDatabase({ ...opts, name: 'fullhouse-lab-edit-full' });
            let mark = now();
            const plan = await H.storageModel.prepareDocument(doc, L), seedPrepareMs = now() - mark;
            if (plan.images.length !== 65 || plan.images.reduce((n, i) => n + i.size, 0) !== 42175847)
                throw Error('Reference corpus changed');
            await db.commit(plan, { id: 'seed' });
            await old.commit(plan, { id: 'seed' });
            const engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter }), session = H.createCompatSession({ database: old, compat, legacy: L, plannerActions: H.plannerActions, engine }), contextFor = id => ({ operationId: id, today: '2044-01-08', at: '2044-01-08T12:00:00Z', confirm: true });
            mark = now();
            await session.open();
            const fullOpenMs = now() - mark;
            mark = now();
            let token = (await db.incremental.openWindow()).token;
            const openMs = now() - mark;
            mark = now();
            let previousSessionError = null;
            try {
                const attempt = await session.plan('saveEvent', { ...doc.events[0], title: 'Old attempt' }, { ...contextFor('attempt'), ids: ['old-segment'] });
                if (attempt.pending)
                    previousSessionError = attempt.pending.error;
            }
            catch (e) {
                previousSessionError = e.message;
            }
            const previousAttemptMs = now() - mark;
            if (!previousSessionError)
                throw Error('Update comparator: old session now accepts corpus');
            let full = doc, oldHead = (await old.open()).head, currentId = 'e';
            const operations = [];
            for (const id of ['metadata', 'time-cut', 'weekly-cut']) {
                mark = now();
                const view = await db.incremental.readEventEdit(token, currentId), catalogReadMs = now() - mark;
                if (view.captures.length !== 5000 || view.photoBytesHydrated !== 0)
                    throw Error('Historical catalog lost');
                const payload = { ...view.event };
                if (id === 'metadata') {
                    payload.title = ' Renamed ';
                    payload.note = 'New planned instruction';
                }
                else if (id === 'time-cut') {
                    payload.time = '10:00';
                    payload.applyFrom = '2050-01-01';
                }
                else {
                    payload.time = '11:00';
                    payload.repeat = 'weekly';
                    payload.applyFrom = '2050-01-08';
                }
                mark = now();
                const reservation = await db.incremental.reserveEventEdit(token, currentId, id), reservationMs = now() - mark;
                // Independent explicit expected deltas for these three simple cases. The physical
                // comparator rebuilds all facts/photos; it does not reuse the incremental root.
                let expected;
                if (id === 'metadata')
                    expected = full.events.map(e => e.id === currentId ? { ...e, title: 'Renamed', note: payload.note } : e);
                else {
                    const cut = payload.applyFrom, prior = H.calendarMath.date(H.calendarMath.ordinal(cut) - 1), original = full.events.find(e => e.id === currentId), prefix = { ...original, endDate: prior, specificDates: [], overrides: {} }, future = { ...payload, id: reservation.eventId, seriesId: reservation.seriesId, date: cut, specificDates: [], overrides: {} };
                    delete future.applyFrom;
                    delete future.recipeRevisionId;
                    expected = full.events.map(e => e.id === currentId ? prefix : e).concat(future);
                }
                const next = { ...full, events: expected };
                mark = now();
                const complete = await H.storageModel.prepareDocument(next, L), fullPrepareMs = now() - mark;
                mark = now();
                const slow = await old.commit(complete, { id, expected: oldHead }), fullCommitMs = now() - mark;
                oldHead = slow.head;
                full = next;
                mark = now();
                const op = await db.incremental.prepareEventEdit(token, reservation, payload, contextFor(id)), prepareMs = now() - mark, metrics = db.incremental.eventEditMetrics(op);
                let recovered = op, recovery = null;
                if (id === 'time-cut') {
                    mark = now();
                    const file = await db.incremental.exportPending(op, { event: payload }), exportMs = now() - mark;
                    mark = now();
                    const packet = await H.recoveryBinary.inspectRecovery(file, L), inspectMs = now() - mark;
                    mark = now();
                    recovered = await db.incremental.resumePending(token, packet);
                    recovery = { bytes: file.size, exportMs, inspectMs, rebuildMs: now() - mark };
                    if (recovered.id !== op.id)
                        throw Error('Recovery changed identity');
                }
                const saved = await db.incremental.commitEventEdit(recovered);
                if (saved.status !== 'confirmed' || saved.receipt.rootHash !== complete.rootHash || saved.receipt.newImages !== 0)
                    throw Error('Full/incremental root mismatch');
                token = saved.token;
                if (id !== 'metadata')
                    currentId = reservation.eventId;
                mark = now();
                const read = await db.incremental.readEventEdit(token, currentId), readMs = now() - mark;
                if (read.captures.length !== 5000 || read.photoBytesHydrated !== 0)
                    throw Error('Historical read hydrated photos');
                operations.push({ id, catalogReadMs, reservationMs, fullPrepareMs, fullCommitMs, prepareMs, ...metrics, transactionMs: saved.transactionMs, lineagePrepareMs: saved.lineagePrepareMs, lineageAfterMs: saved.lineageAfterMs, confirmationMs: saved.confirmationMs, readMs, changedRows: op.changedRows, newImages: saved.receipt.newImages, photoBytesHydrated: 0, recovery });
            }
            const saved = await db.open();
            for (const table of ['executions', 'revisions', 'evidence']) {
                const hashes = new Map(plan.tables[table].map(r => [r.key, r.hash]));
                if (saved.plan.tables[table].length !== hashes.size || saved.plan.tables[table].some(r => hashes.get(r.key) !== r.hash))
                    throw Error('Historical hash changed');
            }
            await db.auditLineage();
            mark = now();
            const archive = await H.storageArchive.exportArchive(saved.plan, L), exportMs = now() - mark;
            mark = now();
            const imported = await H.storageArchive.importArchive(archive, L), importMs = now() - mark, target = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-edit-restored', readSources: () => ({ main: null, alias: null }) });
            mark = now();
            await target.commit(imported, { id: 'restore', confirmRestore: true });
            const restoreMs = now() - mark, restored = await target.open();
            if (restored.head.rootHash !== saved.head.rootHash)
                throw Error('Restore root changed');
            for (const image of plan.images) {
                const actual = restored.plan.images.find(i => i.hash === image.hash);
                if (!actual || actual.size !== image.size || await H.storageModel.bytesHash(actual.blob) !== image.hash)
                    throw Error('Photo bytes changed');
            }
            const heap = heapSample();
            db.close();
            old.close();
            target.close();
            return { executions: plan.tables.executions.length, revisions: plan.tables.revisions.length, images: plan.images.length, photoBytes: plan.images.reduce((n, i) => n + i.size, 0), seedPrepareMs, fullOpenMs, openMs, previousSessionError, previousAttemptMs, operations, archiveBytes: archive.size, exportMs, importMs, restoreMs, heap, allHistoricalHashesEqual: true, allPhotoBytesVerified: true };
        });
        const memoryPage = await context.newPage();
        await memoryPage.goto(url + '/storage');
        result.metadataMemory = await memoryPage.evaluate(async () => { const heap = () => { globalThis.gc?.(); return performance.memory?.usedJSHeapSize ?? null; }, before = heap(), H = FullhouseHistory; window.memoryDB = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-edit-performance', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); window.memoryToken = (await memoryDB.incremental.openWindow()).token; const after = heap(); memoryDB.close(); return { beforeJSHeapBytes: before, afterJSHeapBytes: after, deltaJSHeapBytes: after - before, requestedGC: typeof globalThis.gc === 'function', scope: 'Retained JS heap of metadata window; not peak, native blobs or total RSS' }; });
        await memoryPage.close();
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ base: 'c61e6ac', browser: browser.version(), sample: 'Single desktop run; same facts/browser; previous full session rejects corpus, full physical comparator separate. No mobile or memory reduction claim.', result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
