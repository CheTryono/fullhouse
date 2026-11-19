'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    const results = [];
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const width of [1280, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'UTC' }), page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[k] = () => { throw Error('Public storage forbidden'); }; });
            await page.goto(url + '/storage');
            const result = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, copy = x => JSON.parse(JSON.stringify(x)), doc = copy(H.scenarios(H).list.find(s => s.id === 'partial').doc), db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-events-create', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) });
                const plan = await H.storageModel.prepareDocument(doc, L);
                await db.commit(plan, { id: 'seed' });
                const session = H.createEventsSession(db.incremental);
                await session.open();
                const payload = { id: '', title: ' New activity ', date: '2030-01-08', time: '09:00', minutes: 30, goalId: 'goal', routineId: '', repeat: 'none', note: 'Synthetic', overrides: {} }, ctx = id => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T12:00:00Z' });
                const before = session.state().confirmed, first = await db.incremental.reserveEvent(before, 'create'), again = await db.incremental.reserveEvent(before, 'create');
                if (first.eventId !== again.eventId || first.seriesId !== again.seriesId)
                    throw Error('Unstable IDs');
                session.setDraft('event', payload);
                let state = await session.save('createEvent', payload, ctx('create'), { fault: 'after-records' });
                if (!state.pending || state.confirmed !== before)
                    throw Error('Abort changed confirmed');
                const unchanged = await db.open();
                if (unchanged.head.generation !== 1 || unchanged.plan.tables.events.length !== plan.tables.events.length)
                    throw Error('Partial create');
                const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L), recovered = H.createEventsSession(db.incremental);
                await recovered.open();
                await recovered.resume(packet);
                state = await recovered.retry({ fault: 'lost-ack' });
                if (!state.pending)
                    throw Error('Lost acknowledgement presented saved');
                state = await recovered.retry();
                if (state.pending || state.confirmed.generation !== 2)
                    throw Error('Retry duplicated create');
                const saved = await db.open(), created = saved.plan.tables.events.find(r => r.key === first.eventId);
                if (!created || created.value.seriesId !== first.seriesId || saved.head.header.eventIds.at(-1) !== first.eventId)
                    throw Error('Identity/order changed');
                for (const t of ['executions', 'revisions', 'evidence'])
                    if (JSON.stringify(saved.plan.tables[t]) !== JSON.stringify(plan.tables[t]))
                        throw Error('History changed: ' + t);
                const read = await db.incremental.readEvent(state.confirmed, first.eventId);
                if (read.photoBytesHydrated !== 0 || read.event.title !== 'New activity')
                    throw Error('Read changed semantics');
                await db.auditLineage();
                db.close();
                return { eventId: first.eventId, seriesId: first.seriesId, generation: saved.head.generation, stableRetry: true, recovery: true, historyUnchanged: true, appendOrder: true, photoBytesHydrated: read.photoBytesHydrated };
            });
            assert.deepEqual(errors, []);
            results.push({ width, ...result, noJavaScriptErrors: true });
            await context.close();
        }
        console.log(JSON.stringify({ base: '13ee9d1', browser: browser.version(), results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
