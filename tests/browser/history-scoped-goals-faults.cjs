'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start(), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fullhouse-goals-faults-'));
    let context;
    try {
        context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        let page = context.pages()[0];
        const cdp = await context.newCDPSession(page);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url, quotaSize: 1048576 });
        await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[k] = () => { throw Error('Public storage prohibited'); }; });
        await page.goto(url + '/storage');
        await page.evaluate(async () => { const H = FullhouseHistory; window.opts = { factory: indexedDB, name: 'fullhouse-lab-goals-real-quota', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }; window.db = H.createLineageDatabase(opts); window.doc = { version: 2, goals: [{ id: 'g', title: 'Synthetic', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: '', history: [] }], events: [], routines: [], logs: {}, recipeRevisions: {} }; await db.commit(await H.storageModel.prepareDocument(doc, H.schedule.validData), { id: 'seed' }); window.session = H.createGoalsSession(db.incremental); await session.open(); window.ctx = (id, note) => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: [], state: { progressGoalId: 'g', progressValue: '1', progressNote: note } }); });
        const quota = await page.evaluate(async () => { let seed = 17; const chars = []; for (let i = 0; i < 2800000; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
            chars.push(String.fromCharCode(33 + ((seed >>> 8) % 90)));
        } window.note = chars.join(''); const before = session.state().confirmed, state = await session.save('saveProgress', {}, ctx('quota', note)); if (!state.pending || state.confirmed !== before)
            throw Error('Quota replaced confirmed: ' + JSON.stringify({ pending: state.pending, generation: state.confirmed.generation, estimate: await navigator.storage.estimate() })); const read = await db.open(); if (read.head.generation !== 1 || read.authority.tip.generation !== 1)
            throw Error('Quota leaked authority'); return { error: state.pending.error, generation: read.head.generation }; });
        assert.match(quota.error, /QuotaExceeded/);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url });
        const retry = await page.evaluate(async () => { const state = await session.retry(); if (state.pending)
            throw Error(state.pending.error); const read = await db.open(); if (read.plan.tables.goals[0].value.history.length !== 1 || read.plan.tables.goals[0].value.history[0].note !== note)
            throw Error('Retry lost/duplicated note'); return { generation: read.head.generation, id: read.head.id }; });
        assert.deepEqual(retry, { generation: 2, id: 'quota' });
        const readFailure = await page.evaluate(async () => { const before = session.state().confirmed, state = await session.save('saveProgress', {}, ctx('read-failure', 'Durable but no read acknowledgement'), { fault: tx => { const target = tx.db, original = target.transaction; target.transaction = function (names, mode, ...rest) { if (mode === 'readonly') {
                target.transaction = original;
                throw new DOMException('Injected read denied', 'SecurityError');
            } return original.call(this, names, mode, ...rest); }; } }); if (!state.pending || state.confirmed !== before)
            throw Error('Read failure presented saved'); const retried = await session.retry(); if (retried.pending || retried.confirmed.generation !== before.generation + 1)
            throw Error('Read retry duplicate'); return { pendingKept: true, generation: retried.confirmed.generation }; });
        // Cierre de página durante TX multi-entidad: meta, review, autoridad y recibo juntos.
        const closer = await context.newPage();
        await closer.goto(url + '/storage');
        await closer.evaluate(async () => { const H = FullhouseHistory; window.db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-goals-closed-transaction', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); await db.commit(await H.storageModel.prepareDocument({ version: 2, goals: [], events: [], routines: [], logs: {}, recipeRevisions: {} }, H.schedule.validData), { id: 'seed' }); const op = await db.incremental.preparePlanning((await db.incremental.openWindow()).token, 'saveGoal', { id: '', title: 'Goal with review', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: '', review: { date: '2030-01-07', time: '18:00', repeat: 'weekly' } }, { operationId: 'close', today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: ['new'] }); window.inflight = db.incremental.commitPlanning(op, { fault: tx => { window.held = true; const hold = () => { const r = tx.objectStore('control').get('head'); r.onsuccess = hold; }; hold(); } }).catch(() => null); });
        await closer.waitForFunction(() => window.held);
        await closer.close();
        const reopened = await page.evaluate(async () => { const H = FullhouseHistory, closed = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-goals-closed-transaction' }), s = await closed.open(); await closed.auditLineage(); if (s.status !== 'ready' || s.head.generation !== s.authority.tip.generation || s.plan.tables.goals.length !== s.plan.tables.events.length)
            throw Error('Torn planning transaction'); const result = { generation: s.head.generation, goals: s.plan.tables.goals.length, events: s.plan.tables.events.length }; closed.close(); return result; });
        assert.ok([1, 2].includes(reopened.generation));
        assert.equal(reopened.goals, reopened.generation - 1);
        console.log(JSON.stringify({ base: 'cc1d901', browser: context.browser()?.version() || 'persistent Chromium', quota, retry, readFailure, reopened }, null, 2));
    }
    finally {
        if (context)
            await context.close();
        await new Promise(r => server.close(r));
        fs.rmSync(profile, { recursive: true, force: true });
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
