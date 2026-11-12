// Real React/controller + DOM checks; no production test hooks or private user data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { DAY, emptyData, routine, step, event } = require('../helpers/app.cjs');
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
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'UTC', acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // ReactDOM.render's public return value is the mounted root controller.
      // The ±15 controls are currently unreachable in the normal UI, so this
      // test-only wrapper captures that real instance without editing production.
      await page.addInitScript(() => {
        Object.defineProperty(window, 'ReactDOM', { configurable: true, set(library) {
          const render = library.render;
          library.render = function(...args) { const instance = render.apply(this, args); window.shiftTestController = instance; return instance; };
          Object.defineProperty(window, 'ReactDOM', { configurable: true, writable: true, value: library });
        } });
      });
      await page.clock.setFixedTime(new Date('2030-01-07T12:00:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const data = { ...emptyData(),
        routines: [routine('a', { steps: [step('a-step', { min: 30 })] }), routine('b', { steps: [step('b-step', { min: 30 })] }),
          routine('middle', { steps: [step('fixed', { min: 80 }), step('flex', { flexible: true })] })],
        events: [event('late', { date: '2030-01-01', time: '23:00', minutes: 60, repeat: 'daily', overrides: { '2030-01-08': { time: '21:00' }, '2030-01-09': { skip: true } } }),
          event('early', { time: '00:05', minutes: 30 }), event('a', { routineId: 'a', time: '08:00' }), event('b', { routineId: 'b', time: '10:00' }),
          event('middle', { routineId: 'middle', anchor: 'between', afterRoutineId: 'a', beforeRoutineId: 'b' })],
        logs: { 'late@2030-01-06': { completed: true, checkedSteps: [], note: 'Synthetic historical note' } } };
      const original = JSON.stringify(data, null, 2);
      await page.evaluate(original => {
        localStorage.setItem('fullhouse-v01', original);
        localStorage.setItem('fullhouse-onboarding-v03', 'yes'); localStorage.setItem('fullhouse-theme-v02', 'midnight');
      }, original);
      await page.reload();
      await page.locator(width > 760 ? '.nav-item' : '.mobile-item').getByText('Horario', { exact: true }).click();
      const late = page.getByRole('button', { name: 'Acercar Synthetic late', exact: true });
      const stored = () => page.evaluate(() => localStorage.getItem('fullhouse-v01'));
      const shift = (id, delta) => page.evaluate(({ id, delta, date }) => {
        const controller = window.shiftTestController;
        if (!controller?.shiftEvent) throw Error('Mounted controller not captured');
        controller.shiftEvent(controller.state.data.events.find(e => e.id === id), date, delta);
      }, { id, delta, date: DAY });
      await late.waitFor(); assert.equal(await page.locator('.timeline-block').count(), 5);
      // Actual editor interaction: 23:00 -> 23:15 with 60 minutes cannot save.
      await late.click(); await page.getByRole('button', { name: 'Editar bloque', exact: true }).click();
      await page.getByRole('button', { name: 'Seleccionar minuto', exact: true }).click();
      await page.getByRole('option', { name: '15 min', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar actividad', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'hasta las 24:00' }).waitFor();
      assert.equal(await stored(), original);
      await page.locator('.modal-header button[aria-label="Cerrar"]').click();
      await page.getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
      await shift('late', 15); assert.equal(await stored(), original);
      await page.getByRole('status').filter({ hasText: 'Se conserva el horario anterior' }).waitFor();
      assert.match(await late.getAttribute('title'), /23:00/);
      await shift('late', -15); assert.match(await late.getAttribute('title'), /22:45/);
      await shift('late', 15); assert.match(await late.getAttribute('title'), /23:00/);
      assert.match(await page.locator('.schedule-zoom-panel .eyebrow').innerText(), /23:00.*24:00/);
      const exactEnd = await stored(); await shift('late', 15); assert.equal(await stored(), exactEnd);
      assert.equal(await late.evaluate(element => element.style.top), '1633px'); // 23 * 71 px/hour.
      await shift('early', -15);
      const early = page.getByRole('button', { name: 'Acercar Synthetic early', exact: true });
      assert.match(await early.getAttribute('title'), /00:00/);
      assert.equal(await early.evaluate(element => element.style.top), '0px');
      const beforeDependency = await stored(); await shift('a', 15);
      await page.getByRole('status').filter({ hasText: 'intervalo adecuado para los pasos' }).waitFor();
      assert.equal(await stored(), beforeDependency);
      assert.equal(await page.locator('.timeline-block').count(), 5);
      const snapshot = JSON.parse(await stored());
      assert.deepEqual(snapshot.logs, data.logs);
      assert.deepEqual(snapshot.events[0].overrides['2030-01-08'], { time: '21:00' });
      assert.deepEqual(snapshot.events[0].overrides['2030-01-09'], { skip: true });
      await page.getByTitle('Día siguiente', { exact: true }).click();
      assert.match(await late.getAttribute('title'), /21:00/);
      await page.getByTitle('Día anterior', { exact: true }).click();
      assert.match(await late.getAttribute('title'), /23:00/);
      // Valid movement + quota error: keep confirmed bytes and use BUG-01 queue.
      await page.evaluate(() => {
        const original = Storage.prototype.setItem; window.shiftStorageFault = true;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'fullhouse-v01' && window.shiftStorageFault) throw new DOMException('Synthetic quota', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      });
      const confirmed = await stored(); await shift('late', -15);
      await page.getByRole('heading', { name: 'Cambios pendientes de guardar', exact: true }).waitFor();
      assert.equal(await stored(), confirmed);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar cambios pendientes', exact: true }).click();
      const download = await downloadPromise;
      const pending = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      assert.equal(pending.events.find(e => e.id === 'late').overrides[DAY].time, '22:45');
      await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
      assert.equal(await stored(), confirmed);
      await page.evaluate(() => { window.shiftStorageFault = false; });
      await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
      await late.waitFor(); assert.match(await late.getAttribute('title'), /22:45/);
      assert.deepEqual(JSON.parse(await stored()), pending);
      await page.reload(); await page.locator(width > 760 ? '.nav-item' : '.mobile-item').getByText('Horario', { exact: true }).click();
      await late.waitFor(); assert.match(await late.getAttribute('title'), /22:45/);
      assert.deepEqual(errors, []);
      console.log(`PASS Chromium ${width}px: editor rejection, bounds/24:00, visible timeline, dependencies, date-only overrides/history, pending export/retry, no JS errors`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exit(1); });
