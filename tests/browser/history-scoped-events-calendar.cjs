'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    const results = [];
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const timezoneId of ['UTC', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'Pacific/Apia']) {
            const context = await browser.newContext({ timezoneId, viewport: { width: 390, height: 900 } }), page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[k] = () => { throw Error('Public storage forbidden'); }; });
            await page.goto(url + '/storage');
            const result = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, copy = x => JSON.parse(JSON.stringify(x)), require = (v, m) => { if (!v)
                    throw Error(m); }, doc = copy(H.scenarios(H).list.find(s => s.id === 'partial').doc), from = '2011-12-29', routine = (id, min) => ({ id, title: id, desc: '', steps: [{ id: 's', title: 'Step', min }] }), event = (id, routineId, time) => ({ id, title: id, date: '2011-01-01', time, minutes: 60, routineId, goalId: '', repeat: 'daily', note: '', overrides: {} });
                doc.routines.push(routine('a', 60), routine('c', 60), routine('new', 10));
                doc.events.push(event('__fh_preview__', 'a', '08:00'), event('c', 'c', '09:10'));
                const db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-events-calendar', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }), plan = await H.storageModel.prepareDocument(doc, L);
                await db.commit(plan, { id: 'seed' });
                const session = H.createEventsSession(db.incremental);
                await session.open();
                const ctx = id => ({ operationId: id, today: from, at: from + 'T12:00:00Z' }), payload = { id: '', title: 'Between', date: from, time: '09:00', minutes: 10, goalId: 'goal', routineId: 'new', repeat: 'daily', anchor: 'between', afterRoutineId: 'a', beforeRoutineId: 'c', overrides: {}, note: '' };
                const reference = H.plannerActions(doc, { ...ctx('reference'), ids: ['new-id'], confirm: true });
                reference.controller.state.eventDraft = copy(payload);
                require(reference.controller.schedulePreview(payload)[0].skipped, 'Sentinel collision not reproduced');
                const reservation = await db.incremental.reserveEvent(session.state().confirmed, 'between'), op = await db.incremental.prepareEvent(session.state().confirmed, reservation, payload, ctx('between')), metrics = db.incremental.eventMetrics(op), saved = await db.incremental.commitEvent(op);
                require(saved.status === 'confirmed' && saved.receipt.newImages === 0, 'Create not confirmed');
                await session.open();
                const finite = [];
                for (const repeat of ['monthly', 'yearly', 'every']) {
                    const state = await session.save('createEvent', { id: '', title: repeat, date: from, time: '12:00', minutes: 20, routineId: '', goalId: '', repeat, everyDays: 2, endDate: '2012-02-01', overrides: {}, note: '' }, ctx('finite-' + repeat));
                    require(!state.pending, 'Finite failed');
                    finite.push(repeat);
                }
                let blocked = 0;
                for (const repeat of ['monthly', 'yearly', 'every']) {
                    const before = session.state().confirmed;
                    try {
                        await session.save('createEvent', { id: '', title: repeat, date: from, time: '12:00', minutes: 20, routineId: '', goalId: '', repeat, everyDays: 365, overrides: {}, note: '' }, ctx('unbounded-' + repeat));
                        if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'UTC')
                            throw Error('Unbounded local accepted');
                    }
                    catch (e) {
                        if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC')
                            throw e;
                        require(e.status === 'indeterminate', 'Unexpected failure');
                        require(session.state().confirmed === before, 'Rejection changed confirmed');
                        blocked++;
                    }
                }
                const state = await db.open();
                for (const t of ['executions', 'revisions', 'evidence'])
                    require(JSON.stringify(state.plan.tables[t]) === JSON.stringify(plan.tables[t]), 'History changed ' + t);
                const read = await session.readEvent(reservation.eventId);
                require(read.event.seriesId === reservation.seriesId && read.photoBytesHydrated === 0, 'Read lost identity');
                await db.auditLineage();
                db.close();
                return { zone: metrics.proof.certificate.zone || metrics.proof.certificate.environment.zone, proofFormat: metrics.proof.certificate.format, counts: metrics.proof.certificate.counts, finite, blockedIndefinite: blocked, previewCollisionFixed: true, historyUnchanged: true, noCapturesCreated: true };
            });
            assert.deepEqual(errors, []);
            results.push({ timezoneId, ...result, noJavaScriptErrors: true });
            await context.close();
        }
        console.log(JSON.stringify({ base: '13ee9d1', browser: browser.version(), scope: 'Synthetic IndexedDB; responsive Chromium viewport, not a phone', results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
