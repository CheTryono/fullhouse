'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{const {server,url}=await start();let browser;let cases=0;
try{
  browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC',acceptDownloads:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{window.storageAttempts=[];for(const name of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[name]=function(){window.storageAttempts.push(name);throw Error('Storage público prohibido');};});
    await page.goto(url+'/integration');await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('"confirmed": true'));
    async function click(id){await page.locator('#'+id).click();await page.waitForFunction(()=>!document.getElementById('status').textContent.startsWith('Procesando'));}
    const status=()=>page.locator('#status').innerText(),summary=async()=>JSON.parse(await page.locator('#summary').innerText()),pending=async()=>JSON.parse(await page.locator('#pending').innerText());
    async function reset(){await click('reset');assert.equal((await summary()).logs,0);}
    async function recoveryExport(){const download=page.waitForEvent('download');await click('recovery-export');await download;return JSON.parse(await page.locator('#recovery-data').innerText());}
    // 1. Flujo real de nota/pasos/captura; 2. escritura fallida, borrador y reintento.
    await page.locator('#note').fill('Nota confirmada');await click('save-note');assert.deepEqual((await summary()).notes,['Nota confirmada']);cases++;
    await reset();await click('fail-write');await page.locator('#note').fill('Nota pendiente');await click('save-note');assert.equal((await summary()).logs,0);assert.equal((await pending()).pending,true);assert.match(await status(),/Pendiente/);
    const dialogPromise=page.waitForEvent('dialog');const reload=page.reload().catch(()=>null);const dialog=await dialogPromise;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();await reload;assert.equal((await pending()).pending,true);
    const packet=await recoveryExport();assert.equal(JSON.parse(packet.pending).logs['e@2030-01-07'].note,'Nota pendiente');assert.equal(packet.drafts.note,'Nota pendiente');await click('retry');assert.deepEqual((await summary()).notes,['Nota pendiente']);cases++;
    // 3. Lectura posterior; 4. cuota, mismo candidato sin duplicación de fotos.
    await reset();await click('fail-read');await click('save-note');assert.equal((await summary()).logs,0);assert.equal((await pending()).pending,true);await click('retry');assert.equal((await summary()).logs,1);cases++;
    await reset();await click('quota');await click('photo');assert.equal((await pending()).pending,true);assert.equal((await summary()).logs,0);await click('restore-quota');await click('retry');assert.equal(await page.locator('#records img').count(),1);assert.equal(await page.locator('#records img').evaluate(img=>img.complete&&img.naturalWidth===64),true);cases++;
    // 5/6. Dos clientes compatibles y cliente v1 no cooperativo.
    await reset();await click('new-tab');await click('save-note');await click('other-write');assert.equal((await pending()).otherPending,true);assert.deepEqual((await summary()).notes,['Nota pendiente']);cases++;
    await reset();await click('old-tab');await click('save-note');assert.equal((await pending()).pending,true);assert.equal((await summary()).logs,0);assert.match((await pending()).error,/v1 cambió/);cases++;
    // 7/8. Cierre antes/después de manifiesto, solo recuperación explícita.
    for(const fault of ['before-manifest','after-manifest']){await reset();await click(fault);await click('save-note');assert.equal((await summary()).logs,0);assert.equal((await pending()).pending,true);await recoveryExport();await click('reopen-session');assert.match(await status(),/Recuperación/);await click('recover');assert.equal((await summary()).logs,1);assert.equal((await pending()).pending,false);cases++;}
    // 9. Respaldo inválido sin escritura.
    await reset();await click('invalid-import');assert.match(await status(),/Respaldo inválido/);assert.equal((await summary()).logs,0);cases++;
    // 10. Exportación completa con foto y lectura recuperable.
    await reset();await click('photo');const downloadPromise=page.waitForEvent('download');await click('export');const download=await downloadPromise;const fs=require('node:fs');const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.version,2);assert.equal(backup.logs['e@2030-01-07'].evidences.length,1);assert.ok(backup.logs['e@2030-01-07'].evidences[0].src.startsWith('data:image/jpeg'));await click('restore-export');assert.equal(await page.locator('#records img').count(),1);assert.equal((await summary()).logs,1);cases++;
    // 11. Completado, edición posterior, reapertura y continuidad.
    await reset();await click('step-one');await click('step-two');assert.equal((await summary()).progress.executions.completed,1);await click('edit-routine');assert.equal((await summary()).progress.steps.total,2);await click('reopen');await click('continue');assert.equal((await summary()).logs,1);cases++;
    // 12. Reprogramación real y límites dependientes.
    await reset();await click('save-note');await click('reschedule');assert.equal((await summary()).logs,1);assert.equal((await pending()).pending,false);await reset();await click('dependencies');assert.doesNotMatch(await status(),/inexistente|inválido|rechazada|requiere ajustar/i);await click('save-note');assert.equal((await summary()).logs,1);const dependency=JSON.parse((await recoveryExport()).confirmed);const execution=Object.values(dependency.logs)[0];assert.equal(execution.history.capture.plan.durationMode,'between');assert.deepEqual(execution.history.capture.plan.window,{startMin:490,endMin:600});cases++;
    // 13. Legado conserva hechos, no adopción implícita.
    await reset();await click('legacy');await click('save-note');assert.match(await status(),/no se adopta|Registro existente/);assert.deepEqual((await summary()).notes,['Hechos heredados']);cases++;
    // 14. Alternativas corregidas conservan foto/marcas y checkpoint.
    await reset();await click('variants');await click('base');await click('step-one');await click('reopen');await click('photo');await click('other');assert.equal((await pending()).pending,false);assert.equal(await page.locator('#records img').count(),1);const corrected=await recoveryExport();const log=JSON.parse(corrected.confirmed).logs['e@2030-01-07'];assert.equal(log.history.corrections.length,2);assert.ok(log.checkedSteps.includes('one'));cases++;
    assert.deepEqual(await page.evaluate(()=>window.storageAttempts),[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await context.close();
  }
  console.log('Chromium integración: '+cases+' casos (14 × escritorio/móvil), cero Storage público y errores JS.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
