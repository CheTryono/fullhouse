'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
const { start } = require('../../scripts/serve-history-lab.cjs');
(async () => {
    const { server, url } = await start();
    let browser, cases = 0;
    try {
        browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
        for (const width of [1280, 390])
            for (const theme of ['aurora', 'ocean', 'sunset', 'forest', 'midnight']) {
                const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }), page = await context.newPage(), errors = [];
                page.on('pageerror', e => errors.push(e.message));
                await page.addInitScript(() => {
                    window.publicStorage = [];
                    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'])
                        Storage.prototype[method] = function () { publicStorage.push(method); throw Error('Storage público prohibido'); };
                });
                await page.goto(url + '/readiness');
                await page.selectOption('#theme', theme);
                assert.equal(await page.locator('#lab').getAttribute('data-theme'), theme);
                const state = () => page.evaluate(() => readinessLab.state());
                const click = async (id) => { await page.locator('#' + id).click(); await page.waitForFunction(() => document.getElementById('confirm-dialog').open || !readinessLab.state().busy); };
                await click('seed');
                assert.equal((await state()).token.generation, 1);
                cases++;
                await click('fail');
                await page.fill('#note', 'Pendiente sintético');
                await click('save-note');
                assert.ok((await state()).pending);
                const id = (await state()).pending.id;
                assert.equal((await state()).token.generation, 1);
                const download = page.waitForEvent('download');
                await click('export-pending');
                const downloaded = await download;
                await page.setInputFiles('#recovery-file', await downloaded.path());
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.equal((await state()).packet.meaning, 'pending-not-confirmed');
                cases++;
                await click('cancel');
                assert.equal(await page.locator('#confirm-dialog').evaluate(d => d.open), true);
                await page.locator('#dialog-cancel').click();
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.ok((await state()).pending);
                await click('cancel');
                await page.locator('#dialog-confirm').click();
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.equal((await state()).pending, null);
                assert.equal((await state()).token.generation, 1);
                await click('resume');
                assert.equal((await state()).pending.id, id);
                await click('retry');
                assert.equal((await state()).pending, null);
                assert.equal((await state()).token.generation, 2);
                assert.match(await page.locator('#status').innerText(), /Guardado confirmado/);
                cases++;
                await click('lost-ack');
                await page.fill('#note', 'Acuse perdido');
                await click('save-note');
                assert.ok((await state()).pending);
                await click('cancel');
                assert.match(await page.locator('#dialog-text').innerText(), /ya tiene recibo/);
                await page.locator('#dialog-confirm').click();
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.equal((await state()).pending, null);
                assert.equal(await page.inputValue('#note'), 'Acuse perdido');
                cases++;
                await click('show-photo');
                assert.ok(await page.locator('#lazy-photo img').evaluate(image => image.complete && image.naturalWidth > 0));
                await click('statistics');
                assert.match(await page.locator('#stats').innerText(), /recorded/);
                await click('privacy');
                assert.match(await page.locator('#privacy-report').innerText(), /proposal-only/);
                cases++;
                const rawDownload = page.waitForEvent('download');
                await click('export-originals');
                const raw = fs.readFileSync(await (await rawDownload).path());
                assert.ok(raw.subarray(0, 23).toString().startsWith('FULLHOUSE-DIAGNOSTIC-1'));
                const complete = page.waitForEvent('download');
                await click('export-confirmed');
                assert.ok(fs.statSync(await (await complete).path()).size > 100);
                await click('restore-new');
                await page.locator('#dialog-confirm').click();
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.match(await page.locator('#restored').innerText(), /destino nuevo/);
                await click('forget-packet');
                await page.locator('#dialog-confirm').click();
                await page.waitForFunction(() => !readinessLab.state().busy);
                assert.equal((await state()).packet, null);
                cases++;
                await page.fill('#note', 'Borrador no confirmado');
                await page.locator('#note').focus();
                await page.keyboard.press('Tab');
                assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
                const before = page.waitForEvent('dialog'), nav = page.reload({ timeout: 1500 }).catch(() => null);
                const dialog = await before;
                assert.equal(dialog.type(), 'beforeunload');
                await dialog.dismiss();
                await nav;
                assert.equal(await page.inputValue('#note'), 'Borrador no confirmado');
                cases++;
                assert.deepEqual(errors, []);
                assert.deepEqual(await page.evaluate(() => publicStorage), []);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
                assert.notEqual(id, undefined);
                await context.close();
            }
        console.log('Chromium preparación UI: ' + cases + ' casos, cinco paletas × escritorio/móvil, cero Storage público/errores JS.');
    }
    finally {
        if (browser)
            await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
