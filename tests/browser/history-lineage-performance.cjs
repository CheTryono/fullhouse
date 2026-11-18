'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
        const page = await browser.newPage();
        await page.addInitScript(() => { for (const k of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[k] = () => { throw Error('Public storage forbidden'); }; });
        await page.goto(url + '/storage');
        const result = await page.evaluate(async () => {
            const H = FullhouseHistory, L = H.schedule.validData, now = () => performance.now(), heapSample = () => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null, copy = x => JSON.parse(JSON.stringify(x)), doc = copy(H.scenarios(H).list.find(s => s.id === 'partial').doc), template = copy(Object.values(doc.logs)[0]);
            doc.logs = {};
            for (let i = 0; i < 5000; i++) {
                const date = new Date(Date.UTC(2030, 0, 7 + i)).toISOString().slice(0, 10), log = copy(template);
                log.evidences = [];
                Object.assign(log.history.capture, { executionId: 'execution-' + i, scheduledDate: date, capturedAt: date + 'T12:00:00Z' });
                log.history.state.lastRecordedAt = date + 'T12:00:00Z';
                doc.logs['e@' + date] = log;
            }
            for (let i = 0; i < 500; i++) {
                const r = copy(Object.values(doc.recipeRevisions)[0]);
                r.id = 'revision-' + i;
                r.definition.title = 'Version ' + i;
                doc.recipeRevisions[r.id] = r;
            }
            const keys = Object.keys(doc.logs), canvas = document.createElement('canvas');
            canvas.width = 1100;
            canvas.height = 1100;
            const ctx = canvas.getContext('2d');
            for (let n = 0; n < 64; n++) {
                const image = ctx.createImageData(1100, 1100);
                let seed = n + 1;
                for (let i = 0; i < image.data.length; i += 4) {
                    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                    image.data[i] = seed & 255;
                    image.data[i + 1] = (seed >>> 8) & 255;
                    image.data[i + 2] = (seed >>> 16) & 255;
                    image.data[i + 3] = 255;
                }
                ctx.putImageData(image, 0, 0);
                const date = keys[n].slice(-10);
                doc.logs[keys[n]].evidences = [{ id: 'photo', kind: 'image', src: canvas.toDataURL('image/jpeg', .66), caption: 'Noise synthetic ' + n, createdAt: date + 'T12:00:00Z' }];
            }
            const png = canvas.toDataURL('image/png');
            doc.logs[keys[64]].evidences = [{ id: 'png', kind: 'image', src: png, caption: 'Large synthetic PNG', createdAt: doc.logs[keys[64]].history.capture.capturedAt }];
            doc.logs[keys[65]].evidences = copy(doc.logs[keys[64]].evidences);
            doc.logs.old = { completed: false, checkedSteps: ['unknown'], note: 'Synthetic original' };
            const raw = JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: doc.logs.old } }), copies = { main: raw, alias: null }, common = { factory: indexedDB, legacy: L, schedule: H.schedule }, before = H.createLabDatabase({ ...common, name: 'fullhouse-lab-lineage-perf-before' }), after = H.createLineageDatabase({ ...common, name: 'fullhouse-lab-lineage-perf-after', readSources: () => copies });
            const proposal = await H.storageSources.proposeMigration(copies, 'main', L);
            await after.stageMigration(proposal, { id: 'migration' });
            await after.finalizeMigration('migration', { confirm: true });
            const genesis = await after.open();
            const plan = await H.storageModel.prepareDocument(doc, L);
            await before.commit(plan, { id: 'seed' });
            await after.commit({ ...plan, sourceBackups: genesis.plan.sourceBackups }, { id: 'seed', expected: genesis.head });
            let mark = now(), a = await before.incremental.openWindow(), beforeOpenMs = now() - mark;
            mark = now();
            let b = await after.incremental.openWindow();
            const afterOpenMs = now() - mark, operations = [];
            for (const [kind, action] of [['step', { type: 'step', stepId: 'one', checked: false }], ['note', { type: 'note', text: 'Synthetic note' }], ['photo', { type: 'evidence', evidence: { id: 'perf-photo', kind: 'image', src: canvas.toDataURL('image/jpeg', .79), caption: 'Synthetic', createdAt: '2030-01-07T13:00:00Z' } }]]) {
                const id = 'perf-' + kind, command = { executionId: 'execution-0', at: '2030-01-07T13:00:00Z', editId: id, operationId: id, reason: 'Benchmark', action };
                const row = { kind };
                for (const [label, db, window] of [['before', before, a], ['after', after, b]]) {
                    mark = now();
                    const op = await db.incremental.prepareExecution(window.token, keys[0], command), prepareMs = now() - mark;
                    const saved = await db.incremental.commitExecution(op);
                    mark = now();
                    await db.incremental.readExecution(saved.token, keys[0]);
                    const readMs = now() - mark;
                    row[label] = { prepareMs, transactionMs: saved.transactionMs, lineagePrepareMs: saved.lineagePrepareMs, lineageAfterMs: saved.lineageAfterMs, confirmationMs: saved.confirmationMs, readMs, root: saved.receipt.rootHash };
                    if (label === 'before')
                        a = saved;
                    else
                        b = saved;
                }
                if (row.before.root !== row.after.root)
                    throw Error('Facts mismatch');
                operations.push(row);
            }
            const auditAt = now();
            await after.auditLineage();
            const lineageAuditMs = now() - auditAt;
            const left = await before.incremental.readPhoto(a.token, 'execution:execution-0', 'photo'), right = await after.incremental.readPhoto(b.token, 'execution:execution-0', 'photo');
            if (await H.storageModel.bytesHash(left.blob) !== await H.storageModel.bytesHash(right.blob))
                throw Error('Photo bytes changed');
            const statsAt = now(), statistics = await after.incremental.statistics(b.token), statisticsMs = now() - statsAt, heap = heapSample();
            before.close();
            after.close();
            return { executions: 5000, legacy: 1, revisions: 501, images: plan.images.length, assetBytes: plan.images.reduce((n, i) => n + i.size, 0), sourceBytes: raw.length * 2, beforeOpenMs, afterOpenMs, operations, lineageAuditMs, statisticsMs, statistics, heap, photoHashesEqual: true };
        });
        assert.equal(result.executions, 5000);
        assert.ok(result.assetBytes > 42000000);
        console.log(JSON.stringify({ browser: browser.version(), base: 'd1dae11', comparison: 'previous native incremental versus migrated lineage incremental; same fact roots and blobs; one sample per operation; desktop viewport', result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
