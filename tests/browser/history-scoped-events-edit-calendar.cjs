'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{const {server,url}=await start();let browser;const results=[];
try{browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const timezoneId of ['UTC','America/Mexico_City','America/New_York','Europe/Madrid','Pacific/Apia']){
  const context=await browser.newContext({timezoneId,viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>{for(const k of ['getItem','setItem','removeItem','clear'])Storage.prototype[k]=()=>{throw Error('No public storage');};});await page.goto(url+'/storage');
  const result=await page.evaluate(async()=>{
   const H=FullhouseHistory,L=H.schedule.validData,copy=x=>JSON.parse(JSON.stringify(x)),opts={factory:indexedDB,legacy:L,schedule:H.schedule,plannerActions:H.plannerActions,readSources:()=>({main:null,alias:null})},doc=copy(H.scenarios(H).list.find(s=>s.id==='partial').doc),engine=H.createEngine(L),adapter=H.createAdapter(H.schedule);
   const futureDay='2030-01-25',source=adapter.prepare(engine,doc,{executionId:'future-record',at:futureDay+'T12:00:00Z',context:{eventId:'e',date:futureDay,seriesId:'series',revisionId:'future-revision'},action:{type:'note',text:'Future facts recorded early'}}).after;
   const db=H.createLineageDatabase({...opts,name:'fullhouse-lab-events-edit-calendar'}),plan=await H.storageModel.prepareDocument(source,L);await db.commit(plan,{id:'seed'});const a=db.incremental,t=(await a.openWindow()).token,ctx={operationId:'split',today:'2030-01-08',at:'2030-01-08T12:00:00Z',confirm:true},p={...source.events[0],time:'10:00',applyFrom:'2030-01-20'},r=await a.reserveEventEdit(t,'e','split');
   let rejected=false;try{await a.prepareEventEdit(t,r,p,ctx);}catch(e){rejected=e.code==='CAPTURE_POLICY';}if(!rejected||(await db.open()).head.generation!==1)throw Error('Unconfirmed future facts changed');
   const op=await a.prepareEventEdit(t,r,p,{...ctx,capturedFuture:'retain-frozen'}),done=await a.commitEventEdit(op),saved=await db.open();if(done.status!=='confirmed'||saved.head.generation!==2)throw Error('Not confirmed');
   const prefix=saved.plan.tables.events.find(row=>row.key==='e').value,future=saved.plan.tables.events.find(row=>row.key===r.eventId).value;if(prefix.endDate!=='2030-01-19'||future.date!=='2030-01-20'||prefix.seriesId!==future.seriesId)throw Error('Wrong cut/series');
   for(const table of ['executions','revisions','evidence'])if(JSON.stringify(saved.plan.tables[table])!==JSON.stringify(plan.tables[table]))throw Error('Historical hash changed');
   const archive=await H.storageArchive.exportArchive(saved.plan,L),roundTrip=await H.storageArchive.importArchive(archive,L);if(roundTrip.rootHash!==saved.plan.rootHash)throw Error('Future capture archive changed');
   const restored=await H.storageModel.hydrate(roundTrip,L),reader=H.createReader(L,adapter),timeline=reader.timeline(restored,futureDay);if(timeline.filter(e=>e.kind==='planned').length||timeline.filter(e=>e.kind==='record').length!==1)throw Error('Duplicate pending occurrence');
   let duplicateRejected=false;try{await a.prepareExecution(done.token,r.eventId+'@'+futureDay,{executionId:'duplicate',operationId:'duplicate',at:futureDay+'T12:30:00Z',context:{eventId:r.eventId,date:futureDay,seriesId:r.seriesId,revisionId:'unused'},action:{type:'note',text:'Wrong duplicate'}});}catch{duplicateRejected=true;}if(!duplicateRejected)throw Error('Duplicate capture accepted');
   const read=await a.readEventEdit(done.token,r.eventId);if(read.segments.length!==2||read.captures.length!==2||read.photoBytesHydrated!==0)throw Error('Historical catalog lost');await db.auditLineage();db.close();
   const empty=copy(doc);empty.logs={};empty.recipeRevisions={};delete empty.events[0].recipeRevisionId;delete empty.events[0].seriesId;
   const cal=H.createLineageDatabase({...opts,name:'fullhouse-lab-events-edit-recurrences'});await cal.commit(await H.storageModel.prepareDocument(empty,L),{id:'seed'});const token=(await cal.incremental.openWindow()).token,finite=[],blocked=[];
   for(const repeat of ['monthly','yearly','every']){
    const c={...ctx,operationId:'finite-'+repeat},reservation=await cal.incremental.reserveEventEdit(token,'e',c.operationId),payload={...empty.events[0],time:'11:00',repeat,everyDays:3,endDate:'2032-01-07',applyFrom:'2030-01-08'};
    const candidate=await cal.incremental.prepareEventEdit(token,reservation,payload,c);if(cal.incremental.eventEditMetrics(candidate).proof.status!=='valid')throw Error('Finite proof failed');finite.push(repeat);
    const unbounded={...payload};delete unbounded.endDate;const u={...ctx,operationId:'unbounded-'+repeat};
    try{await cal.incremental.prepareEventEdit(token,await cal.incremental.reserveEventEdit(token,'e',u.operationId),unbounded,u);if(Intl.DateTimeFormat().resolvedOptions().timeZone!=='UTC')throw Error('Local indefinite accepted');}catch(e){if(Intl.DateTimeFormat().resolvedOptions().timeZone==='UTC'||e.status!=='indeterminate')throw e;blocked.push(repeat);}
   }
   if((await cal.open()).head.generation!==1)throw Error('Preparation wrote');cal.close();
   return {zone:Intl.DateTimeFormat().resolvedOptions().timeZone,split:true,historyHashesEqual:true,futureCaptureRetained:true,duplicatePending:false,duplicateCaptureRejected:true,finite,blockedIndefinite:blocked,photoBytesHydrated:0};
  });assert.deepEqual(errors,[]);results.push({...result,noJavaScriptErrors:true});await context.close();
 }
 console.log(JSON.stringify({base:'c61e6ac',browser:browser.version(),scope:'Synthetic IndexedDB; 390 px viewport, no physical phone',results},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
