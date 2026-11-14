'use strict';
const {chromium}=require('playwright');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{
  const {server,url}=await start();let browser;let combinations=0;
  try{
    browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC'}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.addInitScript(()=>{
        // Cualquier lectura/escritura real, incluso preferencias, debe hacer fallar la prueba.
        window.storageAttempts=[];
        for(const name of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[name]=function(){window.storageAttempts.push(name);throw new Error('Laboratorio sin almacenamiento');};
      });
      await page.goto(url);await page.getByRole('heading',{name:'Laboratorio histórico v2',exact:true}).waitFor();
      const select=id=>page.locator('#scenario').selectOption(id);
      const tab=name=>page.getByRole('button',{name,exact:true}).click();
      for(const theme of ['aurora','ocean','sunset','forest','midnight']){
        await page.locator('#theme').selectOption(theme);
        for(const id of ['edited','durations','deleted','partial','pending','continued','corrected','legacy','statistics','recurring','review','broken']){
          await select(id);await tab('Mi día');await tab('Archivo');
          await tab('Detalle');await page.locator('#content article').first().waitFor();
          if(id==='edited'){assert.equal(await page.locator('[data-step]').count(),2);assert.equal(await page.locator('#content h2').last().textContent(),'Actividad original');}
          if(id==='durations'){assert.match(await page.locator('#content').innerText(),/Alternativa del lunes/);assert.match(await page.locator('#content').innerText(),/50 min/);}
          if(id==='deleted')assert.equal(await page.locator('[data-kind=historical]').count(),1);
          if(id==='partial'){assert.match(await page.locator('#content').innerText(),/Pasos: 1\/2/);assert.equal(await page.locator('img').count(),1);}
          if(id==='pending'){assert.match(await page.locator('#content').innerText(),/Alternativa pendiente/);assert.match(await page.locator('#content').innerText(),/Duración prevista: desconocida/);}
          if(id==='continued'){assert.match(await page.locator('#content').innerText(),/Fecha original: 2030-01-07/);assert.match(await page.locator('#content').innerText(),/Continuación: 2030-01-08/);}
          if(id==='corrected'){
            assert.equal(await page.locator('img').count(),1);await page.locator('details summary').first().click();await page.locator('details summary').last().click();
            const text=await page.locator('#content').innerText();assert.match(text,/Completado anterior: 2030-01-07T12:00:00Z/);assert.match(text,/parent: __base → other/);assert.match(text,/Marca conservada de rama inactiva/);assert.equal(await page.locator('a[href^="#evidence"]').count(),2);
          }
          if(id==='legacy'){
            assert.match(await page.locator('#content').innerText(),/Registro heredado/);assert.equal(await page.locator('[data-step]').count(),0);
            await page.locator('#estimate').check();assert.match(await page.locator('#content').innerText(),/Reconstrucción estimada/);assert.equal(await page.locator('[data-step]').count(),2);
          }
          if(id==='broken'){assert.equal(await page.locator('[data-kind=incomplete]').count(),1);assert.equal(await page.locator('[data-step]').count(),0);assert.equal(await page.locator('img').count(),1);}
          for(const image of await page.locator('img').all())assert.equal(await image.evaluate(img=>img.complete && img.naturalWidth>0),true);
          await tab('Horario');await tab('Calendario');await tab('Progreso');
          if(id==='statistics'){assert.match(await page.locator('[data-metric=steps]').innerText(),/1\/2/);assert.match(await page.locator('[data-metric=executions]').innerText(),/0\/1/);assert.match(await page.locator('[data-metric=scheduled]').innerText(),/2/);}
          if(id==='legacy')assert.match(await page.locator('[data-metric=steps]').innerText(),/0\/0/);
          if(id==='recurring'){await tab('Horario');assert.equal(await page.locator('#content article').count(),0);await page.locator('#date').fill('2030-01-07');await page.locator('#date').dispatchEvent('change');assert.equal(await page.locator('#content article').count(),1);}
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,'Sin desbordamiento horizontal');
          combinations++;
        }
        if(process.env.FULLHOUSE_HISTORY_SCREENSHOTS){fs.mkdirSync(process.env.FULLHOUSE_HISTORY_SCREENSHOTS,{recursive:true});await select('corrected');await tab('Detalle');await page.screenshot({path:path.join(process.env.FULLHOUSE_HISTORY_SCREENSHOTS,theme+'-'+width+'.png'),fullPage:true});}
      }
      assert.deepEqual(await page.evaluate(()=>window.storageAttempts),[]);assert.deepEqual(errors,[]);await context.close();
    }
    console.log('Chromium: '+combinations+' combinaciones (12 escenarios × 5 paletas × escritorio/móvil), sin errores JS ni acceso a storage.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
