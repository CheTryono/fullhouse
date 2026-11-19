'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    const results = [];
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const width of [1280, 390]) {
            const context = await browser.newContext({ timezoneId: 'UTC', viewport: { width, height: 900 } }), page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[k] = () => { throw Error('No public storage'); }; });
            await page.goto(url + '/storage');
            const result = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, doc = JSON.parse(JSON.stringify(H.scenarios(H).list.find(s => s.id === 'partial').doc)), db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-events-shift', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }), initial = await H.storageModel.prepareDocument(doc, L);
                await db.commit(initial, { id: 'seed' });
                const access = db.incremental, session = H.createEventsSession(access);
                await session.open();
                const before = session.state().confirmed, ctx = { operationId: 'metadata', today: '2030-01-08', at: '2030-01-08T12:00:00Z' };
                ctx.confirm=true; const p={eventId:'e',seriesId:doc.events[0].seriesId||'series',date:'2030-01-08',deltaMinutes:15}, reserve=await access.reserveEventShift(before,p,ctx),repeat=await access.reserveEventShift(before,p,ctx);
                if (reserve.eventId !== repeat.eventId || reserve.seriesId !== repeat.seriesId)
                    throw Error('Unstable reservation');
                let wrongBrand = false;
                try {
                    await access.prepareEventShift(before, await access.reserveEvent(before, 'other'));
                }
                catch {
                    wrongBrand = true;
                }
                if (!wrongBrand)
                    throw Error('Creation capability accepted for shift');
                session.setDraft('event', p);
                let state = await session.save('shiftEventOccurrence', p, ctx, { fault: 'after-records' });
                if (!state.pending || state.confirmed !== before)
                    throw Error('Abort presented saved');
                let read = await db.open();
                if (read.head.generation !== 1 || read.plan.rootHash !== initial.rootHash)
                    throw Error('Partial edit');
                const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L), recovered = H.createEventsSession(access);
                await recovered.open();
                await recovered.resume(packet);
                state = await recovered.retry({ fault: 'lost-ack' });
                if (!state.pending)
                    throw Error('Lost acknowledgement presented saved');
                state = await recovered.retry();
                if (state.pending || state.confirmed.generation !== 2)
                    throw Error('Retry not idempotent');
                read = await db.open();
                if (read.plan.tables.events.length !== initial.tables.events.length || read.plan.tables.events.find(r => r.key === 'e').value.overrides['2030-01-08'].time !== H.schedule.timeString(H.schedule.minutes(H.schedule.eventTime(doc.events[0],p.date,doc))+15))
                    throw Error('Shift created segment');
                for (const table of ['executions', 'revisions', 'evidence'])
                    if (JSON.stringify(read.plan.tables[table]) !== JSON.stringify(initial.tables[table]))
                        throw Error('Historical hashes changed');
                const scope = await access.readEventShift(state.confirmed,p,ctx);
                if (scope.recorded || scope.photoBytesHydrated !== 0)
                    throw Error('Read scope changed');
                await db.auditLineage();
                db.close();
                return { generation: read.head.generation, stableRetry: true, wrongBrandRejected: wrongBrand, historyHashesEqual: true, oneOverrideOnly: true, photoBytesHydrated: 0 };
            });
            assert.deepEqual(errors, []);
            results.push({ width, ...result, noJavaScriptErrors: true });
            await context.close();
        }
        console.log(JSON.stringify({ base: '721ce2d', browser: browser.version(), results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
