'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{start}=require('../../scripts/serve-history-lab.cjs');
(async()=>{
 const {server,url}=await start();let browser;const results=[];
 try{
  browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'UTC'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{for(const k of ['getItem','setItem','removeItem','clear'])Storage.prototype[k]=()=>{throw Error('Public storage forbidden');};});
   await page.goto(url+'/storage');
   const result=await page.evaluate(async()=>{
    const H=FullhouseHistory,copy=x=>JSON.parse(JSON.stringify(x)),require=(value,msg)=>{if(!value)throw Error(msg);},day='2030-01-07';
    const routine=(id,min)=>({id,title:id,desc:'',steps:[{id:id+'-step',title:'Step',min}]}),event=(id,routineId,time)=>({id,title:id,date:day,time,minutes:10,goalId:'',routineId,repeat:'daily',note:'',overrides:{}});
    const doc=copy(H.scenarios(H).list.find(s=>s.id==='partial').doc);doc.routines=[routine('a',60),routine('c',60),routine('r',10)];doc.events=[event('a','a','08:00'),event('c','c','09:10'),{...event('e','r','09:00'),anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'}];doc.logs.legacy={completed:false,checkedSteps:['old-step'],choices:{'old-step':'__base'},note:'Original legacy fact'};
    const name='fullhouse-lab-alternative-safety',opts={factory:indexedDB,name,legacy:H.schedule.validData,schedule:H.schedule,plannerActions:H.plannerActions,readSources:()=>({main:null,alias:null})};
    const db=H.createLineageDatabase(opts),plan=await H.storageModel.prepareDocument(doc,H.schedule.validData);await db.commit(plan,{id:'seed'});
    const session=H.createRoutinesSession(db.incremental);await session.open();window.db=db;window.session=session;window.opts=opts;
    const ctx=id=>({operationId:id,today:day,at:day+'T12:00:00Z',ids:[]}),draft=(base,variant)=>({id:'r',title:'Edited',desc:'Draft preserved',steps:[{id:'s',title:'S',min:base,mode:'alternatives',chooseWhen:'execute',variants:[{id:'__base',title:'Variant',desc:'',min:variant,days:[]}]}]});
    async function controls(){const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=raw.transaction(['control','commits'],'readonly'),a=tx.objectStore('control').getAll(),b=tx.objectStore('commits').getAll();tx.oncomplete=()=>resolve(JSON.stringify([a.result,b.result]));tx.onerror=()=>reject(tx.error);});}finally{raw.close();}}
    const before=await controls(),token=session.state().confirmed;session.setDraft('routine',draft(20,10));
    let rejected=false;try{await session.save('saveRoutine',draft(20,10),ctx('invalid'));}catch(e){rejected=/Distribución inválida/.test(e.message);}require(rejected,'Omitted base accepted');
    require(await controls()===before,'Rejected operation changed control/receipt');require(session.state().confirmed===token&&!session.state().pending,'Rejected operation became pending/confirmed');require(session.state().drafts.routine.steps[0].min===20,'Invalid draft lost');
    const valid=draft(10,10);session.setDraft('routine',valid);let state=await session.save('saveRoutine',valid,ctx('retry'),{fault:'after-records'});require(state.pending?.id==='retry'&&state.confirmed===token,'Aborted transaction changed confirmed');require(await controls()===before,'Multi-entity abort leaked rows/authority');
    const packet=await H.recoveryBinary.inspectRecovery(await session.exportPending(),H.schedule.validData),target=H.createRoutinesSession(db.incremental);await target.open();await target.resume(packet);require(target.state().pending.id==='retry'&&target.state().drafts.routine.desc==='Draft preserved','Recovery lost ID/draft');
    const recoveredToken=target.state().confirmed;
    state=await target.retry({fault:'lost-ack'});require(state.pending&&state.confirmed===recoveredToken,'Lost acknowledgement changed confirmed');
    state=await target.retry();require(!state.pending&&state.confirmed.generation===2,'Stable retry failed');session.cancel();
    const saved=await db.open();require(saved.head.id==='retry'&&saved.authority.tip.generation===2,'Lineage differs');
    for(const store of ['executions','revisions','evidence'])require(JSON.stringify(saved.plan.tables[store].map(r=>[r.key,r.hash]))===JSON.stringify(plan.tables[store].map(r=>[r.key,r.hash])),'Historical hash changed: '+store);
    require(saved.plan.images.length===plan.images.length,'Images lost/duplicated');for(const image of saved.plan.images)require(await H.storageModel.bytesHash(image.blob)===image.hash,'Image bytes differ');
    await db.auditLineage();const archive=await H.storageArchive.exportArchive(saved.plan,H.schedule.validData),restored=await H.storageArchive.importArchive(archive,H.schedule.validData);require(restored.rootHash===saved.plan.rootHash,'Archive lost facts');
    // Dos conexiones/pestañas se ensayan después, sobre esta misma base.
    window.payload=draft(10,10);window.ctx=ctx;
    return {invalidRejected:true,originalControlsUnchanged:true,draftPreserved:true,recoveredId:packet.metadata.id,generation:saved.head.generation,photoHashesEqual:true,historicalHashesEqual:true,archiveRootEqual:true};
   });
   const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto(url+'/storage');
   await other.evaluate(async()=>{const H=FullhouseHistory;window.db=H.createLineageDatabase({factory:indexedDB,name:'fullhouse-lab-alternative-safety',legacy:H.schedule.validData,schedule:H.schedule,plannerActions:H.plannerActions,readSources:()=>({main:null,alias:null})});window.session=H.createRoutinesSession(db.incremental);await session.open();window.op=await db.incremental.prepareRoutine(session.state().confirmed,'saveRoutine',{id:'r',title:'Stale',desc:'',steps:[{id:'s',title:'S',min:10,mode:'alternatives',chooseWhen:'execute',variants:[{id:'__base',title:'V',desc:'',min:10,days:[]}]}]},{operationId:'stale',today:'2030-01-07',at:'2030-01-07T12:00:00Z',ids:[]});});
   await page.evaluate(async()=>{const H=FullhouseHistory,s=H.createRoutinesSession(db.incremental);await s.open();const r=await s.save('saveRoutine',{...payload,title:'Winner'},ctx('winner'));if(r.pending)throw Error(r.pending.error);});
   assert.equal(await other.evaluate(async()=>{try{await db.incremental.commitRoutine(op);return false;}catch{return (await db.open()).head.id==='winner';}}),true);
   await other.evaluate(()=>db.close());await page.evaluate(()=>db.close());assert.deepEqual(errors,[]);results.push({width,...result,twoTabsStaleRejected:true,noJavaScriptErrors:true});await context.close();
  }
  console.log(JSON.stringify({base:'beff908',browser:browser.version(),results},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
