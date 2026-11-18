'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    const results = [];
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const width of [1280, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 950 } }), page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(() => { for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
                Storage.prototype[method] = () => { throw Error('Public Storage forbidden'); }; });
            await page.goto(url + '/storage');
            const result = await page.evaluate(async () => {
                const H = FullhouseHistory, L = H.schedule.validData, copy = x => JSON.parse(JSON.stringify(x)), engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter });
                let doc = copy(H.scenarios(H).list.find(s => s.id === 'edited').doc);
                doc.goals[0].review = { date: '2030-01-07', time: '18:00', repeat: 'weekly' };
                doc.events.push({ id: 'review-goal', kind: 'review', title: 'Revisión original', date: '2030-01-07', time: '18:00', minutes: 30, goalId: 'goal', routineId: '', repeat: 'weekly', note: 'Original review', overrides: { '2030-01-14': { time: '18:30' } } });
                doc = copy(adapter.prepare(engine, doc, { executionId: 'review-execution', at: '2030-01-07T12:00:00Z', context: { eventId: 'review-goal', date: '2030-01-07', seriesId: 'review-original', revisionId: 'unused' }, action: { type: 'note', text: 'Recorded review' } }).after);
                doc.logs.old = { completed: false, checkedSteps: ['unknown'], note: 'Legacy original', evidences: [{ id: 'old-photo', kind: 'image', src: Object.values(doc.logs)[0].evidences[0].src, caption: 'Original legacy', createdAt: '2030-01-07T12:00:00Z' }] };
                doc = compat.adopt(doc, 'old', { id: 'adopt', at: '2030-01-08T12:00:00Z', confirm: true, reason: 'Synthetic voluntary adoption', executionId: 'adopted', routineId: 'r', expectedDefinition: doc.routines[0], context: { eventId: 'e', date: '2030-01-08', seriesId: 'adopted-series', revisionId: 'adopted-revision' } }).after;
                const canonical = v => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
                doc = copy(doc);
                doc.events.push({ ...copy(doc.events[0]), id: 'another-linked', seriesId: 'another-series' });
                const initial = copy(doc), options = { factory: indexedDB, name: 'fullhouse-lab-scoped-goals', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }, db = H.createLineageDatabase(options), old = H.createLabDatabase({ ...options, name: 'fullhouse-lab-scoped-goals-reference' }), plan = await H.storageModel.prepareDocument(doc, L);
                await db.commit(plan, { id: 'seed' });
                await old.commit(plan, { id: 'seed' });
                const reference = H.createCompatSession({ database: old, compat, legacy: L, plannerActions: H.plannerActions, engine }), session = H.createGoalsSession(db.incremental);
                await reference.open();
                await session.open();
                const ctx = (id, state = {}, ids = []) => ({ operationId: id, today: '2030-01-07', at: '2030-01-07T13:00:00Z', ids, state }), draft = (id = '', extra = {}) => ({ id, title: 'Synthetic goal', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: 'units', mode: 'numeric', milestones: [], ...extra }), operations = [];
                async function equivalent(method, payload, context) { const expected = await reference.plan(method, payload, context); if (expected.pending)
                    throw Error('Reference pending ' + expected.pending.error); const saved = await session.save(method, payload, context); if (saved.pending)
                    throw Error('Scoped pending ' + saved.pending.error); const read = await db.open(), referencePlan = await H.storageModel.prepareDocument(expected.confirmed, L); if (read.status !== 'ready' || read.head.rootHash !== referencePlan.rootHash)
                    throw Error('Root mismatch ' + method); const actual = await H.storageModel.hydrate(read.plan, L); if (canonical(actual.logs) !== canonical(initial.logs) || canonical(actual.recipeRevisions) !== canonical(initial.recipeRevisions))
                    throw Error('Historical content changed'); operations.push(method); }
                await equivalent('saveGoal', draft(), ctx('create', {}, ['parent']));
                await equivalent('saveGoal', draft('', { parentId: 'parent', review: { date: '2030-01-07', time: '23:30', repeat: 'weekly' } }), ctx('child', {}, ['child']));
                await equivalent('saveProgress', {}, ctx('numeric', { progressGoalId: 'parent', progressValue: '2,5', progressNote: 'Numeric note' }));
                await equivalent('saveGoal', draft('parent', { mode: 'qualitative', status: 'working' }), ctx('qualitative'));
                await equivalent('saveProgress', {}, ctx('quality', { progressGoalId: 'parent', progressValue: '', progressStatus: 'improving', progressNote: 'Qualitative note' }));
                await equivalent('saveGoal', draft('parent', { mode: 'milestones', milestones: [{ id: 'm', title: 'First', done: false }] }), ctx('milestones'));
                await equivalent('toggleMilestone', { goalId: 'parent', milestoneId: 'm' }, ctx('mark'));
                await equivalent('toggleMilestone', { goalId: 'parent', milestoneId: 'm' }, ctx('unmark'));
                await equivalent('saveDayReview', {}, ctx('day', { selectedDate: '2040-01-01', reviewDraft: 'First note' }));
                await equivalent('saveDayReview', {}, ctx('day-edit', { selectedDate: '2040-01-02', reviewDraft: 'Revised note' }));
                await equivalent('saveGoal', draft('child', { parentId: 'parent' }), ctx('remove-review'));
                await equivalent('saveGoal', draft('goal', { title: 'Changed after execution' }), ctx('rename'));
                const read = await session.readGoal('parent');
                if (!read.related.some(r => r.key === 'child') || read.photoBytesHydrated !== 0)
                    throw Error('Missing relation');
                if ((await session.readDayReview('2030-01-07')).review.note !== 'Revised note')
                    throw Error('Wrong review date');
                // Fallos antes/durante, borrador conservado, candidato y confirmado separados.
                for (const fault of ['before-writes', 'after-records', 'lost-ack']) {
                    const before = session.state().confirmed;
                    session.setDraft('progressNote', 'Unsubmitted draft');
                    const state = await session.save('saveProgress', {}, ctx('fault-' + fault, { progressGoalId: 'parent', progressValue: '', progressStatus: 'working', progressNote: fault }), { fault });
                    if (!state.pending || state.confirmed !== before)
                        throw Error('Failure replaced confirmed');
                    const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L);
                    if (packet.metadata.drafts.progressNote !== 'Unsubmitted draft')
                        throw Error('Lost draft');
                    const retry = await session.retry();
                    if (retry.pending || retry.confirmed.generation !== before.generation + 1)
                        throw Error('Retry duplicated or failed');
                }
                // Recuperación real del paquete en una conexión nueva, sin ID nuevo.
                const before = session.state().confirmed;
                await session.save('saveDayReview', {}, ctx('recover', { reviewDraft: 'Recovered' }), { fault: 'before-writes' });
                const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L), fresh = H.createLineageDatabase(options), restored = H.createGoalsSession(fresh.incremental);
                await restored.open();
                await restored.resume(packet);
                if (restored.state().pending.id !== 'recover')
                    throw Error('Changed recovery ID');
                await restored.retry();
                if (restored.state().confirmed.generation !== before.generation + 1)
                    throw Error('Recovery duplicated');
                session.cancel();
                const one = (await db.incremental.openWindow()).token, two = (await fresh.incremental.openWindow()).token, a = await db.incremental.preparePlanning(one, 'saveProgress', {}, ctx('one', { progressGoalId: 'parent', progressValue: '', progressStatus: 'working', progressNote: 'one' })), b = await fresh.incremental.preparePlanning(two, 'saveProgress', {}, ctx('two', { progressGoalId: 'parent', progressValue: '', progressStatus: 'working', progressNote: 'two' }));
                await db.incremental.commitPlanning(a);
                let stale = false;
                try {
                    await fresh.incremental.commitPlanning(b);
                }
                catch {
                    stale = true;
                }
                if (!stale)
                    throw Error('Stale writer accepted');
                // Respaldo completo: mismo root y blobs, autoridad nueva explícita.
                const fullState = await db.open(), archive = await H.storageArchive.exportArchive(fullState.plan, L), imported = await H.storageArchive.importArchive(archive, L), target = H.createLineageDatabase({ ...options, name: 'fullhouse-lab-scoped-goals-restored' });
                await target.commit(imported, { id: 'restore', confirmRestore: true });
                const restoredState = await target.open();
                if (restoredState.head.rootHash !== fullState.head.rootHash)
                    throw Error('Restore changed facts');
                const photo = await target.readEvidence('execution:execution', 'photo'), source = await db.readEvidence('execution:execution', 'photo');
                if (await H.storageModel.bytesHash(photo.blob) !== await H.storageModel.bytesHash(source.blob))
                    throw Error('Photo bytes changed');
                target.close();
                // Entrada con meta eliminada: conserva etiquetas históricas y permite otras metas.
                const orphanDoc = copy(initial);
                orphanDoc.goals = [];
                const orphan = H.createLineageDatabase({ ...options, name: 'fullhouse-lab-goals-orphan' });
                await orphan.commit(await H.storageModel.prepareDocument(orphanDoc, L), { id: 'seed' });
                const ot = (await orphan.incremental.openWindow()).token;
                if ((await orphan.incremental.readGoal(ot, 'goal')).goal !== null)
                    throw Error('Invented missing goal');
                let missingRejected = false;
                try {
                    await orphan.incremental.preparePlanning(ot, 'saveProgress', {}, ctx('missing', { progressGoalId: 'goal', progressValue: '1', progressNote: '' }));
                }
                catch {
                    missingRejected = true;
                }
                if (!missingRejected)
                    throw Error('Resurrected missing goal');
                let reused=false;try{await orphan.incremental.preparePlanning(ot,'saveGoal',draft(),ctx('reuse',{},['goal']));}catch{reused=true;}if(!reused)throw Error('Reused historical goal identity');
                const oo = await orphan.incremental.preparePlanning(ot, 'saveGoal', draft(), ctx('unrelated', {}, ['unrelated']));
                await orphan.incremental.commitPlanning(oo);
                const os = await orphan.open();
                if (canonical((await H.storageModel.hydrate(os.plan, L)).logs) !== canonical(initial.logs))
                    throw Error('Orphan history changed');
                orphan.close();
                // Fuentes antiguas: una meta pendiente tampoco puede saltarse la vigilancia.
                const rawSource = JSON.stringify({ version: 1, goals: [draft('migrated')].map(g => ({ ...g, history: [] })), routines: [], events: [], logs: { old: { completed: false, checkedSteps: [] } } });
                let sources = { main: rawSource, alias: null };
                const migrated = H.createLineageDatabase({ ...options, name: 'fullhouse-lab-scoped-goals-source', readSources: () => sources });
                await migrated.stageMigration(await H.storageSources.proposeMigration(sources, 'main', L), { id: 'migration' });
                await migrated.finalizeMigration('migration', { confirm: true });
                const mt = (await migrated.incremental.openWindow()).token, mo = await migrated.incremental.preparePlanning(mt, 'saveProgress', {}, ctx('source-change', { progressGoalId: 'migrated', progressValue: '2', progressNote: 'Pending' }));
                sources = { main: rawSource + ' ', alias: null };
                let sourceBlocked = false;
                try {
                    await migrated.incremental.commitPlanning(mo);
                }
                catch {
                    sourceBlocked = true;
                }
                sources = { main: rawSource, alias: null };
                migrated.close();
                if (!sourceBlocked || (await migrated.open()).status !== 'recovery')
                    throw Error('Source change did not persist');
                migrated.close();
                // Corrupción relacionada: padre distinto al catálogo verificado bloquea la preparación.
                const token = (await db.incremental.openWindow()).token, raw = await new Promise((res, rej) => { const r = indexedDB.open(options.name, 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
                await new Promise((res, rej) => { const tx = raw.transaction('goals', 'readwrite'), r = tx.objectStore('goals').get('parent'); r.onsuccess = () => tx.objectStore('goals').put({ ...r.result, value: { ...r.result.value, title: 'Corrupt' } }); tx.oncomplete = res; tx.onabort = () => rej(tx.error); });
                raw.close();
                let corrupt = false;
                try {
                    await db.incremental.preparePlanning(token, 'saveGoal', draft('child', { parentId: 'parent' }), ctx('corrupt'));
                }
                catch {
                    corrupt = true;
                }
                if (!corrupt || (await db.open()).status !== 'recovery')
                    throw Error('Related corruption accepted');
                fresh.close();
                db.close();
                old.close();
                return { operations: operations.length, retries: 3, recovery: true, stale, corrupt, legacyAndAdoptedPreserved: true, restore: true, sourceBlocked, orphan: true };
            });
            const actor = await context.newPage();
            await actor.goto(url + '/storage');
            await page.evaluate(async () => { const H = FullhouseHistory, L = H.schedule.validData, doc = { version: 2, goals: [{ id: 'g', title: 'Synthetic', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: '', history: [] }], routines: [], events: [], logs: {}, recipeRevisions: {} }; window.tabOptions = { factory: indexedDB, name: 'fullhouse-lab-goals-two-tabs', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }; window.tabsDb = H.createLineageDatabase(tabOptions); await tabsDb.commit(await H.storageModel.prepareDocument(doc, L), { id: 'seed' }); window.tabContext = { operationId: 'tab-one', today: '2030-01-07', at: '2030-01-07T13:00:00Z', ids: [], state: { progressGoalId: 'g', progressValue: '1', progressNote: 'One' } }; window.tabOp = await tabsDb.incremental.preparePlanning((await tabsDb.incremental.openWindow()).token, 'saveProgress', {}, tabContext); });
            await actor.evaluate(async () => { const H = FullhouseHistory; window.db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-goals-two-tabs', legacy: H.schedule.validData, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }); window.op = await db.incremental.preparePlanning((await db.incremental.openWindow()).token, 'saveProgress', {}, { operationId: 'tab-two', today: '2030-01-07', at: '2030-01-07T13:00:00Z', ids: [], state: { progressGoalId: 'g', progressValue: '2', progressNote: 'Two' } }); });
            await page.evaluate(() => tabsDb.incremental.commitPlanning(tabOp));
            const twoTabs = await actor.evaluate(async () => { let rejected = false; try {
                await db.incremental.commitPlanning(op);
            }
            catch {
                rejected = true;
            } const state = await db.open(); db.close(); return { rejected, generation: state.head.generation, current: state.plan.tables.goals[0].value.current }; });
            assert.deepEqual(twoTabs, { rejected: true, generation: 2, current: 1 });
            await page.evaluate(() => tabsDb.close());
            await actor.close();
            result.realTwoTabs = true;
            assert.equal(result.operations, 12);
            assert.deepEqual(errors, []);
            results.push({ width, ...result });
            await context.close();
        }
        console.log(JSON.stringify({ base: 'cc1d901', browser: browser.version(), results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
