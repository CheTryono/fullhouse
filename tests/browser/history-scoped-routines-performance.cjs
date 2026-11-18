'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
        const context = await browser.newContext(), page = await context.newPage();
        await context.addInitScript(() => {
            for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[k] = () => { throw Error('No public storage'); };
        });
        await page.goto(url + '/storage');
        const result = await page.evaluate(async (alternativeSafety) => {
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
            const engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter }), opts = { factory: indexedDB, legacy: L, schedule: H.schedule, plannerActions: H.plannerActions }, db = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-perf-new', readSources: () => ({ main: null, alias: null }) }), old = H.createLabDatabase({ ...opts, name: 'fullhouse-lab-routines-perf-full' }), plan = await H.storageModel.prepareDocument(doc, L);
            await db.commit(plan, { id: 'seed' });
            await old.commit(plan, { id: 'seed' });
            const oldSession = H.createCompatSession({ database: old, compat, legacy: L, plannerActions: H.plannerActions, engine }), contextFor = id => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T13:00:00Z', ids: [], confirm: true });
            let mark = now();
            await oldSession.open();
            const previousOpenMs = now() - mark;
            mark = now();
            let token = (await db.incremental.openWindow()).token;
            const openMs = now() - mark;
            mark = now();
            let previousSessionError = null;
            try {
                const attempted = await oldSession.plan('saveRoutine', { ...doc.routines[0], title: 'Attempt' }, contextFor('attempt'));
                if (attempted.pending)
                    previousSessionError = attempted.pending.error;
            }
            catch (e) {
                previousSessionError = e.message;
            }
            const previousAttemptMs = now() - mark;
            if (!previousSessionError)
                throw Error('Previous session now succeeds: update comparator');
            let full = doc, oldHead = (await old.open()).head;
            const operations = [], draft = copy(doc.routines[0]), commands = [];
            commands.push(['saveRoutine', { id: '', title: 'New routine', desc: '', steps: [{ id: 'new-step', title: 'New', min: 10 }] }, { ...contextFor('new'), ids: ['new-routine'] }]);
            draft.title = 'Renamed';
            draft.desc = 'New description';
            commands.push(['saveRoutine', copy(draft), contextFor('rename')]);
            draft.steps.push(...Array.from({ length: 3 }, (_, i) => ({ id: 'added-' + i, title: 'Added ' + i, min: 10 })));
            commands.push(['saveRoutine', copy(draft), contextFor('add')]);
            draft.steps.reverse();
            draft.steps[0].children = [{ id: 'nested-a', title: 'A', min: 3 }, { id: 'nested-b', title: 'B', min: 7 }];
            commands.push(['saveRoutine', copy(draft), contextFor('reorder')]);
            draft.steps.splice(2, 1);
            commands.push(['saveRoutine', copy(draft), contextFor('remove')]);
            draft.durationMode = 'fixed';
            draft.durationMin = 200;
            draft.steps[1].flexible = true;
            commands.push(['saveRoutine', copy(draft), contextFor('fixed')]);
            if(alternativeSafety){
                const leaf=draft.steps.find(s=>!s.flexible&&!s.children?.length);
                if(!leaf)throw Error('Missing fixed leaf for alternative benchmark');
                leaf.mode='alternatives';leaf.chooseWhen='execute';
                leaf.variants=[{id:'__base',title:'Real ID',desc:'',min:leaf.min,days:[]}];
                commands.push(['saveRoutine',copy(draft),contextFor('alternative-base-id')]);
            }

            commands.push(['deleteRoutine', { id: 'r' }, contextFor('delete')]);
            for (const [method, payload, c] of commands) {
                const ref = H.plannerActions({ ...full, logs: {} }, c);
                if (method === 'saveRoutine') {
                    ref.controller.state.routineDraft = payload;
                    await ref.controller.saveRoutine();
                }
                else
                    await ref.controller.deleteRoutine(full.routines.find(r => r.id === payload.id));
                const candidate = ref.result().candidate;
                if (!candidate)
                    throw Error('Reference rejected');
                for (const e of candidate.events)
                    if (e.recipeRevisionId && e.routineId !== full.recipeRevisions[e.recipeRevisionId]?.sourceRoutineId)
                        delete e.recipeRevisionId;
                const next = { ...full, routines: candidate.routines, events: candidate.events };
                mark = now();
                const complete = await H.storageModel.prepareDocument(next, L), fullPrepareMs = now() - mark;
                mark = now();
                const slow = await old.commit(complete, { id: c.operationId, expected: oldHead }), fullCommitMs = now() - mark;
                oldHead = slow.head;
                full = next;
                mark = now();
                const op = await db.incremental.prepareRoutine(token, method, payload, c), prepareMs = now() - mark, metrics = db.incremental.routineMetrics(op), saved = await db.incremental.commitRoutine(op);
                token = saved.token;
                mark = now();
                const view = await db.incremental.readRoutine(token, payload.id || c.ids[0]);
                const readMs = now() - mark;
                if (saved.status !== 'confirmed' || saved.receipt.rootHash !== complete.rootHash || saved.receipt.newImages !== 0)
                    throw Error('Root mismatch');
                if ((payload.id === 'r') && view.captureCount !== 5000)
                    throw Error('Historical index lost');
                operations.push({ method, id: c.operationId, fullPrepareMs, fullCommitMs, prepareMs, ...metrics, transactionMs: saved.transactionMs, lineagePrepareMs: saved.lineagePrepareMs, lineageAfterMs: saved.lineageAfterMs, confirmationMs: saved.confirmationMs, readMs, changedRows: op.changedRows,photoBytesHydrated:view.photoBytesHydrated,newImages:saved.receipt.newImages });
            }
            const state = await db.open(), hashes = Object.fromEntries(['executions', 'revisions', 'evidence'].map(t => [t, new Map(plan.tables[t].map(r => [r.key, r.hash]))]));
            for (const t of Object.keys(hashes))
                if (state.plan.tables[t].length !== plan.tables[t].length || state.plan.tables[t].some(r => hashes[t].get(r.key) !== r.hash))
                    throw Error('Historical hashes changed');
            await db.auditLineage();
            mark = now();
            const file = await H.storageArchive.exportArchive(state.plan, L), exportMs = now() - mark;
            mark = now();
            const imported = await H.storageArchive.importArchive(file, L), importMs = now() - mark, target = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-perf-restored', readSources: () => ({ main: null, alias: null }) });
            mark = now();
            await target.commit(imported, { id: 'restore', confirmRestore: true });
            const restoreMs = now() - mark, restored = await target.open();
            if (restored.head.rootHash !== state.head.rootHash)
                throw Error('Restore root mismatch');
            const left = await db.readEvidence('execution:execution-0', 'photo'), right = await target.readEvidence('execution:execution-0', 'photo');
            if (await H.storageModel.bytesHash(left.blob) !== await H.storageModel.bytesHash(right.blob))
                throw Error('Photo bytes changed');
            const heap = heapSample();
            db.close();
            old.close();
            target.close();
            return { executions: 5000, revisions: 501, photoBytes: plan.images.reduce((n, i) => n + i.size, 0), images: plan.images.length, previousOpenMs, openMs, previousSessionError, previousAttemptMs, operations, exportMs, importMs, restoreMs, heap, allHistoricalHashesEqual: true, photoHashesEqual: true };
        },process.env.FULLHOUSE_ROUTINES_ALTERNATIVE_SAFETY==='1');
        assert.ok(result.photoBytes > 42000000);
        console.log(JSON.stringify({ base: process.env.FULLHOUSE_ROUTINES_ALTERNATIVE_SAFETY==='1'?'beff908':'0e9e25c', browser: browser.version(), comparison: 'previous session rejected; full validation comparator separate; same facts/bytes; single desktop sample', result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
