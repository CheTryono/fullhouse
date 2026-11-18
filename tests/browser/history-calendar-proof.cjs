'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{
 const {server,url}=await start();let browser;const results=[];
 try{
  browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-precise-memory-info','--js-flags=--expose-gc']});
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'UTC'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{for(const key of ['getItem','setItem','removeItem','clear'])Storage.prototype[key]=()=>{throw Error('Public storage forbidden');};IDBFactory.prototype.open=()=>{throw Error('Calendar proof must not open IndexedDB');};});
   await page.goto(url+'/storage');
   const row=await page.evaluate(async()=>{
    const H=FullhouseHistory,engine=H.createCalendarProof(H.schedule),port=H.createCalendarProofPort(()=>new Worker('/calendar-proof-worker.js'));
    const event=(id='e',extra={})=>({id,title:id,date:'2000-01-01',time:'23:00',minutes:60,goalId:'',routineId:'',repeat:'daily',note:'',overrides:{},...extra});
    const input=(events=[event()],routines=[],extra={})=>({events,routines,from:'2000-01-01',...extra});
    const require=(p,message)=>{if(!p)throw Error(message);},measure=async value=>{const start=performance.now(),promise=engine.prove(value),snapshotMs=performance.now()-start,result=await promise;return {result,snapshotMs,wallMs:performance.now()-start};};
    const setupStart=performance.now();await engine.prove(input([],[]));await port.prove('warmup',input([],[]));const warmupMs=performance.now()-setupStart;
    const heap=()=>{globalThis.gc?.();return performance.memory?.usedJSHeapSize||null;},beforeHeap=heap(),small=await measure(input()),medium=await measure(input([event('e',{repeat:'monthly',date:'2000-01-31'})],[],{from:'2000-01-31'}));
    require(small.result.status==='valid'&&medium.result.status==='valid','Deterministic proof failed');
    const ws=performance.now(),workerSmall=await port.prove('small',input()),workerSmallMs=performance.now()-ws;
    require(workerSmall.proofHash===small.result.proofHash,'Worker certificate differs');
    let ticks=0;const timer=setInterval(()=>ticks++,1),wm=performance.now();
    const workerMedium=await port.prove('medium',input([event('e',{repeat:'monthly',date:'2000-01-31'})],[],{from:'2000-01-31'})),workerMediumMs=performance.now()-wm;
    clearInterval(timer);require(workerMedium.proofHash===medium.result.proofHash,'Monthly Worker certificate differs');require(ticks>10,'Main thread did not respond during Worker proof');
    const routine={id:'r',title:'R',desc:'',steps:[{id:'s',title:'S',min:10}]},large=input([event('a',{routineId:'r',repeat:'monthly'}),event('b',{routineId:'r',repeat:'every',everyDays:365})],[routine],{budgets:{states:10000}}),extreme=await measure(large);
    require(extreme.result.status==='indeterminate'&&extreme.result.certificate.reason==='state-budget','Partial proof accepted');
    const controller=new AbortController(),pending=port.prove('cancel',{...large,budgets:{states:1000000}},{signal:controller.signal});setTimeout(()=>controller.abort(),10);const cancelled=await pending;require(cancelled.status==='indeterminate'&&cancelled.certificate.reason==='cancelled','Cancellation failed');
    require((await port.prove('again',input())).status==='valid','Worker not reusable after cancellation');
    const invalid=await port.prove('overflow',input([event('e',{minutes:61})]));require(invalid.status==='invalid'&&invalid.certificate.counterexample.date==='2000-01-01','Overflow lost');require(await engine.verify(input([event('e',{minutes:61})]),invalid),'Certificate replay failed');
    const projected=H.calendarProof.projectPlan({header:{eventIds:['e'],routineIds:[]},tables:{events:[{key:'e',value:event()}],routines:[],get executions(){throw Error('History hydrated');},get revisions(){throw Error('Revisions hydrated');}},get images(){throw Error('Photos hydrated');}},{from:'2000-01-01'});
    require((await engine.prove(projected)).proofHash===small.result.proofHash,'Projection differs');
    port.close();const afterHeap=heap();
    const summary=m=>({status:m.result.status,reason:m.result.certificate.reason,wallMs:m.wallMs,snapshotMs:m.snapshotMs,engineMs:m.result.metrics.elapsedMs,...m.result.certificate.counts,periodDays:m.result.certificate.components[0].periodDays});
    return {warmupMs,small:summary(small),monthly:summary(medium),extreme:summary(extreme),workerSmallMs,workerMediumMs,workerMediumEngineMs:workerMedium.metrics.elapsedMs,mainThreadTicks:ticks,cancelledStates:cancelled.certificate.counts.states,heap:{before:beforeHeap,after:afterHeap,note:'Retained window JS heap only; excludes Worker/native/peak; one sample'},metadataOnlyProjection:true};
   });
   assert.deepEqual(errors,[]);results.push({viewport:width,...row});await context.close();
  }
  const zones=[];
  for(const timezoneId of ['America/New_York','Europe/Madrid','Pacific/Apia']){
   const context=await browser.newContext({timezoneId}),page=await context.newPage();await page.goto(url+'/storage');
   const row=await page.evaluate(async()=>{const H=FullhouseHistory,e={id:'e',title:'E',date:'2011-12-29',time:'23:00',minutes:60,goalId:'',routineId:'',repeat:'every',everyDays:2,note:'',overrides:{}},engine=H.createCalendarProof(H.schedule),x={events:[e],routines:[],from:'2011-12-29'};return {finite:(await engine.prove({...x,through:'2012-01-03'})).status,unbounded:(await engine.prove(x)).status,occurs:H.schedule.occurs(e,'2011-12-31')};});
   assert.equal(row.finite,'valid');assert.equal(row.unbounded,'indeterminate');assert.equal(row.occurs,timezoneId!=='Pacific/Apia');zones.push({timezoneId,...row});await context.close();
  }
  console.log(JSON.stringify({base:'33bd80a',browser:browser.version(),machine:{node:process.version,cpu:require('node:os').cpus()[0]?.model,logicalCPUs:require('node:os').cpus().length,platform:process.platform,arch:process.arch},implementationHashes:Object.fromEntries(['history/calendar-proof.cjs','history/calendar-math.cjs','history/calendar-proof-port.cjs','tests/history-lab/calendar-proof-worker.js'].map(p=>[p,require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(p)).digest('hex')])),scope:'One synthetic sample per viewport, UTC desktop engine and responsive viewport; no physical phones, Firefox or WebKit',results,zones},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
