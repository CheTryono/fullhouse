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
            const opts = { factory: indexedDB, legacy: L, schedule: H.schedule, plannerActions: H.plannerActions }, db = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-shift-performance', readSources: () => ({ main: null, alias: null }) }), old = H.createLabDatabase({ ...opts, name: 'fullhouse-lab-shift-full' });
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
                const attempt = await session.plan('shiftEvent', {eventId:'e',date:'2050-01-01',delta:15}, { ...contextFor('attempt'), ids: ['old-segment'] });
                if (attempt.pending)
                    previousSessionError = attempt.pending.error;
            }
            catch (e) {
                previousSessionError = e.message;
            }
            const previousAttemptMs = now() - mark;
            if (!previousSessionError)
                throw Error('Update comparator: old session now accepts corpus');
            let full = doc, oldHead = (await old.open()).head;
            const operations = [];
            for (const [id,date,deltaMinutes] of [['forward','2050-01-01',15],['backward','2050-01-01',-30],['other-day','2050-01-02',120]]) {
                const payload={eventId:'e',seriesId:'series',date,deltaMinutes};
                mark=now();const view=await db.incremental.readEventShift(token,payload,contextFor(id)),catalogReadMs=now()-mark;
                if(view.photoBytesHydrated!==0||view.recorded)throw Error('Wrong historical scope');
                mark=now();const reservation=await db.incremental.reserveEventShift(token,payload,contextFor(id)),reservationMs=now()-mark;
                // Independent real Planner shift; the physical comparator rebuilds every fact/blob.
                const actor=H.plannerActions({...full,logs:{}},{...contextFor(id),ids:[]});
                actor.controller.shiftEvent(full.events.find(e=>e.id==='e'),date,deltaMinutes);
                const expected=actor.result().candidate;if(!expected)throw Error('Comparator rejected shift');
                const next={...full,events:expected.events};
                mark=now();const complete=await H.storageModel.prepareDocument(next,L),fullPrepareMs=now()-mark;
                mark=now();const slow=await old.commit(complete,{id,expected:oldHead}),fullCommitMs=now()-mark;
                oldHead=slow.head;full=next;
                mark=now();const op=await db.incremental.prepareEventShift(token,reservation),prepareMs=now()-mark,metrics=db.incremental.eventShiftMetrics(op);
                let recovered=op,recovery=null;
                if(id==='backward'){
                    mark=now();const file=await db.incremental.exportPending(op,{shift:payload}),exportMs=now()-mark;
                    mark=now();const packet=await H.recoveryBinary.inspectRecovery(file,L),inspectMs=now()-mark;
                    mark=now();recovered=await db.incremental.resumePending(token,packet);
                    recovery={bytes:file.size,exportMs,inspectMs,rebuildMs:now()-mark};if(recovered.id!==op.id)throw Error('Recovery changed identity');
                }
                const saved=await db.incremental.commitEventShift(recovered);
                if(saved.status!=='confirmed'||saved.receipt.rootHash!==complete.rootHash||saved.receipt.newImages!==0||op.changedRows!==1)throw Error('Full/incremental mismatch');
                token=saved.token;mark=now();await db.incremental.readEventShift(token,payload,contextFor(id));const readMs=now()-mark;
                operations.push({id,date,deltaMinutes,catalogReadMs,reservationMs,fullPrepareMs,fullCommitMs,prepareMs,...metrics,transactionMs:saved.transactionMs,lineagePrepareMs:saved.lineagePrepareMs,lineageAfterMs:saved.lineageAfterMs,confirmationMs:saved.confirmationMs,writeMs:saved.writeMs,readMs,changedRows:op.changedRows,newImages:0,photoBytesHydrated:0,recovery});
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
            const imported = await H.storageArchive.importArchive(archive, L), importMs = now() - mark, target = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-shift-restored', readSources: () => ({ main: null, alias: null }) });
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
        result.metadataMemory = await memoryPage.evaluate(async () => { const heap = () => { globalThis.gc?.(); return performance.memory?.usedJSHeapSize ?? null; }, before = heap(), H = FullhouseHistory; window.memoryDB = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-shift-performance', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); window.memoryToken = (await memoryDB.incremental.openWindow()).token; const after = heap(); memoryDB.close(); return { beforeJSHeapBytes: before, afterJSHeapBytes: after, deltaJSHeapBytes: after - before, requestedGC: typeof globalThis.gc === 'function', scope: 'Retained JS heap of metadata window; not peak, native blobs or total RSS' }; });
        await memoryPage.close();
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ base: '721ce2d', browser: browser.version(), sample: 'Single desktop run; same facts/browser; previous full session rejects corpus, full physical comparator separate. No mobile or memory reduction claim.', result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
