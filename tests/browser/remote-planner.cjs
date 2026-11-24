'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const origin='http://127.0.0.1:5012',password='Synthetic-Password-2030!';
const frame=page=>page.frameLocator('iframe:not([hidden])');
async function phase(page,name){await page.locator('[data-phase="'+name+'"]').waitFor();}
async function loginHere(page,uid){await page.getByLabel('Correo',{exact:true}).fill(uid+'@example.test');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await frame(page).locator('.app-shell').waitFor();await page.locator('iframe:not([hidden])').scrollIntoViewIfNeeded();const skip=frame(page).getByRole('button',{name:'Saltar tutorial',exact:true});if(await skip.isVisible())await skip.click();}
async function login(page,uid){await page.goto(origin);await loginHere(page,uid);}
async function draft(page,title){const f=frame(page);await f.getByRole('button',{name:'Metas',exact:true}).first().click();await f.getByRole('button',{name:'Crear meta',exact:true}).first().click();await f.locator('.modal-body input').first().fill(title);await page.locator('iframe:not([hidden])').scrollIntoViewIfNeeded();}
async function saveGoal(page,title){await draft(page,title);await frame(page).getByRole('button',{name:'Guardar meta',exact:true}).click();await phase(page,'confirmed');}
async function data(page){return frame(page).locator('body').evaluate(()=>mountedPlanner.state.data);}
(async()=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-fullhouse-remote');let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.evaluate(()=>{localStorage.setItem('fullhouse-v01','synthetic original');localStorage.setItem('botanica-planificador-v01','synthetic alias');});
  await login(page,'lab_A');await phase(page,'confirmed');assert.equal((await data(page)).goals.length,0);
  let release;await page.route('**/saveRemoteV1',async route=>{const response=await route.fetch();await new Promise(resolve=>{release=()=>{void route.fulfill({response}).then(resolve);};});},{times:1});
  await draft(page,'A confirmed only after receipt');await frame(page).getByRole('button',{name:'Guardar meta',exact:true}).click();await phase(page,'confirming');while(!release)await new Promise(r=>setImmediate(r));
  const staged=await data(page);assert.equal(staged.goals.length,1);assert.match(await frame(page).locator('body').evaluate(()=>mountedPlanner.state.toast),/pendientes de confirmación/);assert.equal(await page.locator('iframe:not([hidden])').getAttribute('inert'),'');
  release();await phase(page,'confirmed');const first=(await data(page)).goals[0].id;
  await page.route('**/saveRemoteV1',async route=>{await route.fetch();await route.abort('failed');},{times:1});await draft(page,'A lost acknowledgement');await frame(page).getByRole('button',{name:'Guardar meta',exact:true}).click();await phase(page,'error');
  const op=await page.locator('[data-operation]').getAttribute('data-operation');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar candidato v1',exact:true}).click();const saved=await download;const exported=JSON.parse(fs.readFileSync(await saved.path(),'utf8'));assert.equal(exported.version,1);assert.equal(exported.goals.length,2);
  await page.reload();await frame(page).locator('.app-shell').waitFor();await page.locator('[data-operation]').waitFor();assert.equal(await page.locator('[data-operation]').getAttribute('data-operation'),op);await page.getByRole('button',{name:'Reintentar / inspeccionar recibo',exact:true}).click();await phase(page,'confirmed');assert.equal((await data(page)).goals.length,2);
  const second=await context.newPage();second.on('dialog',d=>d.accept());await login(second,'lab_A');await phase(second,'confirmed');await draft(second,'A conflicting candidate');
  await saveGoal(page,'A wins CAS');await frame(second).getByRole('button',{name:'Guardar meta',exact:true}).click();await phase(second,'conflict');
  const conflict=await second.locator('[data-operation]').getAttribute('data-operation');await second.getByRole('button',{name:'Usar versión del servidor',exact:true}).click();await second.locator('iframe:not([hidden])').scrollIntoViewIfNeeded();await frame(second).locator('.confirmation-dialog').getByRole('button',{name:'Cargar versión',exact:true}).click();await phase(second,'confirmed');assert(!(await data(second)).goals.some(g=>g.title==='A conflicting candidate'));await second.getByRole('button',{name:'Exportar candidato archivado '+conflict,exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.locator('#login').waitFor({state:'visible'});await login(page,'lab_B');await phase(page,'confirmed');assert.equal((await data(page)).goals.length,0);await saveGoal(page,'Private B');
  assert.equal(await page.evaluate(()=>localStorage.getItem('fullhouse-v01')),'synthetic original');assert.equal(await page.evaluate(()=>localStorage.getItem('botanica-planificador-v01')),'synthetic alias');
  const mobile=await browser.newContext({viewport:{width:390,height:844}}),m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await login(m,'lab_B');await phase(m,'confirmed');await saveGoal(m,'Mobile viewport B');assert((await data(m)).goals.some(g=>g.title==='Private B'));assert(!(await data(m)).goals.some(g=>g.id===first));assert(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const held=await context.newPage();held.on('dialog',d=>d.accept());await login(held,'lab_A');await phase(held,'confirmed');await draft(held,'Unsaved A draft');
  await held.evaluate(()=>FullhouseRemoteLab.simulateSessionLoss());await held.locator('#login').waitFor({state:'visible'});await loginHere(held,'lab_B');assert(!(await data(held)).goals.some(g=>g.title==='Unsaved A draft'));
  await held.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await held.locator('#login').waitFor({state:'visible'});await loginHere(held,'lab_A');assert.equal(await frame(held).locator('.modal-body input').first().inputValue(),'Unsaved A draft');
  await frame(held).getByRole('button',{name:'Cerrar',exact:true}).last().click();await frame(held).locator('.confirmation-dialog').getByRole('button',{name:'Salir sin guardar',exact:true}).click();
  await frame(held).locator('body').evaluate(()=>{mountedPlanner.save({...mountedPlanner.state.data,events:[{id:'photo-event',title:'Synthetic photo activity',date:'2030-01-07',time:'09:00',minutes:30,goalId:'',routineId:'',repeat:'none',note:'',overrides:{}}]});});await phase(held,'confirmed');
  const original=held.frames().find(f=>f.url().endsWith('/planner.html'));
  await frame(held).locator('body').evaluate(()=>{
    const Native=FileReader,wait=accountWorkspace.persistence.waitForSession;accountWorkspace.persistence.waitForSession=()=>{window.photoWaiting=true;return wait();};
    window.FileReader=class extends Native{readAsDataURL(file){window.resumePhotoRead=()=>super.readAsDataURL(file);window.FileReader=Native;}};
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.getContext('2d').fillRect(0,0,1,1);const raw=atob(canvas.toDataURL('image/png').split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    window.photoJob=mountedPlanner.saveEvidence(mountedPlanner.state.data.events[0],'2030-01-07','',new File([bytes],'synthetic.png',{type:'image/png'}));
  });
  await original.waitForFunction(()=>typeof window.resumePhotoRead==='function');await held.evaluate(()=>FullhouseRemoteLab.simulateSessionLoss());await held.locator('#login').waitFor({state:'visible'});await loginHere(held,'lab_B');const beforeB=await data(held);
  await original.evaluate(()=>window.resumePhotoRead());await original.waitForFunction(()=>window.photoWaiting===true);assert.deepEqual(await data(held),beforeB);
  await held.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await held.locator('#login').waitFor({state:'visible'});await loginHere(held,'lab_A');await phase(held,'confirmed');await original.evaluate(()=>window.photoJob);await phase(held,'confirmed');assert.equal((await data(held)).logs['photo-event@2030-01-07'].evidences.length,1);
  await held.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await held.locator('#login').waitFor({state:'visible'});await loginHere(held,'lab_B');await phase(held,'confirmed');assert.deepEqual(await data(held),beforeB);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:browser.version(),dataBackend:process.env.FULLHOUSE_REMOTE_DATA_MODE,auth:'real Auth emulator',desktop:true,mobileViewport:390,physicalDevices:false,pendingBeforeAck:true,candidateExportV1:true,coldRecovery:true,stableRetry:true,twoSessionsConflict:true,explicitRecovery:true,twoUsers:true,forcedSessionPreservesDraft:true,photoHeldForOriginalSession:true,legacyUntouched:true,javascriptErrors:errors.length}));
  await mobile.close();await context.close();
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
