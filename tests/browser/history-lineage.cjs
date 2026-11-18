'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start({ baseline: true });
    let browser, cases = 0;
    const results = [];
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const width of [1280, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(() => {
                window.storageAttempts = [];
                for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'])
                    Storage.prototype[method] = function () { storageAttempts.push(method); throw Error('Claves públicas prohibidas'); };
            });
            await page.goto(url + '/storage');
            const matrix = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, raw = note => JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: ['lost'], note } } }), a = raw('Synthetic A'), b = raw('Synthetic B'), pairs = [{ main: null, alias: null }, { main: a, alias: null }, { main: null, alias: a }, { main: a, alias: a }, { main: a, alias: JSON.stringify(JSON.parse(a), null, 2) }, { main: a, alias: b }], results = [];
                for (let i = 0; i < pairs.length; i++) {
                    let copies = { ...pairs[i] };
                    const name = 'fullhouse-lab-lineage-matrix-' + i, reader = () => copies, db = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, schedule: H.schedule, readSources: reader });
                    let first;
                    if (i === 0) {
                        const doc = H.scenarios(H).list.find(s => s.id === 'partial').doc;
                        first = await db.commit(await H.storageModel.prepareDocument(doc, L), { id: 'seed' });
                    }
                    else {
                        const selection = i === 2 ? 'alias' : 'main', proposal = await H.storageSources.proposeMigration(copies, selection, L);
                        await db.stageMigration(proposal, { id: 'migration' });
                        first = await db.finalizeMigration('migration', { confirm: true });
                    }
                    let state = await db.open();
                    if (state.status !== 'ready')
                        throw Error('No abrió linaje ' + i + ': ' + state.error);
                    const root = state.authority.genesis.rootHash, id = state.authority.id, source = state.authority.origin.fingerprints;
                    const api = db.incremental, opened = await api.openWindow(), key = i === 0 ? 'e@2030-01-07' : 'old', command = i === 0 ? { executionId: 'execution', at: '2030-01-07T13:00:00Z', operationId: 'edit', editId: 'edit', reason: 'Editar', action: { type: 'note', text: 'New v2' } } : { id: 'edit', at: '2030-01-07T13:00:00Z', reason: 'Edición legada', action: { type: 'note', text: 'New v2' } };
                    const delta = await api.prepareExecution(opened.token, key, command);
                    await api.commitExecution(delta);
                    await api.commitExecution(delta);
                    await db.auditLineage();
                    db.close();
                    const reopened = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, schedule: H.schedule, readSources: reader });
                    state = await reopened.open();
                    if (state.status !== 'ready' || state.authority.id !== id || state.authority.genesis.rootHash !== root || state.authority.tip.generation !== 2)
                        throw Error('Linaje no sobrevivió reinicio');
                    const oldWriter = H.baseline.createLabDatabase({ factory: indexedDB, name, legacy: L });
                    if ((await oldWriter.open()).status !== 'recovery')
                        throw Error('Escritor viejo abrió versión nueva');
                    oldWriter.close();
                    copies = { ...copies, main: raw('v1 came back') };
                    const conflict = await reopened.open();
                    if (conflict.status !== 'recovery')
                        throw Error('Cambio cerrado no detectado');
                    const packet = await reopened.sourceRecovery();
                    if (!packet.memoryConflict && !packet.state.conflict)
                        throw Error('Conflicto no conservado');
                    reopened.close();
                    const third = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, schedule: H.schedule, readSources: () => pairs[i] });
                    if ((await third.open()).status !== 'recovery')
                        throw Error('Conflicto desapareció al restaurar bytes');
                    third.close();
                    results.push({ case: i, first: first.status, source, generation: state.head.generation, conflictPersistent: true });
                }
                return results;
            });
            assert.equal(matrix.length, 6);
            results.push({ width, matrix });
            cases += 24;
            const barriers = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, doc = H.scenarios(H).list.find(s => s.id === 'partial').doc, name = 'fullhouse-lab-lineage-barriers', copies = { main: null, alias: null }, db = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, schedule: H.schedule, readSources: () => copies });
                await db.commit(await H.storageModel.prepareDocument(doc, L), { id: 'seed' });
                const state = await db.open();
                const ro = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, readSources: () => copies, writerCapabilities: [] });
                if ((await ro.open()).status !== 'readonly')
                    throw Error('Capacidades insuficientes no son lectura');
                let denied = false;
                try {
                    await ro.commit(state.plan, { id: 'bad', expected: state.head });
                }
                catch {
                    denied = true;
                }
                if (!denied)
                    throw Error('Escritor incompatible escribió');
                ro.close();
                // Autoridad malformada deja datos y entra en recuperación.
                const raw = await new Promise((res, rej) => { const r = indexedDB.open(name, 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }), tx = raw.transaction('control', 'readwrite');
                tx.objectStore('control').put({ ...state.authority, checksum: '0'.repeat(64) });
                await new Promise((res, rej) => { tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
                raw.close();
                if ((await db.open()).status !== 'recovery')
                    throw Error('Manifest corrupto aceptado');
                const recovery = await db.sourceRecovery();
                if (!recovery.state.conflict)
                    throw Error('Cuarentena no persistió');
                db.close();
                return { readonly: true, denied, quarantine: true };
            });
            assert.ok(barriers.denied);
            cases += 3;
            const races = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, raw = note => JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: ['lost'], note } } }), initial = raw('Original'), changed = raw('Different');
                let count = 0;
                for (const mode of ['before-stage', 'after-commits', 'during-write', 'disappeared', 'unreadable']) {
                    let copies = { main: initial, alias: null }, unreadable = false;
                    const readSources = () => {
                        if (unreadable)
                            throw Error('Access denied');
                        return { ...copies };
                    }, db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-race-' + mode, legacy: L, schedule: H.schedule, readSources }), proposal = await H.storageSources.proposeMigration(copies, 'main', L);
                    if (mode === 'before-stage') {
                        copies.main = changed;
                        let refused = false;
                        try {
                            await db.stageMigration(proposal, { id: 'migration' });
                        }
                        catch {
                            refused = true;
                        }
                        const dump = await db.sourceRecovery();
                        if (!refused || dump.state.conflict.expected.copies.main !== initial || dump.state.conflict.observed.copies.main !== changed)
                            throw Error('No conservó ambas copias antes de preparar');
                        db.close();
                        count++;
                        continue;
                    }
                    await db.stageMigration(proposal, { id: 'migration' });
                    await db.finalizeMigration('migration', { confirm: true });
                    let token = (await db.incremental.openWindow()).token;
                    for (let i = 0; i < 3; i++) {
                        const id = 'edit-' + i, op = await db.incremental.prepareExecution(token, 'old', { id, at: '2030-01-07T12:00:00Z', reason: 'Edición', action: { type: 'note', text: 'v2 ' + i } });
                        token = (await db.incremental.commitExecution(op)).token;
                    }
                    const pending = await db.incremental.prepareExecution(token, 'old', { id: 'pending', at: '2030-01-07T12:00:00Z', reason: 'Pendiente', action: { type: 'note', text: 'Pending' } });
                    let refused = false;
                    if (mode === 'after-commits')
                        copies.main = changed;
                    if (mode === 'disappeared')
                        copies.main = null;
                    if (mode === 'unreadable')
                        unreadable = true;
                    try {
                        await db.incremental.commitExecution(pending, mode === 'during-write' ? { fault: () => { copies.main = changed; } } : {});
                    }
                    catch {
                        refused = true;
                    }
                    const dump = await db.sourceRecovery();
                    if (!refused || !dump.state.conflict || dump.state.head.generation !== (mode === 'during-write' ? 5 : 4))
                        throw Error('Carrera sobrescribió confirmado o perdió cuarentena');
                    await H.lineage.verifyAuthority(dump.state.authority, dump.state.head, dump.state.commitRecords);
                    if (!await db.incremental.exportPending(pending, { note: 'Draft' }))
                        throw Error('Pendiente no exportable');
                    db.close();
                    count++;
                }
                // Versionchange de escritor conocido y conexión que bloquea el upgrade.
                const doc = H.scenarios(H).list.find(s => s.id === 'partial').doc, plan = await H.storageModel.prepareDocument(doc, L), name = 'fullhouse-lab-lineage-old-connection', old = H.baseline.createLabDatabase({ factory: indexedDB, name, legacy: L });
                const seeded = await old.commit(plan, { id: 'old' });
                const upgraded = H.createLineageDatabase({ factory: indexedDB, name, legacy: L, readSources: () => ({ main: null, alias: null }) });
                if ((await upgraded.open()).status !== 'recovery')
                    throw Error('Se inventó linaje de base antigua');
                let oldDenied = false;
                try {
                    await old.commit(plan, { id: 'should-fail', expected: seeded.head });
                }
                catch {
                    oldDenied = true;
                }
                if (!oldDenied)
                    throw Error('Conexión vieja continuó escribiendo');
                old.close();
                upgraded.close();
                count++;
                const blockName = 'fullhouse-lab-lineage-blocked', old2 = H.baseline.createLabDatabase({ factory: indexedDB, name: blockName, legacy: L });
                await old2.commit(plan, { id: 'old' });
                old2.close();
                const hold = await new Promise((res, rej) => { const r = indexedDB.open(blockName, 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
                let sawVersionChange = false;
                hold.onversionchange = () => { sawVersionChange = true; };
                const waiting = H.createLineageDatabase({ factory: indexedDB, name: blockName, legacy: L, readSources: () => ({ main: null, alias: null }) });
                const blocked = await waiting.open();
                if (blocked.status !== 'recovery' || !sawVersionChange)
                    throw Error('Upgrade bloqueado ignorado');
                hold.close();
                await new Promise(r => setTimeout(r, 20));
                const original = await H.baseline.createLabDatabase({ factory: indexedDB, name: blockName, legacy: L }).open();
                if (original.status !== 'ready' || original.head.rootHash !== plan.rootHash)
                    throw Error('Upgrade rechazado cambió los datos');
                waiting.close();
                count++;
                return count;
            });
            cases += races;
            const atomic = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, doc = H.scenarios(H).list.find(s => s.id === 'partial').doc, opts = { factory: indexedDB, name: 'fullhouse-lab-lineage-atomic', legacy: L, schedule: H.schedule, readSources: () => ({ main: null, alias: null }) }, db = H.createLineageDatabase(opts), plan = await H.storageModel.prepareDocument(doc, L);
                await db.commit(plan, { id: 'seed' });
                let token = (await db.incremental.openWindow()).token;
                const request = id => ({ executionId: 'execution', at: '2030-01-07T13:00:00Z', editId: id, operationId: id, reason: 'Atomicidad', action: { type: 'note', text: id } }), op = await db.incremental.prepareExecution(token, 'e@2030-01-07', request('retry'));
                for (const fault of ['before-writes', 'after-records', () => { throw new DOMException('Injected quota', 'QuotaExceededError'); }]) {
                    let rejected = false;
                    try {
                        await db.incremental.commitExecution(op, { fault });
                    }
                    catch {
                        rejected = true;
                    }
                    const state = await db.open();
                    if (!rejected || state.head.generation !== 1 || state.authority.tip.generation !== 1)
                        throw Error('Autoridad escapó de transacción abortada');
                }
                try {
                    await db.incremental.commitExecution(op, { fault: 'lost-ack' });
                }
                catch { }
                const result = await db.incremental.commitExecution(op);
                if (result.status !== 'confirmed' || result.receipt.generation !== 2)
                    throw Error('Acuse perdido duplicó recibo');
                const other = H.createLineageDatabase(opts), second = (await other.incremental.openWindow()).token, stale = await other.incremental.prepareExecution(second, 'e@2030-01-07', request('stale')), next = await db.incremental.prepareExecution(result.token, 'e@2030-01-07', request('next'));
                await db.incremental.commitExecution(next);
                let refused = false;
                try {
                    await other.incremental.commitExecution(stale);
                }
                catch {
                    refused = true;
                }
                if (!refused || (await other.open()).status !== 'ready')
                    throw Error('CAS no aisló operación obsoleta');
                other.close();
                const state = await db.open(), archive = await H.storageArchive.exportArchive(state.plan, L), restored = await H.storageArchive.importArchive(archive, L), target = H.createLineageDatabase({ ...opts, name: opts.name + '-restore' });
                await target.commit(restored, { id: 'restored', confirmRestore: true });
                const read = await target.open();
                if (read.authority.origin.kind !== 'restored' || read.head.rootHash !== state.head.rootHash)
                    throw Error('Restauración inventó linaje o cambió hechos');
                const photo = await target.readEvidence('execution:execution', 'photo');
                if (!photo?.blob.size)
                    throw Error('Foto perdida al restaurar');
                await target.auditLineage();
                target.close();
                db.close();
                return 7;
            });
            cases += atomic;
            const closing = await context.newPage();
            await closing.goto(url + '/storage');
            await closing.evaluate(async () => { const H = FullhouseHistory, L = H.schedule.validData; window.db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-closed-tx', legacy: L, schedule: H.schedule, readSources: () => ({ main: null, alias: null }) }); await db.commit(await H.storageModel.prepareDocument(H.scenarios(H).list.find(s => s.id === 'partial').doc, L), { id: 'seed' }); const token = (await db.incremental.openWindow()).token; window.op = await db.incremental.prepareExecution(token, 'e@2030-01-07', { executionId: 'execution', at: '2030-01-07T13:00:00Z', editId: 'close', operationId: 'close', reason: 'Close', action: { type: 'note', text: 'Closed' } }); window.inflight = db.incremental.commitExecution(op, { fault: tx => { window.held = true; const hold = () => { const r = tx.objectStore('control').get('head'); r.onsuccess = hold; }; hold(); } }).catch(() => null); });
            await closing.waitForFunction(() => window.held);
            await closing.close();
            const closed = await page.evaluate(async () => { const H = FullhouseHistory, db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-closed-tx', legacy: H.schedule.validData, readSources: () => ({ main: null, alias: null }) }), s = await db.open(); await db.auditLineage(); db.close(); return { status: s.status, generation: s.head.generation, tip: s.authority.tip.generation }; });
            assert.equal(closed.status, 'ready');
            assert.ok([1, 2].includes(closed.generation));
            assert.equal(closed.tip, closed.generation);
            cases++;
            const actor = await context.newPage(), writer = await context.newPage();
            for (const p of [actor, writer]) {
                await p.addInitScript(() => {
                    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
                    Storage.prototype.getItem = function (k) {
                        if (!k.startsWith('fullhouse-lab-lineage-source-'))
                            throw Error('Clave no permitida');
                        return get.call(this, k);
                    };
                    Storage.prototype.setItem = function (k, v) {
                        if (!k.startsWith('fullhouse-lab-lineage-source-'))
                            throw Error('Clave no permitida');
                        return set.call(this, k, v);
                    };
                });
                await p.goto(url + '/storage');
            }
            await actor.evaluate(() => { localStorage.setItem('fullhouse-lab-lineage-source-main', JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: [], note: 'Original' } } })); });
            await writer.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData;
                window.readCopies = () => ({ main: localStorage.getItem('fullhouse-lab-lineage-source-main'), alias: localStorage.getItem('fullhouse-lab-lineage-source-alias') });
                window.live = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-two-actors', legacy: L, schedule: H.schedule, readSources: readCopies });
                await live.stageMigration(await H.storageSources.proposeMigration(readCopies(), 'main', L), { id: 'migration' });
                await live.finalizeMigration('migration', { confirm: true });
                const token = (await live.incremental.openWindow()).token;
                window.delta = await live.incremental.prepareExecution(token, 'old', { id: 'during', at: '2030-01-07T12:00:00Z', reason: 'Simultáneas', action: { type: 'note', text: 'V2 candidate' } });
                window.inflight = live.incremental.commitExecution(delta, { fault: tx => {
                        window.held = true;
                        const hold = () => {
                            const r = tx.objectStore('control').get('head');
                            r.onsuccess = () => {
                                if (!window.release)
                                    hold();
                            };
                        };
                        hold();
                    } }).then(() => ({ confirmed: true })).catch(e => ({ error: e.message }));
            });
            await writer.waitForFunction(() => window.held);
            await actor.evaluate(() => { localStorage.setItem('fullhouse-lab-lineage-source-main', JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: [], note: 'V1 simultaneous' } } })); });
            await writer.evaluate(() => window.release = true);
            const raced = await writer.evaluate(async () => ({ result: await inflight, recovery: await live.sourceRecovery() }));
            assert.ok(raced.result.error);
            assert.equal(raced.recovery.state.head.generation, 2);
            assert.ok(raced.recovery.state.conflict);
            await writer.evaluate(() => live.close());
            await actor.close();
            await writer.close();
            cases += 2;
            // UI de selección explícita, commit confirmado y conflicto duradero.
            const ui = await context.newPage();
            await ui.goto(url + '/lineage');
            await ui.selectOption('#theme', width === 390 ? 'ocean' : 'midnight');
            const click = async (id) => { await ui.locator('#' + id).click(); await ui.waitForFunction(() => !lineageLab.state().busy); };
            await click('fixture');
            await click('stage');
            assert.match(await ui.locator('#status').innerText(), /Selecciona/);
            await ui.selectOption('#source', 'main');
            await click('stage');
            await ui.locator('#confirm').check();
            await click('finalize');
            assert.ok((await ui.evaluate(() => lineageLab.state())).token);
            await click('save-note');
            assert.match(await ui.locator('#status').innerText(), /confirmada/);
            await click('old-tab');
            await click('watch');
            assert.match(await ui.locator('#status').innerText(), /divergentes/);
            await click('restore-sources');
            await click('watch');
            assert.match(await ui.locator('#status').innerText(), /divergentes/);
            assert.equal(await ui.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            await ui.close();
            cases += 4;
            assert.deepEqual(errors, []);
            assert.deepEqual(await page.evaluate(() => storageAttempts), []);
            await context.close();
        }
        const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fullhouse-lineage-quota-')), origin = await start();
        let persistent;
        try {
            persistent = await chromium.launchPersistentContext(profile, { executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
            const qp = persistent.pages()[0], cdp = await persistent.newCDPSession(qp);
            await cdp.send('Storage.overrideQuotaForOrigin', { origin: origin.url, quotaSize: 1048576 });
            await qp.goto(origin.url + '/storage');
            const quota = await qp.evaluate(async () => { const H = FullhouseHistory, L = H.schedule.validData, db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-quota', legacy: L, schedule: H.schedule, readSources: () => ({ main: null, alias: null }) }), doc = H.scenarios(H).list.find(s => s.id === 'partial').doc; await db.commit(await H.storageModel.prepareDocument(doc, L), { id: 'seed' }); const token = (await db.incremental.openWindow()).token, canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 1100; const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(1100, 1100); let seed = 123; for (let i = 0; i < pixels.data.length; i += 4) {
                seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                pixels.data[i] = seed & 255;
                pixels.data[i + 1] = (seed >>> 8) & 255;
                pixels.data[i + 2] = (seed >>> 16) & 255;
                pixels.data[i + 3] = 255;
            } ctx.putImageData(pixels, 0, 0); const op = await db.incremental.prepareExecution(token, 'e@2030-01-07', { executionId: 'execution', at: '2030-01-07T13:00:00Z', editId: 'quota', operationId: 'quota', reason: 'Quota', action: { type: 'evidence', evidence: { id: 'large', kind: 'image', src: canvas.toDataURL('image/png'), caption: 'Synthetic quota', createdAt: '2030-01-07T13:00:00Z' } } }); let error; try {
                await db.incremental.commitExecution(op);
            }
            catch (e) {
                error = e.name + ': ' + e.message;
            } const state = await db.open(); await db.auditLineage(); db.close(); return { error, generation: state.head.generation, authority: state.authority.tip.generation, images: state.storedImages }; });
            assert.match(quota.error, /QuotaExceeded/);
            assert.equal(quota.generation, 1);
            assert.equal(quota.authority, 1);
            assert.equal(quota.images, 1);
            results.push({ realQuota: quota });
            cases++;
        }
        finally {
            if (persistent)
                await persistent.close();
            await new Promise(r => origin.server.close(r));
            fs.rmSync(profile, { recursive: true, force: true });
        }
        console.log(JSON.stringify({ base: 'd1dae11', browser: browser.version(), cases, results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
