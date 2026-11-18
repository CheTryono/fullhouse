'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{
 const {server,url}=await start();let browser;const results=[];
 try{
  browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const timezoneId of ['America/Mexico_City','America/New_York','Europe/Madrid','Pacific/Apia']){
   const context=await browser.newContext({timezoneId,viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{for(const k of ['getItem','setItem','removeItem','clear'])Storage.prototype[k]=()=>{throw Error('Public storage forbidden');};IDBFactory.prototype.open=()=>{throw Error('No calendar storage');};});await page.goto(url+'/storage');
   const result=await page.evaluate(async()=>{
    const H=FullhouseHistory,s=H.schedule,R=H.storageRoutines,from='2011-12-29',require=(x,msg)=>{if(!x)throw Error(msg);},origin='2011-01-01';
    const routine=(id,min)=>({id,title:id,desc:'',steps:[{id:'s',title:'Step',min}]}),event=(id,routineId,time)=>({id,title:id,date:origin,time,minutes:10,goalId:'',routineId,repeat:'daily',note:'',overrides:{}});
    const doc={version:2,goals:[],routines:[routine('a',60),routine('c',60),routine('r',10)],events:[event('a','a','08:00'),event('c','c','09:10'),{...event('e','r','09:00'),repeat:'custom',repeatDays:[5],anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'}],logs:{},recipeRevisions:{}},draft=routine('r',10);draft.steps[0]={...draft.steps[0],mode:'alternatives',chooseWhen:'weekday',variants:[{id:'friday',title:'Friday',desc:'',min:11,days:[5]}]};
    const plan=await H.storageModel.prepareDocument(doc,s.validData),ctx={operationId:'local',today:from,at:from+'T12:00:00Z',ids:[]};let invalid=null;
    try{await R.buildChange(R.selectScope(plan,'saveRoutine',draft,ctx),{legacy:s.validData,schedule:s,plannerActions:H.plannerActions});}catch(e){invalid=e.message;}
    require(!!invalid,'Omitted weekday accepted');draft.steps[0].variants[0].min=10;
    const valid=await R.buildChange(R.selectScope(plan,'saveRoutine',draft,ctx),{legacy:s.validData,schedule:s,plannerActions:H.plannerActions});require(valid.proof.status==='valid','Local quotient failed');
    const input={events:doc.events,routines:doc.routines.map(r=>r.id==='r'?draft:r),from},engine=H.createCalendarProof(s),port=H.createCalendarProofPort(()=>new Worker('/calendar-proof-worker.js'));
    const finite=await engine.prove({...input,through:'2012-01-07'}),worker=await port.prove('local-finite',{...input,through:'2012-01-07'}),unbounded=await port.prove('local-unbounded',input);
    require(finite.status==='valid'&&finite.certificate.counts.states===10,'Finite range not exhausted');require(worker.proofHash===finite.proofHash,'Worker timezone differs');require(unbounded.status==='indeterminate','Finite proof authorized unbounded range');
    const normalized=s.ymd(s.parseDay('2011-12-30')),candidate={...doc,routines:[draft],events:[event('e','r','09:00')]};let captureBlocked=false;
    if(normalized!=='2011-12-30'){try{H.createAdapter(s).prepare(H.createEngine(s.validData),candidate,{executionId:'exec',at:'2011-12-30T12:00:00Z',context:{eventId:'e',date:'2011-12-30',seriesId:'series',revisionId:'rev'},action:{type:'note',text:'Synthetic'}});}catch(e){captureBlocked=/normalizada/.test(e.message);}require(captureBlocked,'Normalized day captured');}
    port.close();return {zone:valid.proof.zone,invalid,representatives:valid.proof.dates,coverage:valid.proof.segments,finite:finite.status,finiteStates:finite.certificate.counts.states,unbounded:unbounded.status,workerHashEqual:true,normalized,captureBlocked};
   });
   assert.deepEqual(errors,[]);if(timezoneId==='Pacific/Apia')assert.match(result.invalid,/2012-01-06/);results.push({timezoneId,...result,noJavaScriptErrors:true});await context.close();
  }
  console.log(JSON.stringify({base:'beff908',browser:browser.version(),scope:'Synthetic contexts, responsive viewport only; no physical devices or other browser engines',results},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
