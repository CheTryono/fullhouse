'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
        const context=await browser.newContext(),page = await context.newPage();
        await context.addInitScript(() => { for (const m of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[m] = () => { throw Error('Public storage forbidden'); }; });
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
            const engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter }), opts = { factory: indexedDB, legacy: L, schedule: H.schedule, plannerActions: H.plannerActions }, db = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-goals-perf-after', readSources: () => ({ main: null, alias: null }) }), old = H.createLabDatabase({ ...opts, name: 'fullhouse-lab-goals-perf-before' }), plan = await H.storageModel.prepareDocument(doc, L);
            await db.commit(plan, { id: 'seed' });
            await old.commit(plan, { id: 'seed' });
            const oldSession = H.createCompatSession({ database: old, compat, legacy: L, plannerActions: H.plannerActions, engine });
            let mark = now();
            await oldSession.open();
            const beforeOpenMs = now() - mark;
            mark = now();
            let token = (await db.incremental.openWindow()).token;
            const afterOpenMs = now() - mark, contextFor = (id, state = {}, ids = []) => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T13:00:00Z', ids, state }), draft = (id = '', extra = {}) => ({ id, title: 'Synthetic goal', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: 'units', mode: 'numeric', milestones: [], ...extra }), first = contextFor('create', {}, ['parent']);
            mark = now();
            let previousSessionError = null;
            try {
                const state = await oldSession.plan('saveGoal', draft(), first);
                if (state.pending)
                    previousSessionError = state.pending.error;
            }
            catch (e) {
                previousSessionError = e.message;
            }
            const previousAttemptMs = now() - mark;
            if (!previousSessionError)
                throw Error('Update benchmark: previous session now succeeds');
            // Comparator completo verificable: métodos reales sobre planificación y pipeline
            // físico completo; no se presenta como una sesión anterior que haya pasado.
            let full = doc, oldHead = (await old.open()).head;
            const operations = [];
            const commands = [['saveGoal', draft(), first], ['saveGoal', draft('', { parentId: 'parent', review: { date: '2030-01-07', time: '23:30', repeat: 'weekly' } }), contextFor('child', {}, ['child'])], ['saveProgress', {}, contextFor('numeric', { progressGoalId: 'parent', progressValue: '2,5', progressNote: 'Numeric' })], ['saveGoal', draft('parent', { mode: 'qualitative', status: 'working' }), contextFor('quality-goal')], ['saveProgress', {}, contextFor('quality', { progressGoalId: 'parent', progressValue: '', progressStatus: 'improving', progressNote: 'Quality' })], ['saveGoal', draft('parent', { mode: 'milestones', milestones: [{ id: 'm', title: 'Milestone', done: false }] }), contextFor('milestone-goal')], ['toggleMilestone', { goalId: 'parent', milestoneId: 'm' }, contextFor('mark')], ['toggleMilestone', { goalId: 'parent', milestoneId: 'm' }, contextFor('unmark')], ['saveDayReview', {}, contextFor('review', { reviewDraft: 'Today', selectedDate: '2040-01-01' })], ['saveGoal', draft('child', { parentId: 'parent' }), contextFor('remove-review')], ['saveGoal', draft('goal', { title: 'Changed after completion' }), contextFor('rename')]];
            for (const [method, payload, context] of commands) {
                const ref = H.plannerActions({ ...full, logs: {}, recipeRevisions: {} }, context);
                if (method === 'saveGoal')
                    ref.controller.state.goalDraft = payload;
                if (method === 'toggleMilestone')
                    ref.controller.toggleMilestone(payload.goalId, payload.milestoneId);
                else
                    ref.controller[method]();
                const candidate = ref.result().candidate;
                if (!candidate)
                    throw Error('Reference rejected');
                const next = { ...full, goals: candidate.goals, events: candidate.events, ...(candidate.dayReviews ? { dayReviews: candidate.dayReviews } : {}) };
                mark = now();
                const complete = await H.storageModel.prepareDocument(next, L), fullPrepareMs = now() - mark;
                mark = now();
                const slow = await old.commit(complete, { id: context.operationId, expected: oldHead }), fullCommitMs = now() - mark;
                oldHead = slow.head;
                full = next;
                mark = now();
                const op = await db.incremental.preparePlanning(token, method, payload, context), prepareMs = now() - mark, saved = await db.incremental.commitPlanning(op);
                token = saved.token;
                mark = now();
                if (method === 'saveDayReview')
                    await db.incremental.readDayReview(token, context.today);
                else
                    await db.incremental.readGoal(token, method === 'saveGoal' ? (payload.id || context.ids[0]) : method === 'toggleMilestone' ? payload.goalId : context.state.progressGoalId);
                const readMs = now() - mark;
                if (saved.status !== 'confirmed' || saved.receipt.rootHash !== complete.rootHash || saved.receipt.newImages !== 0)
                    throw Error('Facts mismatch');
                operations.push({ method, fullPrepareMs, fullCommitMs, prepareMs, transactionMs: saved.transactionMs, lineagePrepareMs: saved.lineagePrepareMs, confirmationMs: saved.confirmationMs, lineageAfterMs: saved.lineageAfterMs, readMs, changedRows: op.changedRows });
            }
            const repeated = [];
            for (let i = 0; i < 50; i++) {
                const request = contextFor('repeated-' + i, { reviewDraft: 'Repeated ' + i });
                mark = now();
                const op = await db.incremental.preparePlanning(token, 'saveDayReview', {}, request), prepareMs = now() - mark, saved = await db.incremental.commitPlanning(op);
                token = saved.token;
                if ([0, 24, 49].includes(i))
                    repeated.push({ count: i + 1, prepareMs, transactionMs: saved.transactionMs, confirmationMs: saved.confirmationMs, lineagePrepareMs: saved.lineagePrepareMs });
            }
            mark = now();
            const state = await db.open(), fullVerificationMs = now() - mark;
            await db.auditLineage();
            const initialHashes = Object.fromEntries(['executions', 'revisions'].map(t => [t, new Map(plan.tables[t].map(r => [r.key, r.hash]))]));
            if (['executions', 'revisions'].some(t => state.plan.tables[t].length !== plan.tables[t].length || state.plan.tables[t].some(r => r.hash !== initialHashes[t].get(r.key))))
                throw Error('Historical hash changed');
            mark = now();
            const archive = await H.storageArchive.exportArchive(state.plan, L), exportMs = now() - mark;
            mark = now();
            const imported = await H.storageArchive.importArchive(archive, L), importMs = now() - mark, target = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-goals-perf-restored', readSources: () => ({ main: null, alias: null }) });
            mark = now();
            await target.commit(imported, { id: 'restore', confirmRestore: true });
            const restoreMs = now() - mark, restored = await target.open();
            if (restored.head.rootHash !== state.head.rootHash)
                throw Error('Restore root mismatch');
            const a = await db.incremental.readPhoto(token, 'execution:execution-0', 'photo'), b = await target.readEvidence('execution:execution-0', 'photo');
            if (await H.storageModel.bytesHash(a.blob) !== await H.storageModel.bytesHash(b.blob))
                throw Error('Photo bytes mismatch');
            await old.commit(state.plan, { id: 'same-root-memory', expected: oldHead });
            const heap = heapSample();
            db.close();
            old.close();
            target.close();
            return { executions: 5000, revisions: 501, images: plan.images.length, photoBytes: plan.images.reduce((n, i) => n + i.size, 0), beforeOpenMs, afterOpenMs, previousSessionError, previousAttemptMs, operations, repeated, fullVerificationMs, exportMs, importMs, restoreMs, archiveBytes: archive.size, heap, allHistoricalHashesEqual: true, photoHashesEqual: true };
        });
        assert.ok(result.photoBytes > 42000000);
        await page.close();result.retainedHeap = [];
        for (const mode of ['previous-session', 'scoped-window']) {
            const isolated = await context.newPage();
            await isolated.goto(url + '/storage');
            const sample = await isolated.evaluate(async (mode) => { const H = FullhouseHistory, L = H.schedule.validData, opts = { factory: indexedDB, legacy: L, schedule: H.schedule, plannerActions: H.plannerActions }; if (mode === 'previous-session') {
                const db = H.createLabDatabase({ ...opts, name: 'fullhouse-lab-goals-perf-before' }), engine = H.createEngine(L), adapter = H.createAdapter(H.schedule);
                window.retainedDatabase = db;
                window.retained = H.createCompatSession({ database: db, compat: H.createLegacyCompat({ legacy: L, engine, adapter }), legacy: L, plannerActions: H.plannerActions, engine });
                await retained.open();
                window.retainedRoot = (await db.open()).head.rootHash;
            }
            else {
                const db = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-goals-perf-after', readSources: () => ({ main: null, alias: null }) });
                window.retainedDatabase = db;
                window.retained = (await db.incremental.openWindow()).token;
                window.retainedRoot = retained.rootHash;
            } return { gcAvailable: typeof gc === 'function' }; }, mode);
            await isolated.evaluate(() => { if (typeof gc === 'function')
                gc(); });
            await isolated.waitForTimeout(50);
            const measured = await isolated.evaluate(() => ({ root: retainedRoot, used: performance.memory?.usedJSHeapSize }));
            result.retainedHeap.push({ mode, ...sample, ...measured });
            await isolated.close();
        }
        assert.equal(result.retainedHeap[0].root, result.retainedHeap[1].root);
        console.log(JSON.stringify({ base: 'cc1d901', browser: browser.version(), comparison: 'same facts; previous session attempted and rejected; full-validation comparator reported separately; one sample; desktop only', result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
