'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start(), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fullhouse-routines-faults-'));
    let context;
    try {
        context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        let page = context.pages()[0];
        const cdp = await context.newCDPSession(page);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url, quotaSize: 1048576 });
        await context.addInitScript(() => {
            for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[k] = () => { throw Error('Public storage prohibited'); };
        });
        await page.goto(url + '/storage');
        await page.evaluate(async () => { const H = FullhouseHistory; window.opts = { factory: indexedDB, name: 'fullhouse-lab-routines-real-quota', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }; window.db = H.createLineageDatabase(opts); window.doc = { version: 2, goals: [], events: [{ id: 'e', title: 'E', date: '2030-01-07', time: '09:00', minutes: 30, goalId: '', routineId: 'r', repeat: 'daily', note: '', overrides: {} }], routines: [{ id: 'r', title: 'Synthetic', desc: '', steps: [{ id: 'a', title: 'A', min: 30 }] }], logs: {}, recipeRevisions: {} }; await db.commit(await H.storageModel.prepareDocument(doc, H.schedule.validData), { id: 'seed' }); window.session = H.createRoutinesSession(db.incremental); await session.open(); window.ctx = id => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: [] }); window.payload = desc => ({ ...doc.routines[0], desc }); });
        const quota = await page.evaluate(async () => {
            let seed = 17;
            const chars = [];
            for (let i = 0; i < 2800000; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                chars.push(String.fromCharCode(33 + ((seed >>> 8) % 90)));
            }
            window.note = chars.join('');
            const before = session.state().confirmed, state = await session.save('saveRoutine', payload(note), ctx('quota'));
            if (!state.pending || state.confirmed !== before)
                throw Error('Quota replaced confirmed: ' + JSON.stringify({ pending: state.pending, generation: state.confirmed.generation, estimate: await navigator.storage.estimate() }));
            const read = await db.open();
            if (read.head.generation !== 1 || read.authority.tip.generation !== 1)
                throw Error('Quota leaked authority');
            return { error: state.pending.error, generation: read.head.generation };
        });
        assert.match(quota.error, /QuotaExceeded/);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url });
        const retry = await page.evaluate(async () => {
            const state = await session.retry();
            if (state.pending)
                throw Error(state.pending.error);
            const read = await db.open();
            if (read.plan.tables.routines.length !== 1 || read.plan.tables.routines[0].value.desc !== note)
                throw Error('Retry lost/duplicated note');
            return { generation: read.head.generation, id: read.head.id };
        });
        assert.deepEqual(retry, { generation: 2, id: 'quota' });
        const readFailure = await page.evaluate(async () => {
            const before = session.state().confirmed, state = await session.save('saveRoutine', payload('Durable but no read acknowledgement'), ctx('read-failure'), { fault: tx => {
                    const target = tx.db, original = target.transaction;
                    target.transaction = function (names, mode, ...rest) {
                        if (mode === 'readonly') {
                            target.transaction = original;
                            throw new DOMException('Injected read denied', 'SecurityError');
                        }
                        return original.call(this, names, mode, ...rest);
                    };
                } });
            if (!state.pending || state.confirmed !== before)
                throw Error('Read failure presented saved');
            const retried = await session.retry();
            if (retried.pending || retried.confirmed.generation !== before.generation + 1)
                throw Error('Read retry duplicate');
            return { pendingKept: true, generation: retried.confirmed.generation };
        });
        // Cierre de página durante TX multi-entidad: meta, review, autoridad y recibo juntos.
        const closer = await context.newPage();
        await closer.goto(url + '/storage');
        await closer.evaluate(async () => { const H = FullhouseHistory; window.db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-routines-closed-transaction', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); const r = { id: 'r', title: 'R', desc: '', steps: [{ id: 'a', title: 'A', min: 30 }] }, event = id => ({ id, title: id, date: '2030-01-07', time: id === 'one' ? '09:00' : '12:00', minutes: 30, goalId: '', routineId: 'r', repeat: 'daily', note: '', overrides: {} }); await db.commit(await H.storageModel.prepareDocument({ version: 2, goals: [], routines: [r], events: [event('one'), event('two')], logs: {}, recipeRevisions: {} }, H.schedule.validData), { id: 'seed' }); const op = await db.incremental.prepareRoutine((await db.incremental.openWindow()).token, 'saveRoutine', { ...r, steps: [{ id: 'a', title: 'A', min: 60 }] }, { operationId: 'close', today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: [] }); window.inflight = db.incremental.commitRoutine(op, { fault: tx => { window.held = true; const hold = () => { const r = tx.objectStore('control').get('head'); r.onsuccess = hold; }; hold(); } }).catch(() => null); });
        await closer.waitForFunction(() => window.held);
        await closer.close();
        const reopened = await page.evaluate(async () => {
            const H = FullhouseHistory, closed = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-closed-transaction' }), s = await closed.open();
            await closed.auditLineage();
            const duration = s.plan.tables.routines[0].value.steps[0].min;
            if (s.status !== 'ready' || s.head.generation !== s.authority.tip.generation || s.plan.tables.events.some(e => e.value.minutes !== duration))
                throw Error('Torn routine transaction');
            closed.close();
            return { generation: s.head.generation, duration, events: s.plan.tables.events.length };
        });
        assert.ok([1, 2].includes(reopened.generation));
        assert.equal(reopened.events, 2);
        assert.equal(reopened.duration, reopened.generation === 1 ? 30 : 60);
        const source = await page.evaluate(async () => {
            const H = FullhouseHistory, raw = JSON.stringify({ ...doc, version: 1, recipeRevisions: undefined }), original = { main: raw, alias: null };
            let copies = { ...original };
            const sourceDB = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-source', readSources: () => copies });
            await sourceDB.stageMigration(await H.storageSources.proposeMigration(copies, 'main', H.schedule.validData), { id: 'migration' });
            await sourceDB.finalizeMigration('migration', { confirm: true });
            const op = await sourceDB.incremental.prepareRoutine((await sourceDB.incremental.openWindow()).token, 'saveRoutine', payload('New'), ctx('source'));
            copies.main = raw + ' ';
            let denied = false;
            try {
                await sourceDB.incremental.commitRoutine(op);
            }
            catch {
                denied = true;
            }
            copies = original;
            sourceDB.close();
            const state = await sourceDB.open();
            sourceDB.close();
            return { denied, status: state.status };
        });
        assert.deepEqual(source, { denied: true, status: 'recovery' });
        const actor = await context.newPage();
        await actor.goto(url + '/storage');
        await page.evaluate(async () => { window.first = await db.incremental.prepareRoutine((await db.incremental.openWindow()).token, 'saveRoutine', { ...payload('First'), title: 'One' }, ctx('first-tab')); });
        await actor.evaluate(async () => { const H = FullhouseHistory; window.other = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-routines-real-quota', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); const state = await other.open(); window.op = await other.incremental.prepareRoutine((await other.incremental.openWindow()).token, 'saveRoutine', { ...state.plan.tables.routines[0].value, title: 'Two' }, { operationId: 'second-tab', today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: [] }); });
        await page.evaluate(() => db.incremental.commitRoutine(first));
        const tabs = await actor.evaluate(async () => {
            let denied = false;
            try {
                await other.incremental.commitRoutine(op);
            }
            catch {
                denied = true;
            }
            const state = await other.open();
            other.close();
            return { denied, title: state.plan.tables.routines[0].value.title };
        });
        assert.deepEqual(tabs, { denied: true, title: 'One' });
        await actor.close();
        const dependencies = await page.evaluate(async () => {
            const H = FullhouseHistory, L = H.schedule.validData, r = (id, min, flexible = false) => ({ id, title: id, desc: '', steps: [{ id: id + '-step', title: 'Step', min, flexible }] }), e = (id, routineId, time, extra = {}) => ({ id, title: id, date: '2029-01-01', time, minutes: 30, goalId: '', routineId, repeat: 'daily', note: '', overrides: {}, ...extra });
            let d = { version: 2, goals: [], routines: [r('a', 30), r('b', 5, true), r('c', 30), r('d', 30), r('nested', 60)], events: [e('a-event', 'a', '09:00'), e('c-event', 'c', '11:30', { anchor: 'end', endTime: '12:00' }), e('d-event', 'd', '12:30'), e('b-event', 'b', '09:30', { anchor: 'between', afterRoutineId: 'a', beforeRoutineId: 'c' }), e('nested-event', 'nested', '11:30', { anchor: 'between', afterRoutineId: 'b', beforeRoutineId: 'd' })], logs: {}, recipeRevisions: {} };
            for(const event of d.events)if(['b-event','nested-event'].includes(event.id))event.date='2030-01-07';
            d = H.createAdapter(H.schedule).prepare(H.createEngine(L), d, { executionId: 'old-a', at: '2029-12-01T12:00:00Z', context: { eventId: 'a-event', date: '2029-12-01', seriesId: 'old-a-series', revisionId: 'old-a-revision' }, action: { type: 'note', text: 'Original' } }).after;
            const dep = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-dependencies' }), initial = await H.storageModel.prepareDocument(d, L);
            await dep.commit(initial, { id: 'seed' });
            let token = (await dep.incremental.openWindow()).token, denied = false;
            try {
                await dep.incremental.prepareRoutine(token, 'saveRoutine', { ...d.routines[2], steps: [{ id: 'c-step', title: 'Step', min: 60 }] }, ctx('chain-bad'));
            }
            catch {
                denied = true;
            }
            if (!denied || (await dep.open()).head.generation !== 1)
                throw Error('Invalid nested dependency persisted');
            const edit = await dep.incremental.prepareRoutine(token, 'saveRoutine', { ...d.routines[0], steps: [{ id: 'a-step', title: 'Step', min: 45 }] }, ctx('chain-valid'));
            token = (await dep.incremental.commitRoutine(edit)).token;
            const del = await dep.incremental.prepareRoutine(token, 'deleteRoutine', { id: 'a' }, { ...ctx('chain-delete'), confirm: true });
            await dep.incremental.commitRoutine(del);
            const final = await dep.open();
            for (const id of ['b-event', 'nested-event'])
                if (final.plan.tables.events.some(r => r.key === id))
                    throw Error('Cancellation not transitive');
            if (final.plan.tables.executions[0].hash !== initial.tables.executions[0].hash || final.plan.tables.revisions[0].hash !== initial.tables.revisions[0].hash)
                throw Error('Cancelled chain changed historical facts');
            await dep.auditLineage();
            dep.close();
            const corrupt = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-routines-corruption' });
            await corrupt.commit(await H.storageModel.prepareDocument(doc, L), { id: 'seed' });
            token = (await corrupt.incremental.openWindow()).token;
            const raw = await new Promise((res, rej) => { const request = indexedDB.open('fullhouse-lab-routines-corruption', 2); request.onsuccess = () => res(request.result); request.onerror = () => rej(request.error); });
            await new Promise((res, rej) => { const tx = raw.transaction('events', 'readwrite'), request = tx.objectStore('events').get('e'); request.onsuccess = () => tx.objectStore('events').put({ ...request.result, value: { ...request.result.value, minutes: 999 } }); tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
            raw.close();
            let blocked = false;
            try {
                await corrupt.incremental.prepareRoutine(token, 'saveRoutine', payload('Corruption'), ctx('corrupt'));
            }
            catch {
                blocked = true;
            }
            if (!blocked || (await corrupt.open()).status !== 'recovery')
                throw Error('Corrupt relation accepted');
            corrupt.close();
            return { nestedRejected: denied, transitiveCancellation: true, historicalHashesEqual: true, corruptionBlocked: blocked };
        });
        console.log(JSON.stringify({ base: '0e9e25c', browser: context.browser()?.version() || 'persistent Chromium', quota, retry, readFailure, reopened, source, tabs, dependencies }, null, 2));
    }
    finally {
        if (context)
            await context.close();
        await new Promise(r => server.close(r));
        fs.rmSync(profile, { recursive: true, force: true });
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
