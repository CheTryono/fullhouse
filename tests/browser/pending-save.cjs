// Optional real-browser regression. NODE_PATH can point to an external Playwright installation.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { legacyBackup } = require('../fixtures/backups.cjs');
const root = path.resolve(__dirname, '../..');
const resources = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']],
  ['/logo.svg', ['logo.svg', 'image/svg+xml']],
  ['/vendor/react.production.min.js', ['vendor/react.production.min.js', 'text/javascript']],
  ['/vendor/react-dom.production.min.js', ['vendor/react-dom.production.min.js', 'text/javascript']],
]);
(async () => {
  const server = http.createServer((request, response) => {
    const resource = resources.get(new URL(request.url, 'http://localhost').pathname);
    if (!resource) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', resource[1]); response.end(fs.readFileSync(path.join(root, resource[0])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    for (const width of [1280, 390]) for (const writeError of ['QuotaExceededError', 'SecurityError']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'UTC', acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2030-01-07T12:00:00Z'));
      const url = `http://127.0.0.1:${server.address().port}/`;
      await page.goto(url);
      const before = legacyBackup(); before.logs = {};
      const bytes = JSON.stringify(before, null, 2);
      await page.evaluate(({ bytes, writeError }) => {
        localStorage.setItem('fullhouse-v01', bytes);
        localStorage.setItem('fullhouse-onboarding-v03', 'yes');
        localStorage.setItem('fullhouse-theme-v02', 'midnight');
      }, { bytes, writeError });
      await page.reload();
      await page.evaluate(writeError => {
        const original = Storage.prototype.setItem;
        window.storageFault = false;
        Storage.prototype.setItem = function(key, value) {
          if (window.storageFault && key === 'fullhouse-v01') throw new DOMException('Synthetic storage rejection', writeError);
          return original.call(this, key, value);
        };
      }, writeError);
      const stored = () => page.evaluate(() => localStorage.getItem('fullhouse-v01'));
      const nav = label => page.locator(width > 760 ? '.nav-item' : '.mobile-item').getByText(label, { exact: true }).click();
      const pending = () => page.getByRole('heading', { name: 'Cambios pendientes de guardar', exact: true });
      async function exportPending() {
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Exportar cambios pendientes', exact: true }).click();
        const download = await downloadPromise;
        return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      }
      async function attemptLeave(action) {
        const dialogPromise = page.waitForEvent('dialog');
        const attempt = action();
        const dialog = await dialogPromise;
        assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss(); await attempt;
        await pending().waitFor(); assert.equal(page.isClosed(), false);
      }
      async function retry() {
        await page.evaluate(() => { window.storageFault = false; });
        await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
        await page.locator('.page-title').waitFor();
      }
      // Real goal form: failed storage, no success, durable bytes unchanged.
      await page.getByRole('button').filter({ hasText: 'Nueva meta' }).click();
      await page.getByPlaceholder('Ej. Mejorar mi relación con mi familia').fill('Synthetic pending goal');
      // Dirty forms warn on reload even before pressing Save.
      const dirtyDialog = page.waitForEvent('dialog');
      const dirtyReload = page.evaluate(() => location.reload());
      const warning = await dirtyDialog; assert.equal(warning.type(), 'beforeunload'); await warning.dismiss(); await dirtyReload;
      assert.equal(await page.getByPlaceholder('Ej. Mejorar mi relación con mi familia').inputValue(), 'Synthetic pending goal');
      await page.evaluate(() => { window.storageFault = true; });
      await page.getByRole('button', { name: 'Guardar meta', exact: true }).click();
      await pending().waitFor(); assert.equal(await stored(), bytes);
      assert.doesNotMatch(await page.getByRole('status').innerText(), /Cambios guardados/);
      if (process.env.FULLHOUSE_PENDING_SCREENSHOT && width === 390 && writeError === 'QuotaExceededError') await page.screenshot({ path: process.env.FULLHOUSE_PENDING_SCREENSHOT, fullPage: true });
      const exported = await exportPending(); assert.equal(exported.goals.at(-1).title, 'Synthetic pending goal');
      assert.equal(await stored(), bytes);
      await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
      await pending().waitFor(); assert.equal(await stored(), bytes);
      await attemptLeave(() => page.evaluate(() => location.reload()));
      await attemptLeave(() => page.evaluate(() => { location.href = 'about:blank'; }));
      await attemptLeave(() => page.close({ runBeforeUnload: true }));
      await retry(); assert.deepEqual(JSON.parse(await stored()), exported);
      await page.reload(); await page.locator('.page-title').waitFor();
      assert.deepEqual(JSON.parse(await stored()), exported);
      // Reinstall the fault adapter after reload.
      await page.evaluate(writeError => {
        const original = Storage.prototype.setItem;
        window.storageFault = true;
        Storage.prototype.setItem = function(key, value) {
          if (window.storageFault && key === 'fullhouse-v01') throw new DOMException('Synthetic rejection', writeError);
          return original.call(this, key, value);
        };
      }, writeError);
      await nav('Mi día');
      const committed = await stored();
      await page.getByRole('button', { name: 'Marcar Synthetic step', exact: true }).click();
      await pending().waitFor(); assert.equal(await stored(), committed);
      assert.deepEqual((await exportPending()).logs['event@2030-01-07'].checkedSteps, ['step']);
      await retry();
      // Note draft warns before navigation; note action is exportable on failure.
      const collapsed = page.locator('.today-task-open[aria-expanded="false"]');
      if (await collapsed.count()) await collapsed.first().click();
      await page.locator('.today-extra-notes > summary').click();
      const note = page.locator('.today-extra-notes .day-note-editor');
      await note.getByRole('button', { name: 'Añadir nota', exact: true }).click();
      await note.locator('textarea').fill('Synthetic pending occurrence note');
      await nav('Metas'); await page.locator('.crumb strong').filter({ hasText: 'Mi día' }).waitFor();
      await note.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await note.locator('textarea').inputValue(), 'Synthetic pending occurrence note');
      await page.evaluate(() => { window.storageFault = true; });
      const preNote = await stored();
      await note.getByRole('button', { name: 'Guardar nota', exact: true }).click();
      await pending().waitFor(); assert.equal(await stored(), preNote);
      assert.equal((await exportPending()).logs['event@2030-01-07'].note, 'Synthetic pending occurrence note');
      await retry();
      // Daily review follows the same queue; cancellation of discard retains it.
      await page.locator('.daily-review textarea').fill('Synthetic pending day review');
      await page.evaluate(() => { window.storageFault = true; });
      const preReview = await stored();
      await page.getByRole('button', { name: 'Guardar revisión del día', exact: true }).click();
      await pending().waitFor(); assert.equal(await stored(), preReview);
      assert.equal((await exportPending()).dayReviews['2030-01-07'].note, 'Synthetic pending day review');
      await page.getByRole('button', { name: 'Descartar cambios pendientes', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await pending().waitFor(); await retry();
      assert.equal(JSON.parse(await stored()).dayReviews['2030-01-07'].note, 'Synthetic pending day review');
      // An unfinished numeric edit must warn before its blur updates the form.
      await nav('Rutinas');
      await page.getByRole('button', { name: 'Nueva rutina', exact: true }).click();
      await page.locator('.modal input[data-committed-value]').first().fill('6');
      const numberDialog = page.waitForEvent('dialog');
      const numberReload = page.evaluate(() => location.reload());
      const numberWarning = await numberDialog; assert.equal(numberWarning.type(), 'beforeunload');
      await numberWarning.dismiss(); await numberReload;
      await page.locator('.modal-header button[aria-label="Cerrar"]').click();
      await page.getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
      assert.deepEqual(errors, []);
      console.log(`PASS Chromium ${width}px ${writeError}: form, step, note, review, retry/export, reload/navigation/close warnings, no JS errors`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exit(1); });
