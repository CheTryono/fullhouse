'use strict';
const H=FullhouseHistory,engine=H.createEngine(H.schedule.validData),adapter=H.createAdapter(H.schedule),reader=H.createReader(H.schedule.validData,adapter);
let memory,lock,session,otherSession,counter=0,clock=Date.parse('2030-01-07T12:00:00Z'),lastRecovery=null,lastBackup=null;
const text=(id,value)=>{document.getElementById(id).textContent=value;};
function make(){const repository=H.createRepository({storage:memory,lock,legacy:H.schedule.validData});return H.createIntegration({engine,adapter,reader,repository,plannerActions:H.plannerActions,legacy:H.schedule.validData});}
function now(){clock+=1000;return new Date(clock).toISOString();}
function id(){return 'synthetic-operation-'+(++counter);}
function context(operationId){return {today:'2030-01-07',ids:['segment-'+counter],confirm:true,operationId};}
function request(action,target=session){
  const d=target.state().confirmed,c=Object.values(d.logs).find(l=>l.history?.capture.executionId==='experiment-execution')?.history.capture;
  const e=d.events.find(e=>e.routineId==='r' && H.schedule.occurs(e,'2030-01-07'));
  return {executionId:'experiment-execution',at:now(),context:{eventId:c?.sourceEventId || e?.id,date:c?.scheduledDate || '2030-01-07',seriesId:c?.seriesId || e?.seriesId || 'series',revisionId:'revision-'+counter},operationId:id(),action};
}
function render(){
  const s=session.state();text('summary',JSON.stringify({confirmed:!!s.confirmed,logs:Object.keys(s.confirmed?.logs || {}).length,notes:Object.values(s.confirmed?.logs || {}).map(l=>l.note || ''),steps:Object.values(s.confirmed?.logs || {}).map(l=>l.checkedSteps),progress:s.confirmed?session.progress('2030-01-07'):null,simulatedBytes:memory.bytes()},null,2));
  text('pending',JSON.stringify({pending:!!s.pending,error:s.pending?.error || s.recovery?.error || null,otherPending:!!otherSession?.state().pending,otherError:otherSession?.state().pending?.error || null},null,2));
  const records=document.getElementById('records');records.replaceChildren();
  for(const v of session.index()){const a=document.createElement('article'),title=document.createElement('h3');title.textContent=v.label+' · '+(v.title || v.key);a.append(title);const p=document.createElement('p');p.textContent=v.facts?.note || '';a.append(p);
    for(const photo of v.facts?.evidences || []){const img=document.createElement('img');img.src=photo.src;img.alt=photo.caption || 'Evidencia sintética';img.width=100;a.append(img);}records.append(a);
  }
}
async function run(fn){try{text('status','Procesando operación simulada…');await fn();const s=session.state();text('status',s.pending?'Pendiente: no se ha confirmado el guardado':s.recovery?'Recuperación necesaria: escrituras bloqueadas':'Operación simulada confirmada o consulta completada');}catch(error){text('status',error.message);}render();}
async function reset(){
  const d=JSON.parse(JSON.stringify(H.scenarios(H).list.find(s=>s.id==='partial').doc));d.logs={};d.recipeRevisions={};d.events.forEach(e=>{delete e.recipeRevisionId;delete e.seriesId;e.date='2030-01-01';});
  const v1={...d,version:1};delete v1.recipeRevisions;memory=H.createMemoryStorage({[H.KEYS.legacy]:JSON.stringify(v1)});lock=H.createMemoryLock();session=make();otherSession=null;lastRecovery=null;counter=0;clock=Date.parse('2030-01-07T12:00:00Z');text('recovery-data','');
  await session.open();await session.initialize(H.backups.prepareLegacyDocument(JSON.stringify(v1),H.schedule.validData),id());
}
const click=(name,fn)=>{document.getElementById(name).onclick=()=>run(fn);};
const record=action=>session.dispatch(request(action));
document.getElementById('note').oninput=e=>session.setDraft('note',e.target.value);
click('save-note',async()=>{const value=document.getElementById('note').value;await record({type:'note',text:value});if(!session.state().pending && document.getElementById('note').value===value)session.setDraft('note','');});
click('photo',async()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#7854df';ctx.fillRect(0,0,64,64);const src=canvas.toDataURL('image/jpeg',.66);const evidence={id:'photo-'+counter,kind:'image',src,caption:'Imagen sintética comprimida',createdAt:new Date(clock).toISOString()};session.setDraft('photo',{id:evidence.id,src});await record({type:'evidence',evidence});if(!session.state().pending && session.state().drafts.photo?.id===evidence.id)session.setDraft('photo','');});
click('step-one',()=>record({type:'step',stepId:'one',checked:true}));click('step-two',()=>record({type:'step',stepId:'two',checked:true}));click('complete',()=>record({type:'complete',source:'manual'}));click('partial',()=>record({type:'close-partial'}));
click('reopen',()=>record({type:'reopen',correctionId:id(),reason:'Reapertura sintética explícita'}));click('continue',()=>{clock=Date.parse('2030-01-08T13:00:00Z');return record({type:'continue',localDate:'2030-01-08',timezoneOffsetMinutes:0});});
click('base',()=>record({type:'choice',stepId:'parent',variantId:'__base'}));click('other',()=>record({type:'choice',stepId:'parent',variantId:'alternative',correctionId:id(),reason:'Corrección sintética explícita'}));
click('variants',()=>{const r=JSON.parse(JSON.stringify(session.state().confirmed.routines[0]));r.steps=[{id:'parent',title:'Alternativas sintéticas',min:10,mode:'alternatives',chooseWhen:'execute',children:[{id:'one',title:'Base',min:10}],variants:[{id:'alternative',title:'Otra opción',desc:'',min:20,days:[],children:[{id:'two',title:'Alternativa',min:20}]}]}];return session.plan('saveRoutine',r,context(id()));});
click('edit-routine',()=>{const r=JSON.parse(JSON.stringify(session.state().confirmed.routines[0]));r.title='Rutina actual editada';r.steps.push({id:'new-'+counter,title:'Paso futuro',min:5});return session.plan('saveRoutine',r,context(id()));});
click('delete-routine',()=>session.plan('deleteRoutine',{id:'r'},context(id())));
click('shift',()=>session.plan('shiftEvent',{eventId:'e',date:'2030-01-07',delta:15},context(id())));
click('reschedule',()=>{const e=JSON.parse(JSON.stringify(session.state().confirmed.events.find(e=>e.routineId==='r')));e.time='11:00';e.applyFrom='2030-01-08';return session.plan('saveEvent',e,context(id()));});
click('dependencies',async()=>{
  for(const [r,time] of [['anchor-a','08:00'],['anchor-b','10:00']]){await session.plan('saveRoutine',{id:'',title:r,desc:'',steps:[{id:r+'-step',title:'Límite',min:10}]},{...context(id()),ids:[r]});await session.plan('saveEvent',{id:'',title:r,date:'2030-01-01',time,minutes:10,routineId:r,goalId:'',note:'',overrides:{},repeat:'daily'},{...context(id()),ids:[r+'-event']});}
  const d=session.state().confirmed,r=JSON.parse(JSON.stringify(d.routines.find(r=>r.id==='r')));r.steps[1].flexible=true;await session.plan('saveRoutine',r,context(id()));
  const e=JSON.parse(JSON.stringify(session.state().confirmed.events.find(e=>e.routineId==='r')));Object.assign(e,{anchor:'between',afterRoutineId:'anchor-a',beforeRoutineId:'anchor-b',applyFrom:'2030-01-07'});await session.plan('saveEvent',e,context(id()));
});
function targetSlot(){const m=JSON.parse(memory.raw(H.KEYS.manifest));return m.slot===H.KEYS.a?H.KEYS.b:H.KEYS.a;}
click('fail-write',()=>memory.failNext({op:'write',key:targetSlot()}));click('fail-read',()=>memory.failNext({op:'read',key:targetSlot(),skip:1}));click('before-manifest',()=>memory.failNext({op:'write',key:H.KEYS.manifest}));click('after-manifest',()=>memory.failNext({op:'write',key:H.KEYS.manifest,after:true}));click('quota',()=>memory.setQuota(memory.bytes()+200));click('restore-quota',()=>memory.setQuota(Infinity));click('retry',()=>session.retry());
click('new-tab',async()=>{otherSession=make();await otherSession.open();});click('other-write',()=>{if(!otherSession)throw Error('Prepara otra pestaña primero');return otherSession.dispatch(request({type:'note',text:'Nota de otra pestaña'},otherSession));});
click('old-tab',()=>{const v1=JSON.parse(memory.raw(H.KEYS.legacy));v1.logs['old@2030-01-07']={completed:false,checkedSteps:[],note:'Cambio de pestaña antigua'};memory.externalWrite(H.KEYS.legacy,JSON.stringify(v1));});
click('reopen-session',async()=>{if(session.state().pending && !lastRecovery)throw Error('Exporta primero el candidato y la recuperación');session=make();await session.open();});click('recover',()=>session.recover());
click('invalid-import',()=>session.importBackup('{"version":2}',{id:id(),confirmReplace:true}));
click('legacy',async()=>{const d=JSON.parse(session.exportConfirmed());d.logs['e@2030-01-07']={completed:false,checkedSteps:['old-step'],note:'Hechos heredados'};await session.importBackup(JSON.stringify(d),{id:id(),confirmReplace:true});});
function download(raw,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
click('export',()=>{lastBackup=session.exportConfirmed();download(lastBackup,'synthetic-fullhouse-v2.json');});click('recovery-export',async()=>{lastRecovery=await session.exportRecovery();text('recovery-data',JSON.stringify(lastRecovery,null,2));download(JSON.stringify(lastRecovery),'synthetic-fullhouse-recovery.json');});click('restore-export',async()=>{const packet=lastRecovery?H.backups.readRecovery(JSON.stringify(lastRecovery),H.schedule.validData):null;const document=packet?.ok?(packet.pending || packet.confirmed):lastBackup?H.backups.readBackup(lastBackup,H.schedule.validData).document:null;if(!document)throw Error('Primero exporta una copia sintética válida');memory=H.createMemoryStorage();lock=H.createMemoryLock();session=make();otherSession=null;await session.open();await session.initialize(document,id());});click('reset',reset);
window.addEventListener('beforeunload',e=>{const s=session?.state();if(s?.busy || s?.pending || Object.values(s?.drafts || {}).some(Boolean)){e.preventDefault();e.returnValue='';}});
run(reset);
