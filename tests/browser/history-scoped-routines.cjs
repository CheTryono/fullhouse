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
            await context.addInitScript(() => {
                for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
                    Storage.prototype[k] = () => { throw Error('No public storage'); };
            });
            await page.goto(url + '/storage');
            const result = await page.evaluate(async (stage) => {
                const H = FullhouseHistory, L = H.schedule.validData, copy = x => JSON.parse(JSON.stringify(x)), canonical = x => JSON.stringify(x, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v), engine = H.createEngine(L), adapter = H.createAdapter(H.schedule), compat = H.createLegacyCompat({ legacy: L, engine, adapter });
                let doc = copy(H.scenarios(H).list.find(s => s.id === 'partial').doc), pixel = Object.values(doc.logs)[0].evidences[0].src;
                doc.logs = {};
                doc.recipeRevisions = {};
                delete doc.events[0].recipeRevisionId;
                delete doc.events[0].seriesId;
                doc.routines[0].steps = Array.from({ length: 5 }, (_, i) => ({ id: 's' + i, title: 'Original ' + i, min: 10 }));
                doc.routines[0].steps[1] = { ...doc.routines[0].steps[1], mode: 'alternatives', chooseWhen: 'execute', variants: [{ id: 'old-option', title: 'Original option', desc: 'Original instructions', min: 10, days: [] }] };
                doc.events[0].minutes = 50;
                doc.goals.push({ ...copy(doc.goals[0]), id: 'other-goal', title: 'Other goal' });
                for (const action of [{ type: 'choice', stepId: 's1', variantId: 'old-option' }, { type: 'step', stepId: 's0', checked: true }, { type: 'note', text: 'Original note', stepId: 's0' }, { type: 'evidence', evidence: { id: 'photo', kind: 'image', src: pixel, caption: 'Original photo', stepId: 's0', createdAt: '2030-01-07T12:00:00Z' } }, { type: 'complete', source: 'manual' }])
                    doc = copy(adapter.prepare(engine, doc, { executionId: 'execution', at: '2030-01-07T12:00:00Z', context: { eventId: 'e', date: '2030-01-07', seriesId: 'series', revisionId: 'five-original' }, action }).after);
                doc.logs.old = { completed: false, checkedSteps: ['unknown'], note: 'Legacy note', evidences: [{ id: 'old-photo', kind: 'image', src: pixel, caption: 'Legacy', createdAt: '2030-01-07T12:00:00Z' }] };
                doc = copy(compat.adopt(doc, 'old', { id: 'adopt', at: '2030-01-08T12:00:00Z', confirm: true, reason: 'Voluntary', executionId: 'adopted', routineId: 'r', expectedDefinition: doc.routines[0], context: { eventId: 'e', date: '2030-01-08', seriesId: 'adopt-series', revisionId: 'adopt-revision' } }).after);
                const initial = copy(doc), opts = { factory: indexedDB, name: 'fullhouse-lab-routines-scoped', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => ({ main: null, alias: null }) }, db = H.createLineageDatabase(opts), old = H.createLabDatabase({ ...opts, name: opts.name + '-reference' }), plan = await H.storageModel.prepareDocument(doc, L);
                await db.commit(plan, { id: 'seed' });
                await old.commit(plan, { id: 'seed' });
                const reference = H.createCompatSession({ database: old, compat, legacy: L, plannerActions: H.plannerActions, engine }), session = H.createRoutinesSession(db.incremental);
                await reference.open();
                await session.open();
                const ctx = (id, extra = {}) => ({ operationId: id, today: '2030-01-09', at: '2030-01-09T12:00:00Z', ids: [], ...extra }), operations = [];
                async function equivalent(method, payload, c) {
                    const expected = await reference.plan(method, payload, c);
                    if (expected.pending)
                        throw Error('Reference failed ' + expected.pending.error);
                    const actual = await session.save(method, payload, c);
                    if (actual.pending)
                        throw Error('Scoped failed ' + actual.pending.error);
                    const state = await db.open(), expectedPlan = await H.storageModel.prepareDocument(expected.confirmed, L);
                    if (state.status !== 'ready' || state.head.rootHash !== expectedPlan.rootHash)
                        throw Error('Parity mismatch ' + c.operationId);
                    const current = await H.storageModel.hydrate(state.plan, L);
                    if (canonical(current.logs) !== canonical(initial.logs) || canonical(current.recipeRevisions) !== canonical(initial.recipeRevisions))
                        throw Error('Historical content changed');
                    operations.push(c.operationId);
                }
                await equivalent('saveRoutine', { id: '', title: ' New routine ', desc: 'Description', steps: [{ id: 'n', title: ' Step ', min: 10, goalId: 'goal', requestEvidence: true }] }, ctx('create', { ids: ['new-routine'] }));
                let draft = copy(doc.routines[0]);
                draft.title = ' Renamed ';
                draft.desc = 'Edited description';
                draft.color = '#123456';
                await equivalent('saveRoutine', draft, ctx('rename'));
                draft.steps.push(...Array.from({ length: 3 }, (_, i) => ({ id: 'extra' + i, title: 'Added ' + i, min: 10, goalId: i ? 'goal' : 'other-goal' })));
                await equivalent('saveRoutine', draft, ctx('add-three'));
                if ((await db.incremental.readExecution(session.state().confirmed, 'e@2030-01-07')).log.history.resolution.unitStepIds.length !== 5)
                    throw Error('Historical denominator reinterpreted');
                draft.steps.reverse();
                draft.steps[0].children = [{ id: 'sub-a', title: 'A', min: 3 }, { id: 'sub-b', title: 'B', min: 7, goalId: 'other-goal' }];
                await equivalent('saveRoutine', draft, ctx('reorder'));
                draft.steps[0].children.reverse();
                await equivalent('saveRoutine', draft, ctx('substeps'));
                draft.steps = draft.steps.filter(s => s.id !== 's0');
                await equivalent('saveRoutine', draft, ctx('remove-step'));
                draft.steps.find(s => s.id === 's1').variants[0].title = 'Changed option';
                draft.steps.find(s => s.id === 's1').variants[0].min = 15;
                const alt = draft.steps[1];
                alt.mode = 'alternatives';
                alt.chooseWhen = 'weekday';
                alt.days = [0, 2, 3, 4, 5, 6];
                alt.variants = [{ id: 'monday', title: 'Monday', desc: 'Alternative', min: 20, days: [1], goalId: 'other-goal' }];
                await equivalent('saveRoutine', draft, ctx('weekday-variant'));
                draft.steps[2].mode = 'selected';
                draft.steps[2].days = [1, 3, 5];
                await equivalent('saveRoutine', draft, ctx('selected-days'));
                alt.chooseWhen = 'execute';
                alt.flexible = true;
                alt.variants[0].days = [];
                alt.variants[0].flexible = true;
                draft.durationMode = 'fixed';
                draft.durationMin = 120;
                await equivalent('saveRoutine', draft, ctx('fixed-flexible'));
                const before = session.state().confirmed;
                let rejected = false;
                try {
                    await session.save('saveRoutine', { ...draft, durationMin: 1 }, ctx('too-short'));
                }
                catch {
                    rejected = true;
                }
                if (!rejected || session.state().confirmed !== before)
                    throw Error('Invalid duration persisted');
                const relation = await session.readRoutine('r');
                if (relation.captureCount !== 2 || !relation.related.some(r => r.key === 'other-goal'))
                    throw Error('Missing indexed relationships');
                if (stage === 'edit') {
                    db.close();
                    old.close();
                    return { width: innerWidth, operations: operations.length, historyFive: true, relations: true, checkpoint: true };
                }
                for (const fault of ['before-writes', 'after-records', 'lost-ack']) {
                    const before = session.state().confirmed;
                    session.setDraft('routineTitle', 'Unsubmitted');
                    await session.save('saveRoutine', { ...draft, title: 'Fault ' + fault }, ctx('fault-' + fault), { fault });
                    if (!session.state().pending || session.state().confirmed !== before)
                        throw Error('Failed write presented confirmed');
                    const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L);
                    if (packet.metadata.drafts.routineTitle !== 'Unsubmitted')
                        throw Error('Lost draft');
                    await session.retry();
                    if (session.state().pending || session.state().confirmed.generation !== before.generation + 1)
                        throw Error('Duplicate retry');
                }
                await session.save('saveRoutine', { ...draft, title: 'Recovered' }, ctx('recover'), { fault: 'before-writes' });
                const packet = await H.recoveryBinary.inspectRecovery(await session.exportPending(), L), fresh = H.createLineageDatabase(opts), resumed = H.createRoutinesSession(fresh.incremental);
                await resumed.open();
                await resumed.resume(packet);
                await resumed.retry();
                if (resumed.state().pending)
                    throw Error('Recovery failed');
                session.cancel();
                const token = (await db.incremental.openWindow()).token, second = (await fresh.incremental.openWindow()).token, a = await db.incremental.prepareRoutine(token, 'saveRoutine', { ...draft, title: 'One' }, ctx('one')), b = await fresh.incremental.prepareRoutine(second, 'saveRoutine', { ...draft, title: 'Two' }, ctx('two'));
                await db.incremental.commitRoutine(a);
                let stale = false;
                try {
                    await fresh.incremental.commitRoutine(b);
                }
                catch {
                    stale = true;
                }
                if (!stale)
                    throw Error('Stale write accepted');
                fresh.close();
                const captured = (await db.incremental.readExecution((await db.incremental.openWindow()).token, 'e@2030-01-07'));
                if (captured.revision.definition.steps.find(s => s.id === 's1').variants[0].title !== 'Original option' || captured.log.choices.s1 !== 'old-option')
                    throw Error('Resolved alternative reinterpreted');
                const branch = H.createLineageDatabase({ ...opts, name: opts.name + '-future-capture' });
                await branch.commit((await db.open()).plan, { id: 'branch' });
                const bt = (await branch.incremental.openWindow()).token, command = { executionId: 'future', operationId: 'future', editId: 'future', at: '2030-01-10T12:00:00Z', reason: 'New capture', context: { eventId: 'e', date: '2030-01-10', seriesId: 'series', revisionId: 'five-original' }, action: { type: 'note', text: 'Future' } };
                let reusedRevision = false;
                try {
                    await branch.incremental.prepareExecution(bt, 'e@2030-01-10', command);
                }
                catch {
                    reusedRevision = true;
                }
                if (!reusedRevision)
                    throw Error('Reused revision for different definition');
                const future = await branch.incremental.prepareExecution(bt, 'e@2030-01-10', { ...command, context: { ...command.context, revisionId: 'fresh-definition' } });
                await branch.incremental.commitExecution(future);
                const bs = await branch.open();
                if (bs.status !== 'ready' || !bs.plan.tables.revisions.some(r => r.key === 'fresh-definition'))
                    throw Error('Fresh revision missing');
                branch.close();
                const deletion = await db.incremental.prepareRoutine((await db.incremental.openWindow()).token, 'deleteRoutine', { id: 'r' }, ctx('delete', { confirm: true }));
                await db.incremental.commitRoutine(deletion);
                const deleted = await db.open();
                if (deleted.plan.tables.routines.some(r => r.key === 'r'))
                    throw Error('Routine not deleted');
                const read = await db.incremental.readRoutine((await db.incremental.openWindow()).token, 'r');
                if (read.routine !== null || read.captureCount !== 2 || read.revisionCount < 1)
                    throw Error('Deleted history inaccessible');
                const finalDoc = await H.storageModel.hydrate(deleted.plan, L);
                if (canonical(finalDoc.logs) !== canonical(initial.logs) || canonical(finalDoc.recipeRevisions) !== canonical(initial.recipeRevisions))
                    throw Error('Deletion lost history');
                const archive = await H.storageArchive.exportArchive(deleted.plan, L), target = H.createLineageDatabase({ ...opts, name: opts.name + '-restore' });
                await target.commit(await H.storageArchive.importArchive(archive, L), { id: 'restore', confirmRestore: true });
                const restored = await target.open();
                if (restored.head.rootHash !== deleted.head.rootHash)
                    throw Error('Restore mismatch');
                const photo = await target.readEvidence('execution:execution', 'photo'), original = await db.readEvidence('execution:execution', 'photo');
                if (await H.storageModel.bytesHash(photo.blob) !== await H.storageModel.bytesHash(original.blob))
                    throw Error('Photo bytes changed');
                target.close();
                db.close();
                old.close();
                return { width: innerWidth, operations: operations.length, rejected, stale, historyFive: true, legacyAdopted: true, deletion: true, recovery: true, restore: true };
            }, process.env.FULLHOUSE_ROUTINES_STAGE || 'all');
            assert.ok(result.historyFive);
            assert.deepEqual(errors, []);
            results.push(result);
            await context.close();
        }
        console.log(JSON.stringify({ base: '0e9e25c', browser: browser.version(), results }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
