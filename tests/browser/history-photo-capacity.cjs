'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        const context = await browser.newContext({ viewport: { width: 1280, height: 950 } }), page = await context.newPage();
        await page.goto(url + '/storage');
        const result = await page.evaluate(async () => {
            const H = FullhouseHistory, L = H.schedule.validData, copy = x => JSON.parse(JSON.stringify(x)), doc = copy(H.scenarios(H).list.find(x => x.id === 'partial').doc), template = copy(Object.values(doc.logs)[0]);
            doc.logs = {};
            for (let i = 0; i < 1095; i++) {
                const date = new Date(Date.UTC(2030, 0, 7 + i)).toISOString().slice(0, 10), log = copy(template);
                log.evidences = [];
                Object.assign(log.history.capture, { executionId: 'year-' + i, scheduledDate: date, capturedAt: date + 'T12:00:00Z' });
                log.history.state.lastRecordedAt = date + 'T12:00:00Z';
                doc.logs['e@' + date] = log;
            }
            for (let i = 0; i < 500; i++) {
                const r = copy(doc.recipeRevisions.revision);
                r.id = 'revision-' + i;
                r.definition.title = 'Synthetic ' + i;
                doc.recipeRevisions[r.id] = r;
            }
            const keys = Object.keys(doc.logs), sizes = {};
            function image(seed, width, type = 'image/jpeg') { const c = document.createElement('canvas'); c.width = width; c.height = width; const x = c.getContext('2d'), data = x.createImageData(width, width); for (let i = 0; i < data.data.length; i += 4) {
                seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
                data.data[i] = seed & 255;
                data.data[i + 1] = (seed >>> 8) & 255;
                data.data[i + 2] = (seed >>> 16) & 255;
                data.data[i + 3] = 255;
            } x.putImageData(data, 0, 0); const src = c.toDataURL(type, .66), bytes = atob(src.slice(src.indexOf(',') + 1)).length; sizes[width] = (sizes[width] || 0) + bytes; return src; }
            for (let n = 0; n < 365; n++) {
                const key = keys[730 + n], log = doc.logs[key];
                log.evidences = [{ id: 'daily', kind: 'image', src: image(n + 1, 320), caption: 'Daily synthetic', createdAt: log.history.capture.capturedAt }];
                if (n % 30 === 0)
                    log.evidences.push({ id: 'monthly', kind: 'image', src: image(n + 1000, 1100), caption: 'Large synthetic', createdAt: log.history.capture.capturedAt });
            }
            doc.logs[keys.at(-1)].evidences.push({ id: 'png', kind: 'image', src: image(9999, 640, 'image/png'), caption: 'Synthetic PNG', createdAt: doc.logs[keys.at(-1)].history.capture.capturedAt });
            const worker = H.createWorkerPort(() => new Worker('/history-worker.js'));
            let at = performance.now();
            const plan = await worker.run('prepare', 'prepare', doc), prepareMs = performance.now() - at, db = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-photo-years', legacy: L, schedule: H.schedule });
            at = performance.now();
            await db.commit(plan, { id: 'seed' });
            const commitMs = performance.now() - at, opened = await db.incremental.openWindow();
            at = performance.now();
            const file = await worker.run('export', 'export', (await db.open()).plan), exportMs = performance.now() - at;
            at = performance.now();
            const imported = await worker.run('import', 'import', file), importMs = performance.now() - at, destination = H.createLabDatabase({ factory: indexedDB, name: 'fullhouse-lab-photo-years-restored', legacy: L });
            await destination.commit(imported, { id: 'restore' });
            const restored = await destination.open();
            if (restored.head.rootHash !== (await db.open()).head.rootHash)
                throw Error('Photos or facts lost');
            const statistics = await db.incremental.statistics(opened.token);
            worker.close();
            db.close();
            destination.close();
            return { executions: 1095, revisions: 501, dailyPhotos: 365, monthlyPhotos: 13, photos: plan.images.length, bytes: plan.images.reduce((n, i) => n + i.size, 0), sizes, archiveBytes: file.size, prepareMs, commitMs, exportMs, importMs, statistics, allPhotoHashesVerified: true };
        });
        assert.equal(Object.values(result.sizes).reduce((n, v) => n + v, 0), result.bytes);
        assert.equal(result.photos, 379);
        assert.ok(result.bytes > 15000000);
        assert.equal(result.statistics.recorded.executions, 1095);
        console.log(JSON.stringify({ base: '35ca45c', browser: browser.version(), viewport: 1280, cases: 4, result }, null, 2));
        await context.close();
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
