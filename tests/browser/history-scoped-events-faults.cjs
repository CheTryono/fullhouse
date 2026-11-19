'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let context;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fullhouse-events-faults-'));
    try {
        context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        const page = context.pages()[0], errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await context.addInitScript(() => {
            for (const key of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[key] = () => { throw Error('Public storage forbidden'); };
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url, quotaSize: 3145728 });
        await page.goto(url + '/storage');
        await page.evaluate(async () => {
            const H = FullhouseHistory;
            window.opts = { factory: indexedDB, name: 'fullhouse-lab-events-faults', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) };
            window.doc = JSON.parse(JSON.stringify(H.scenarios(H).list.find(s => s.id === 'partial').doc));
            window.db = H.createLineageDatabase(opts);
            window.plan = await H.storageModel.prepareDocument(doc, H.schedule.validData);
            await db.commit(plan, { id: 'seed' });
            window.session = H.createEventsSession(db.incremental);
            await session.open();
            window.ctx = id => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T12:00:00Z' });
            window.payload = extra => ({ id: '', title: 'Synthetic event', date: '2030-01-08', time: '09:00', minutes: 30, goalId: '', routineId: '', repeat: 'none', note: '', overrides: {}, ...extra });
            window.prepare = async (access, token, id, extra) => access.prepareEvent(token, await access.reserveEvent(token, id), payload(extra), ctx(id));
        });
        const quota = await page.evaluate(async () => {
            const pressure = await new Promise((res, rej) => { const r = indexedDB.open('fullhouse-lab-events-quota-pressure'); r.onupgradeneeded = () => r.result.createObjectStore('pressure'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
            let quotaReached = false;
            for (let n = 0; n < 12 && !quotaReached; n++) {
                const bytes = new Uint8Array(524288);
                for (let i = 0; i < bytes.length; i += 65536)
                    crypto.getRandomValues(bytes.subarray(i, i + 65536));
                try {
                    await new Promise((res, rej) => { const tx = pressure.transaction('pressure', 'readwrite'); tx.objectStore('pressure').put(new Blob([bytes]), n); tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
                }
                catch (e) {
                    if (e.name !== 'QuotaExceededError')
                        throw e;
                    quotaReached = true;
                }
            }
            pressure.close();
            if (!quotaReached)
                throw Error('Real browser quota not enforced by this profile');
            let seed = 17;
            const chars = [];
            for (let i = 0; i < 1400000; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                chars.push(String.fromCharCode(33 + ((seed >>> 8) % 90)));
            }
            window.note = chars.join('');
            const before = session.state().confirmed;
            session.setDraft('event', payload({ note }));
            const state = await session.save('createEvent', payload({ note }), ctx('quota'));
            if (!state.pending || state.confirmed !== before || state.drafts.event.note !== note)
                throw Error('Quota lost pending/draft: ' + JSON.stringify({ pending: state.pending, before: before.generation, after: state.confirmed.generation, draft: state.drafts.event?.note.length }));
            const read = await db.open();
            if (read.head.generation !== 1 || read.authority.tip.generation !== 1 || read.plan.tables.events.length !== plan.tables.events.length)
                throw Error('Partial quota write');
            return { error: state.pending.error, generation: read.head.generation };
        });
        assert.match(quota.error, /QuotaExceeded/);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url });
        const retry = await page.evaluate(async () => {
            const state = await session.retry();
            if (state.pending)
                throw Error(state.pending.error);
            const read = await db.open(), event = read.plan.tables.events.find(r => r.key === read.head.header.eventIds.at(-1)).value;
            if (event.note !== note || read.head.id !== 'quota' || read.head.generation !== 2)
                throw Error('Quota retry changed facts');
            return { generation: read.head.generation, operation: read.head.id, eventId: event.id };
        });
        const readFailure = await page.evaluate(async () => {
            const before = session.state().confirmed;
            const state = await session.save('createEvent', payload(), ctx('read-failure'), { fault: tx => {
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
            const recovered = await session.retry();
            if (recovered.pending || recovered.confirmed.generation !== before.generation + 1)
                throw Error('Read retry duplicate');
            return { pendingKept: true, generation: recovered.confirmed.generation };
        });
        const actor = await context.newPage();
        await actor.goto(url + '/storage');
        await page.evaluate(async () => { window.first = await prepare(db.incremental, session.state().confirmed, 'first-tab', { title: 'First tab' }); });
        await actor.evaluate(async () => {
            const H = FullhouseHistory;
            window.other = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-events-faults', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) });
            window.session = H.createEventsSession(other.incremental);
            await session.open();
            // An aborted transaction preserves a candidate prepared on the same base as tab one.
            const payload = { id: '', title: 'Second tab', date: '2030-01-08', time: '09:00', minutes: 30, goalId: '', routineId: '', repeat: 'none', note: '', overrides: {} };
            session.setDraft('event', payload);
            await session.save('createEvent', payload, { operationId: 'second-tab', today: '2030-01-07', at: '2030-01-07T12:00:00Z' }, { fault: 'before-writes' });
        });
        await page.evaluate(() => db.incremental.commitEvent(first));
        const tabs = await actor.evaluate(async () => {
            const before = session.state().confirmed, state = await session.retry();
            if (!state.pending || state.confirmed !== before || state.drafts.event.title !== 'Second tab')
                throw Error('Stale candidate lost');
            const packet = await FullhouseHistory.recoveryBinary.inspectRecovery(await session.exportPending(), FullhouseHistory.schedule.validData);
            const read = await other.open();
            if (read.plan.tables.events.some(r => r.value.title === 'Second tab') || !read.plan.tables.events.some(r => r.value.title === 'First tab'))
                throw Error('Stale overwrite');
            other.close();
            return { staleBlocked: true, candidateExportable: packet.metadata.id === 'second-tab', generation: read.head.generation };
        });
        await actor.close();
        const asyncDraft = await page.evaluate(async () => {
            await session.open();
            const draft = payload({ title: 'Reserved form' }), command = ctx('async-draft');
            const saving = session.save('createEvent', draft, command);
            draft.title = 'Another activity'; draft.date = '2040-01-01'; command.operationId = 'changed';
            const state = await saving;
            if (state.pending) throw Error(state.pending.error);
            const snapshot = await db.open(), row = snapshot.plan.tables.events.find(r => r.key === snapshot.head.header.eventIds.at(-1)).value;
            if (row.title !== 'Reserved form' || row.date !== '2030-01-08') throw Error('Await reassigned the activity');
            return { reservedFormRetained: true, operationId: 'async-draft' };
        });
        // Page closure during the real IDB transaction. Reopening may observe either whole state.
        const closer = await context.newPage();
        await closer.goto(url + '/storage');
        await closer.evaluate(async () => {
            const H = FullhouseHistory, db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-events-closed', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) });
            await db.commit(await H.storageModel.prepareDocument({ version: 2, goals: [], routines: [], events: [], logs: {}, recipeRevisions: {} }, H.schedule.validData), { id: 'seed' });
            const a = db.incremental, t = (await a.openWindow()).token, r = await a.reserveEvent(t, 'close');
            const op = await a.prepareEvent(t, r, { id: '', title: 'Closed', date: '2030-01-08', time: '09:00', minutes: 30, goalId: '', routineId: '', repeat: 'none', note: '', overrides: {} }, { operationId: 'close', today: '2030-01-07', at: '2030-01-07T12:00:00Z' });
            window.inflight = a.commitEvent(op, { fault: tx => { window.held = true; const hold = () => { const r = tx.objectStore('control').get('head'); r.onsuccess = hold; }; hold(); } }).catch(() => null);
        });
        await closer.waitForFunction(() => window.held);
        await closer.close();
        const reopened = await page.evaluate(async () => {
            const closed = FullhouseHistory.createLineageDatabase({ ...opts, name: 'fullhouse-lab-events-closed' }), state = await closed.open();
            await closed.auditLineage();
            closed.close();
            if (state.status !== 'ready' || state.head.generation !== state.authority.tip.generation || state.plan.tables.events.length !== state.head.generation - 1)
                throw Error('Torn creation');
            return { generation: state.head.generation, eventCount: state.plan.tables.events.length };
        });
        assert.ok([1, 2].includes(reopened.generation));
        const sources = await page.evaluate(async () => {
            const H = FullhouseHistory, raw = JSON.stringify({ ...doc, version: 1, recipeRevisions: undefined, events: doc.events.map(({ recipeRevisionId, ...event }) => event), logs: {} }), original = { main: raw, alias: null }, results = [];
            for (const during of [false, true]) {
                let copies = { ...original };
                const d = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-events-source-' + during, readSources: () => copies });
                await d.stageMigration(await H.storageSources.proposeMigration(copies, 'main', H.schedule.validData), { id: 'migration' });
                await d.finalizeMigration('migration', { confirm: true });
                const t = (await d.incremental.openWindow()).token, op = await prepare(d.incremental, t, 'source');
                if (!during)
                    copies.main = raw + ' ';
                let denied = false;
                try {
                    await d.incremental.commitEvent(op, { fault: during ? () => { copies.main = raw + ' '; } : null });
                }
                catch {
                    denied = true;
                }
                copies = original;
                d.close();
                const state = await d.open();
                if (!denied || state.status !== 'recovery')
                    throw Error('Source divergence not persistent');
                results.push({ duringTransaction: during, blocked: denied, status: state.status, generation: state.head.generation });
                d.close();
            }
            return results;
        });
        const corruption = await page.evaluate(async () => {
            const H = FullhouseHistory, name = 'fullhouse-lab-events-corruption', corrupt = H.createLineageDatabase({ ...opts, name });
            await corrupt.commit(plan, { id: 'seed' }); const t = (await corrupt.incremental.openWindow()).token;
            const raw = await new Promise((res, rej) => { const r = indexedDB.open(name, 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
            await new Promise((res, rej) => { const tx = raw.transaction('goals', 'readwrite'), request = tx.objectStore('goals').get('goal'); request.onsuccess = () => tx.objectStore('goals').put({ ...request.result, value: { ...request.result.value, title: 'Changed outside protocol' } }); tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
            raw.close(); let blocked = false;
            try { await prepare(corrupt.incremental, t, 'corrupt', { goalId: 'goal' }); } catch { blocked = true; }
            const state = await corrupt.open(), persisted = (await corrupt.sourceRecovery()).state; corrupt.close();
            if (!blocked || state.status !== 'recovery' || persisted.head.generation !== 1 || persisted.commitRecords.length !== 1) throw Error('Corrupt relation authorized creation');
            return { blocked: true, status: state.status, generation: persisted.head.generation };
        });
        // Actual engine timezone override before commit, and observed change after writing.
        await page.evaluate(async () => { await session.open(); window.zoneOp = await prepare(db.incremental, session.state().confirmed, 'zone-before'); });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Mexico_City' });
        const zoneBefore = await page.evaluate(async () => {
            const before = (await db.open()).head.generation;
            let error;
            try {
                await db.incremental.commitEvent(zoneOp);
            }
            catch (e) {
                error = e.message;
            }
            if (!error || (await db.open()).head.generation !== before)
                throw Error('Changed zone persisted');
            return { blocked: true, error };
        });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        // Gate readSources after transaction, allowing CDP to change the real timezone before ack.
        let afterWriteResolve;
        const afterWrite = new Promise(resolve => { afterWriteResolve = resolve; });
        await page.exposeFunction('notifySourceGate', () => afterWriteResolve());
        await page.evaluate(async () => {
            const H = FullhouseHistory;
            window.gateCalls = 0;
            window.gated = false;
            window.zoneDB = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-events-zone-after', readSources: async () => {
                    if (window.gated && ++window.gateCalls === 2) {
                        await window.notifySourceGate();
                        await new Promise(resolve => { window.releaseSourceGate = resolve; });
                    }
                    return { main: null, alias: null };
                } });
            await zoneDB.commit(await H.storageModel.prepareDocument({ version: 2, goals: [], routines: [], events: [], logs: {}, recipeRevisions: {} }, H.schedule.validData), { id: 'seed' });
            const t = (await zoneDB.incremental.openWindow()).token;
            window.zoneAfterOp = await prepare(zoneDB.incremental, t, 'zone-after');
            window.gated = true;
            window.zoneWrite = zoneDB.incremental.commitEvent(zoneAfterOp).then(() => ({ error: null }), e => ({ error: e.message }));
        });
        await Promise.race([afterWrite, new Promise((_, reject) => setTimeout(() => reject(Error('Source gate timeout')), 10000))]);
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Mexico_City' });
        const zoneAfter = await page.evaluate(async () => {
            releaseSourceGate();
            const result = await zoneWrite, inspection = await zoneDB.incremental.inspectOperation(zoneAfterOp);
            if (!/tras escribir/.test(result.error || '') || inspection.status !== 'persisted-receipt')
                throw Error('Changed zone after write incorrectly acknowledged: ' + JSON.stringify({ result, inspection }));
            return { error: result.error, receipt: inspection.status };
        });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        const immutable = await page.evaluate(async () => {
            const final = await db.open();
            for (const table of ['executions', 'revisions', 'evidence'])
                if (JSON.stringify(final.plan.tables[table]) !== JSON.stringify(plan.tables[table]))
                    throw Error('History changed: ' + table);
            await db.auditLineage();
            db.close();
            zoneDB.close();
            return true;
        });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ browser: context.browser()?.version() || 'persistent Chromium', quota, retry, readFailure, tabs, asyncDraft, reopened, sources, corruption, zoneBefore, zoneAfter, historicalHashesEqual: immutable, noJavaScriptErrors: true }, null, 2));
    }
    finally {
        if (context)
            await context.close();
        fs.rmSync(profile, { recursive: true, force: true });
        await new Promise(resolve => server.close(resolve));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
