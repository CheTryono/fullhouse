'use strict';
process.env.TZ='UTC';
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
function run(zone,body){return JSON.parse(execFileSync(process.execPath,['-e',`(async()=>{const {schedule:s}=require('./tests/helpers/history-integration.cjs'),R=require('./history/storage-routines.cjs'),{skippedFriday,build}=require('./tests/helpers/local-calendar.cjs');${body}})().catch(e=>{console.error(e);process.exitCode=1;});`],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,TZ:zone},encoding:'utf8'}));}
test('regresión local: B.2 no acepta la alternativa de un viernes omitido en Apia',()=>{
 const result=run('Pacific/Apia',`const x=skippedFriday();let error=null;try{await build(x);}catch(e){error=e.message;}console.log(JSON.stringify({error,friday:s.parseDay('2012-01-06').getDay()}));`);
 assert.equal(result.friday,5);assert.match(result.error||'',/2012-01-06/);
});
test('nueva captura no congela como viernes una fecha normalizada al sábado',()=>{
 const result=run('Pacific/Apia',`const x=skippedFriday(),d=x.doc;d.routines=[x.draft];d.events=[{...d.events[0],id:'e',routineId:'r',time:'09:00'}];const before=JSON.stringify(d);let error=null;try{require('./history/adapter.cjs').createAdapter(s).prepare(require('./history/engine.cjs').createEngine(s.validData),d,{executionId:'exec',at:'2011-12-30T12:00:00Z',context:{eventId:'e',date:'2011-12-30',seriesId:'series',revisionId:'rev'},action:{type:'note',text:'Synthetic'}});}catch(e){error=e.message;}console.log(JSON.stringify({error,unchanged:before===JSON.stringify(d)}));`);
 assert.equal(result.unchanged,true);assert.match(result.error||'',/fecha local.*normalizada/i);
});
for(const zone of ['America/Mexico_City','America/New_York','Europe/Madrid','Pacific/Apia'])test('cobertura local completa y política conservadora: '+zone,()=>{
 const result=run(zone,`
  const M=require('./history/calendar-math.cjs'),P=require('./history/calendar-proof.cjs'),x=skippedFriday();x.draft.steps[0].variants[0].min=10;
  const built=await build(x),data={...x.doc,routines:x.doc.routines.map(r=>r.id==='r'?x.draft:r)},engine=P.createCalendarProof(s),input={events:data.events,routines:data.routines,from:x.from};
  const finite=await engine.prove({...input,through:'2012-01-07'}),unbounded=await engine.prove(input),catalog=R.calendarDates(data.events,x.from,s.parseDay);
  const blocked=['monthly','yearly','every'].map(repeat=>{try{R.proofDates([{...data.events[0],repeat,everyDays:2}],x.from,s.parseDay);return false;}catch(e){return e.status==='indeterminate';}});
  const e={...data.events[0],repeat:'every',everyDays:2,endDate:'2012-01-10'},dates=R.proofDates([e],x.from,s.parseDay),expected=Array.from({length:13},(_,i)=>M.date(M.ordinal(x.from)+i));
  let mismatches=0;for(let n=0;n<120;n++){const date=M.date(M.ordinal(x.from)+n);for(const event of data.events)if(s.occurs(event,date)){const frame=s.eventFrame(event,date,data);if(!frame||s.routineBalance(data.routines.find(r=>r.id===event.routineId),date,frame.length).error)mismatches++;}}
  const pairs={mx:['2010-04-03','2010-04-05'],ny:['2021-03-13','2021-03-15'],es:['2021-03-27','2021-03-29'],apia:['1892-07-04','1892-07-05']},historical=Object.fromEntries(Object.entries(pairs).map(([id,[date,target]])=>[id,{occurs:s.occurs({...data.events[0],date,repeat:'every',everyDays:2},target),days:(s.parseDay(target)-s.parseDay(date))/86400000,offsetDelta:s.parseDay(target).getTimezoneOffset()-s.parseDay(date).getTimezoneOffset()}]));
  const samples=['1883-11-18','1883-11-19','1892-07-04','1892-07-05','1940-03-16','1940-03-17','2010-04-03','2010-04-05','2011-12-30','2023-04-03'].map(date=>({date,local:s.ymd(s.parseDay(date)),weekday:s.parseDay(date).getDay(),offset:s.parseDay(date).getTimezoneOffset()}));
  console.log(JSON.stringify({zone:built.proof.zone,status:built.proof.status,segments:catalog.segments,dates:catalog.dates,finite:finite.status,states:finite.certificate.counts.states,unbounded:unbounded.status,blocked,finiteDatesComplete:expected.every(d=>dates.includes(d)),mismatches,samples,historical}));`);
 const pair=result.historical[{'America/Mexico_City':'mx','America/New_York':'ny','Europe/Madrid':'es','Pacific/Apia':'apia'}[zone]];assert.equal(pair.occurs,true);if(zone==='Pacific/Apia'){assert.equal(pair.days,2);assert.ok(pair.offsetDelta>1400);}else{assert.equal(pair.offsetDelta,-60);assert.ok(pair.days<2&&pair.days>1.9);}
 assert.equal(result.status,'valid');assert.equal(result.finite,'valid');assert.equal(result.states,10);assert.equal(result.unbounded,'indeterminate');assert.deepEqual(result.blocked,[true,true,true]);assert.equal(result.finiteDatesComplete,true);assert.equal(result.mismatches,0);
 for(const seg of result.segments)if(seg.coverage==='all-local-weekdays')assert.deepEqual(seg.weekdays,[0,1,2,3,4,5,6]);
 if(zone==='Pacific/Apia'){assert.ok(result.dates.includes('2012-01-06'));assert.equal(result.samples.find(r=>r.date==='2011-12-30').local,'2011-12-31');}
});
test('capturas previas conservan su interpretación; puertos sin semántica real y presupuestos insuficientes se bloquean',()=>{
 const result=run('Pacific/Apia',`
  const x=skippedFriday(),d=x.doc;d.routines=[x.draft];d.events=[{...d.events[0],id:'e',routineId:'r',time:'09:00'}];
  const engine=require('./history/engine.cjs').createEngine(s.validData),adapter=require('./history/adapter.cjs').createAdapter(s),cmd={executionId:'existing',at:'2011-12-30T12:00:00Z',context:{eventId:'e',date:'2011-12-30',seriesId:'series',revisionId:'rev',window:{startMin:540,endMin:551},budgetMinutes:11},action:{type:'note',text:'Old'}};
  const before=engine.prepare(d,cmd).after,after=adapter.prepare(engine,before,{executionId:'existing',at:'2011-12-31T12:00:00Z',action:{type:'note',text:'Corrected'}}).after;
  let missing=false,budget=false,semantics=false;try{R.proofDates(d.events,x.from);}catch(e){missing=e.status==='indeterminate';}
  try{R.proofDates([{...d.events[0],repeat:'every',everyDays:2,endDate:'2099-01-01'}],x.from,s.parseDay);}catch(e){budget=e.status==='indeterminate';}
  try{await require('./history/calendar-proof.cjs').assertCalendarSemantics({...s,parseDay:date=>new Date(date)});}catch(e){semantics=/unsupported-semantics/.test(e.message);}
  console.log(JSON.stringify({preserved:JSON.stringify(before.logs['e@2011-12-30'].history.capture)===JSON.stringify(after.logs['e@2011-12-30'].history.capture)&&JSON.stringify(before.logs['e@2011-12-30'].history.resolution)===JSON.stringify(after.logs['e@2011-12-30'].history.resolution),note:after.logs['e@2011-12-30'].note,missing,budget,semantics}));`);
 assert.deepEqual(result,{preserved:true,note:'Corrected',missing:true,budget:true,semantics:true});
});
test('hallazgos públicos conservados: addDays en fecha inexistente y colisión de preview',()=>{
 const result=run('Pacific/Apia',`const x=skippedFriday();x.doc.events[0].id='__fh_preview__';const draft={...x.doc.events[2],id:'',date:'2012-01-06',repeat:'none'};const controller=require('./tests/helpers/history-integration.cjs').plannerActions(x.doc,{today:'2012-01-06',at:'2012-01-06T12:00:00Z',ids:[],confirm:true}).controller;const preview=controller.schedulePreview(draft);console.log(JSON.stringify({previous:s.addDays('2011-12-31',-1),previewSkipped:preview[0].skipped,realFrame:!!s.eventFrame({...draft,id:'reserved-real'},'2012-01-06',{...x.doc,events:[...x.doc.events,{...draft,id:'reserved-real'}]})}));`);
 assert.equal(result.previous,'2011-12-31');assert.equal(result.previewSkipped,true);assert.equal(result.realFrame,true);
});
