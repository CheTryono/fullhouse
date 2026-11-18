'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info'] });
        const page = await browser.newPage();
        await page.addInitScript(() => { for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
            Storage.prototype[method] = () => { throw Error('No public Storage'); }; });
        await page.goto(url + '/storage');
        const result = await page.evaluate(async () => {
            const H = FullhouseHistory, L = H.schedule.validData, doc = { version: 1, goals: [], routines: [], events: [], logs: { bulk: { completed: false, checkedSteps: [], note: 'S'.repeat(2 * 1024 * 1024) }, edit: { completed: false, checkedSteps: [], note: 'Synthetic' } } };
            let copies = { main: JSON.stringify(doc), alias: JSON.stringify(doc, null, 2) };
            const original = { ...copies }, db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-goals-lineage-stress', legacy: L, schedule: H.schedule, plannerActions: H.plannerActions, readSources: () => copies }), proposal = await H.storageSources.proposeMigration(copies, 'main', L);
            await db.stageMigration(proposal, { id: 'migration' });
            await db.finalizeMigration('migration', { confirm: true });
            let mark = performance.now(), opened = await db.incremental.openWindow(), openMs = performance.now() - mark, token = opened.token;
            const samples = [];
            for (let i = 0; i < 500; i++) {
                const id = 'stress-' + i;
                mark = performance.now();
                const op = await db.incremental.prepareExecution(token, 'edit', { id, at: '2030-01-07T12:00:00Z', reason: 'Stress', action: { type: 'note', text: 'Entry ' + i } }), prepareMs = performance.now() - mark, result = await db.incremental.commitExecution(op);
                if (result.status !== 'confirmed')
                    throw Error('Not confirmed');
                token = result.token;
                if ([0, 99, 249, 499].includes(i))
                    samples.push({ receipts: i + 2, prepareMs, transactionMs: result.transactionMs, lineagePrepareMs: result.lineagePrepareMs, confirmationMs: result.confirmationMs, lineageAfterMs: result.lineageAfterMs });
            }
            mark = performance.now();
            const authority = await db.auditLineage(), auditMs = performance.now() - mark;
            mark = performance.now();
            const goal = await db.incremental.preparePlanning(token, 'saveGoal', { id: '', title: 'Large-source goal', desc: '', parentId: '', color: '#888888', current: 0, target: 10, unit: '', review: { date: '2030-01-07', time: '18:00', repeat: 'weekly' } }, { operationId: 'goal-after-chain', today: '2030-01-07', at: '2030-01-07T12:00:00Z', ids: ['g'] }), goalPrepareMs = performance.now() - mark, goalSaved = await db.incremental.commitPlanning(goal);
            const goalAfterChain = { prepareMs: goalPrepareMs, transactionMs: goalSaved.transactionMs, lineagePrepareMs: goalSaved.lineagePrepareMs, confirmationMs: goalSaved.confirmationMs, lineageAfterMs: goalSaved.lineageAfterMs };
            if (goalSaved.status !== 'confirmed')
                throw Error('Goal after chain not confirmed');
            db.close();
            mark = performance.now();
            const reopened = await db.open(), reopenMs = performance.now() - mark;
            if (reopened.status !== 'ready' || reopened.head.generation !== 502)
                throw Error('Chain not durable');
            copies = { ...copies, alias: copies.alias + ' ' };
            let blocked = false;
            try {
                const op = await db.incremental.prepareExecution((await db.incremental.openWindow()).token, 'edit', { id: 'changed', at: '2030-01-07T12:00:00Z', reason: 'No overwrite', action: { type: 'note', text: 'Blocked' } });
                await db.incremental.commitExecution(op);
            }
            catch {
                blocked = true;
            }
            copies = original;
            db.close();
            const conflict = await db.open();
            if (!blocked || conflict.status !== 'recovery')
                throw Error('Conflict disappeared');
            const dump = await db.sourceRecovery();
            db.close();
            return { sourceBytesUTF16: (original.main.length + original.alias.length) * 2, receipts: goalSaved.receipt.generation, executionReceipts: authority.authority.tip.generation, goalAfterChain, openMs, reopenMs, auditMs, samples, conflictPersistent: !!dump.state.conflict, heap: performance.memory?.usedJSHeapSize };
        });
        assert.equal(result.receipts, 502);
        assert.ok(result.conflictPersistent);
        console.log(JSON.stringify({ base: 'cc1d901', browser: browser.version(), result }, null, 2));
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
