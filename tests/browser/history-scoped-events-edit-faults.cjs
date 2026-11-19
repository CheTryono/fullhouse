'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start(), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fullhouse-edit-faults-'));
    let context;
    try {
        context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        const page = context.pages()[0], errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await context.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[k] = () => { throw Error('No public storage'); }; });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url, quotaSize: 3145728 });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        await page.goto(url + '/storage');
        await page.evaluate(async () => { const H = FullhouseHistory; window.opts = { factory: indexedDB, name: 'fullhouse-lab-edit-faults', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }; window.doc = JSON.parse(JSON.stringify(H.scenarios(H).list.find(s => s.id === 'partial').doc)); window.db = H.createLineageDatabase(opts); window.initial = await H.storageModel.prepareDocument(doc, H.schedule.validData); await db.commit(initial, { id: 'seed' }); window.session = H.createEventsSession(db.incremental); await session.open(); window.ctx = id => ({ operationId: id, today: '2030-01-08', at: '2030-01-08T12:00:00Z', confirm: true }); window.payload = extra => ({ ...doc.events[0], title: 'Synthetic edit', ...extra }); window.prepare = async (access, t, id, extra = {}) => access.prepareEventEdit(t, await access.reserveEventEdit(t, 'e', id), { ...(await access.readEventEdit(t, 'e')).event, ...extra }, ctx(id)); });
        const quota = await page.evaluate(async () => {
            const pressure = await new Promise((res, rej) => { const r = indexedDB.open('fullhouse-lab-edit-pressure'); r.onupgradeneeded = () => r.result.createObjectStore('pressure'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
            let full = false;
            for (let n = 0; n < 12 && !full; n++) {
                const bytes = new Uint8Array(524288);
                for (let i = 0; i < bytes.length; i += 65536)
                    crypto.getRandomValues(bytes.subarray(i, i + 65536));
                try {
                    await new Promise((res, rej) => { const tx = pressure.transaction('pressure', 'readwrite'); tx.objectStore('pressure').put(new Blob([bytes]), n); tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
                }
                catch (e) {
                    if (e.name !== 'QuotaExceededError')
                        throw e;
                    full = true;
                }
            }
            pressure.close();
            if (!full)
                throw Error('Actual quota not reached');
            let seed = 17;
            const chars = [];
            for (let i = 0; i < 1400000; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                chars.push(String.fromCharCode(33 + ((seed >>> 8) % 90)));
            }
            window.note = chars.join('');
            const before = session.state().confirmed;
            session.setDraft('event', payload({ note }));
            const state = await session.save('editEvent', payload({ note }), ctx('quota'));
            if (!state.pending || state.confirmed !== before || state.drafts.event.note !== note)
                throw Error('Quota lost pending/draft');
            const read = await db.open();
            if (read.head.generation !== 1 || read.authority.tip.generation !== 1 || read.plan.rootHash !== initial.rootHash)
                throw Error('Partial quota edit');
            return { error: state.pending.error, generation: read.head.generation };
        });
        assert.match(quota.error, /QuotaExceeded/);
        await cdp.send('Storage.overrideQuotaForOrigin', { origin: url });
        const retry = await page.evaluate(async () => { const state = await session.retry(); if (state.pending)
            throw Error(state.pending.error); const read = await db.open(); if (read.head.id !== 'quota' || read.head.generation !== 2 || read.plan.tables.events.find(r => r.key === 'e').value.note !== note)
            throw Error('Quota retry changed facts'); return { generation: read.head.generation, id: read.head.id }; });
        const readFailure = await page.evaluate(async () => { const before = session.state().confirmed, state = await session.save('editEvent', payload({ title: 'Read failure' }), ctx('read-failure'), { fault: tx => { const target = tx.db, original = target.transaction; target.transaction = function (names, mode, ...rest) { if (mode === 'readonly') {
                target.transaction = original;
                throw new DOMException('Injected read denied', 'SecurityError');
            } return original.call(this, names, mode, ...rest); }; } }); if (!state.pending || state.confirmed !== before)
            throw Error('Read failure presented saved'); const inspection = await session.retry(); if (inspection.pending || inspection.confirmed.generation !== before.generation + 1)
            throw Error('Read retry duplicated'); return { pendingKept: true, generation: inspection.confirmed.generation }; });
        // Two real pages prepare edits on exactly the same head.
        const actor = await context.newPage();
        await actor.goto(url + '/storage');
        await page.evaluate(async () => { window.first = await prepare(db.incremental, session.state().confirmed, 'first-tab', { title: 'First tab' }); });
        await actor.evaluate(async () => { const H = FullhouseHistory; window.other = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-edit-faults', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); window.session = H.createEventsSession(other.incremental); await session.open(); const source = (await other.open()).plan.tables.events.find(r => r.key === 'e').value; session.setDraft('event', { ...source, title: 'Second tab' }); await session.save('editEvent', { ...source, title: 'Second tab' }, { operationId: 'second-tab', today: '2030-01-08', at: '2030-01-08T12:00:00Z', confirm: true }, { fault: 'before-writes' }); });
        await page.evaluate(() => db.incremental.commitEventEdit(first));
        const tabs = await actor.evaluate(async () => { const before = session.state().confirmed, state = await session.retry(); if (!state.pending || state.confirmed !== before || state.drafts.event.title !== 'Second tab')
            throw Error('Stale edit discarded'); const packet = await FullhouseHistory.recoveryBinary.inspectRecovery(await session.exportPending(), FullhouseHistory.schedule.validData), current = await other.open(); if (current.plan.tables.events.find(r => r.key === 'e').value.title !== 'First tab')
            throw Error('Stale overwrite'); let resumeBlocked = false; session.cancel(); await session.open(); try {
            await session.resume(packet);
        }
        catch {
            resumeBlocked = true;
        } if (!resumeBlocked)
            throw Error('Stale candidate automatically rebased'); other.close(); return { staleBlocked: true, candidateExportable: true, resumeBlocked }; });
        await actor.close();
        const split = await page.evaluate(async () => {
            await session.open();
            const a = db.incremental, t = session.state().confirmed, r = await a.reserveEventEdit(t, 'e', 'split-abort'), p = { ...(await a.readEventEdit(t, 'e')).event, time: '10:00', applyFrom: '2030-01-20' }, op = await a.prepareEventEdit(t, r, p, ctx('split-abort')), before = (await db.open()).head;
            for (const fault of ['before-writes', 'after-records']) {
                let rejected = false;
                try {
                    await a.commitEventEdit(op, { fault });
                }
                catch {
                    rejected = true;
                }
                const state = await db.open();
                if (!rejected || state.head.rootHash !== before.rootHash || state.authority.tip.generation !== before.generation || state.plan.tables.events.length !== 1)
                    throw Error('Partial multi-row edit');
            }
            const packet = await FullhouseHistory.recoveryBinary.inspectRecovery(await a.exportPending(op, { event: p }), FullhouseHistory.schedule.validData), recovered = await a.resumePending(t, packet);
            let lost = false;
            try {
                await a.commitEventEdit(recovered, { fault: 'lost-ack' });
            }
            catch {
                lost = true;
            }
            const inspection = await a.inspectOperation(recovered);
            if (!lost || inspection.status !== 'persisted-receipt')
                throw Error('Lost ack without receipt');
            const final = await a.commitEventEdit(recovered), read = await db.open();
            if (final.status !== 'confirmed' || !final.receipt.repeated || read.plan.tables.events.length !== 2 || read.head.generation !== before.generation + 1)
                throw Error('Split retry duplicated rows');
            return { twoRowAtomic: true, recovery: true, receipt: inspection.status, generation: read.head.generation };
        });
        const closer = await context.newPage();
        await closer.goto(url + '/storage');
        await closer.evaluate(async () => { const H = FullhouseHistory, d = JSON.parse(JSON.stringify(H.scenarios(H).list.find(s => s.id === 'partial').doc)); window.closedDB = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-edit-closed', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); await closedDB.commit(await H.storageModel.prepareDocument(d, H.schedule.validData), { id: 'seed' }); const a = closedDB.incremental, t = (await a.openWindow()).token, r = await a.reserveEventEdit(t, 'e', 'close'), op = await a.prepareEventEdit(t, r, { ...d.events[0], time: '11:00', applyFrom: '2030-01-20' }, { operationId: 'close', today: '2030-01-08', at: '2030-01-08T12:00:00Z', confirm: true }); window.inflight = a.commitEventEdit(op, { fault: tx => { window.held = true; const hold = () => { const q = tx.objectStore('control').get('head'); q.onsuccess = hold; }; hold(); } }).catch(() => null); });
        await closer.waitForFunction(() => window.held);
        await closer.close();
        const reopened = await page.evaluate(async () => { const d = FullhouseHistory.createLineageDatabase({ ...opts, name: 'fullhouse-lab-edit-closed' }), s = await d.open(); await d.auditLineage(); if (s.head.generation !== s.authority.tip.generation || s.plan.tables.events.length !== s.head.generation)
            throw Error('Torn close'); d.close(); return { generation: s.head.generation, rows: s.plan.tables.events.length }; });
        assert.ok([1, 2].includes(reopened.generation));
        const sources = await page.evaluate(async () => { const H = FullhouseHistory, raw = JSON.stringify({ ...doc, version: 1, recipeRevisions: undefined, events: doc.events.map(({ recipeRevisionId, seriesId, ...e }) => e), logs: {} }), original = { main: raw, alias: null }, results = []; for (const during of [false, true]) {
            let copies = { ...original };
            const d = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-edit-sources-' + during, readSources: () => copies });
            await d.stageMigration(await H.storageSources.proposeMigration(copies, 'main', H.schedule.validData), { id: 'migration' });
            await d.finalizeMigration('migration', { confirm: true });
            const t = (await d.incremental.openWindow()).token, op = await prepare(d.incremental, t, 'source', { title: 'Source edit' });
            if (!during)
                copies.main = raw + ' ';
            let denied = false;
            try {
                await d.incremental.commitEventEdit(op, { fault: during ? () => { copies.main = raw + ' '; } : null });
            }
            catch {
                denied = true;
            }
            copies = original;
            d.close();
            const s = await d.open();
            if (!denied || s.status !== 'recovery')
                throw Error('Divergence lost');
            results.push({ duringTransaction: during, status: s.status, generation: s.head.generation });
            d.close();
        } return results; });
        const corruption = await page.evaluate(async () => { const H = FullhouseHistory, day = '2030-01-25', source = H.createAdapter(H.schedule).prepare(H.createEngine(H.schedule.validData), doc, { executionId: 'future-row', at: day + 'T12:00:00Z', context: { eventId: 'e', date: day, seriesId: 'series', revisionId: 'future-revision' }, action: { type: 'note', text: 'Original future' } }).after, name = 'fullhouse-lab-edit-corrupt-future', bad = H.createLineageDatabase({ ...opts, name }); await bad.commit(await H.storageModel.prepareDocument(source, H.schedule.validData), { id: 'seed' }); const a = bad.incremental, t = (await a.openWindow()).token, r = await a.reserveEventEdit(t, 'e', 'corrupt'), op = await a.prepareEventEdit(t, r, { ...source.events[0], time: '10:00', applyFrom: '2030-01-20' }, { ...ctx('corrupt'), capturedFuture: 'retain-frozen' }); const raw = await new Promise((res, rej) => { const q = indexedDB.open(name, 2); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); await new Promise((res, rej) => { const tx = raw.transaction('executions', 'readwrite'), q = tx.objectStore('executions').get('e@' + day); q.onsuccess = () => tx.objectStore('executions').put({ ...q.result, value: { ...q.result.value, log: { ...q.result.value.log, note: 'Changed outside protocol' } } }); tx.oncomplete = res; tx.onabort = () => rej(tx.error); }); raw.close(); let blocked = false; try {
            await a.commitEventEdit(op);
        }
        catch {
            blocked = true;
        } const state = await bad.open(), persisted = (await bad.sourceRecovery()).state; if (!blocked || state.status !== 'recovery' || persisted.head.generation !== 1 || persisted.commitRecords.length !== 1)
            throw Error('Corrupt future capture overwritten'); const packet = await H.recoveryBinary.inspectRecovery(await a.exportPending(op, { event: 'recover explicitly' }), H.schedule.validData); if (packet.metadata.id !== 'corrupt')
            throw Error('Candidate lost'); bad.close(); return { blocked: true, status: state.status, generation: persisted.head.generation, candidateExportable: true }; });
        // Before-write and after-write changes use the actual Chromium timezone via CDP.
        await page.evaluate(async () => { await session.open(); window.zoneOp = await prepare(db.incremental, session.state().confirmed, 'zone-before', { title: 'Zone before' }); });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Mexico_City' });
        const zoneBefore = await page.evaluate(async () => { const before = (await db.open()).head.generation; let error; try {
            await db.incremental.commitEventEdit(zoneOp);
        }
        catch (e) {
            error = e.message;
        } if (!error || (await db.open()).head.generation !== before)
            throw Error('Changed zone wrote'); return error; });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        let reached;
        const gate = new Promise(resolve => { reached = resolve; });
        await page.exposeFunction('notifyGate', () => reached());
        await page.evaluate(async () => { const H = FullhouseHistory; window.gated = false; window.calls = 0; window.zoneDB = H.createLineageDatabase({ ...opts, name: 'fullhouse-lab-edit-zone-after', readSources: async () => { if (gated && ++calls === 2) {
                await notifyGate();
                await new Promise(resolve => { window.releaseGate = resolve; });
            } return { main: null, alias: null }; } }); await zoneDB.commit(initial, { id: 'seed' }); const t = (await zoneDB.incremental.openWindow()).token; window.zoneAfterOp = await prepare(zoneDB.incremental, t, 'zone-after', { time: '10:00', applyFrom: '2030-01-20' }); window.gated = true; window.writing = zoneDB.incremental.commitEventEdit(zoneAfterOp).then(() => null, e => e.message); });
        await Promise.race([gate, new Promise((_, reject) => setTimeout(() => reject(Error('Zone gate timeout')), 10000))]);
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Mexico_City' });
        const zoneAfter = await page.evaluate(async () => { releaseGate(); const error = await writing, inspection = await zoneDB.incremental.inspectOperation(zoneAfterOp); if (!/tras escribir/.test(error || '') || inspection.status !== 'persisted-receipt')
            throw Error('Changed zone after write acknowledged'); zoneDB.close(); return { error, receipt: inspection.status }; });
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        const historical = await page.evaluate(async () => { const s = await db.open(); for (const table of ['executions', 'revisions', 'evidence'])
            if (JSON.stringify(s.plan.tables[table]) !== JSON.stringify(initial.tables[table]))
                throw Error('Historical facts changed'); await db.auditLineage(); db.close(); return true; });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ base: 'c61e6ac', browser: context.browser()?.version() || 'persistent Chromium', quota, retry, readFailure, tabs, split, reopened, sources, corruption, zoneBefore, zoneAfter, historicalHashesEqual: historical, noJavaScriptErrors: true }, null, 2));
    }
    finally {
        if (context)
            await context.close();
        fs.rmSync(profile, { recursive: true, force: true });
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
