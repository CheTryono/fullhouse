'use strict';
// Experimental pure occurrence shift. No storage, DOM or new event/series identities.
const {copy,same,freeze,canonical}=require('./json.cjs'),{sha256}=require('./persistence.cjs');
const C=require('./calendar-proof.cjs'),E=require('./storage-events.cjs'),R=require('./storage-routines.cjs'),civil=require('./calendar-math.cjs');
const TIME_APPROVED='f811218345c41e37b71cbbc1b2668e7c22063494a7cfd94f4bbaf79a7da10ef0';
const now=()=>performance.now();
function stop(code,message,status='indeterminate',counterexample=null){const error=Error(message);Object.assign(error,{code,status,counterexample});throw error;}
function command(request,context,schedule){
 const p=C.snapshotInput(request),c=C.snapshotInput(context);
 if(!p||Object.keys(p).length!==4||Object.keys(p).some(k=>!['eventId','seriesId','date','deltaMinutes'].includes(k))||typeof p.eventId!=='string'||!p.eventId.trim()||typeof p.seriesId!=='string'||!p.seriesId.trim())stop('IDENTITY','Indica evento, serie conocida, fecha y delta exactos','invalid');
 if(p.eventId.startsWith('review-'))stop('REVIEW_RESERVED','Las revisiones se gestionan desde su meta','invalid');
 if(!Number.isSafeInteger(p.deltaMinutes)||Math.abs(p.deltaMinutes)>1440)stop('DELTA','El delta debe ser un entero entre -1440 y 1440 minutos','invalid');
 if(!p.deltaMinutes)stop('NO_CHANGE','Un desplazamiento de cero no prepara una escritura','invalid');
 if(!c||Object.keys(c).some(k=>!['operationId','today','at','confirm','budgets'].includes(k))||typeof c.operationId!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(c.operationId)||typeof c.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(c.at)||!Number.isFinite(Date.parse(c.at)))stop('CONTEXT','Reserva identidad e instante válidos','invalid');
 civil.ordinal(c.at.slice(0,10));E.canonicalLocal(c.today,schedule);E.canonicalLocal(p.date,schedule);
 if(p.date<c.today)stop('RETROACTIVE','No se desplazan fechas anteriores a hoy','invalid');
 if(c.confirm!==true)stop('CONFIRM_REQUIRED','Confirma el desplazamiento de esta aparición','invalid');
 return freeze({request:p,context:c});
}
async function commandHash(request,context,zone){return sha256(canonical({kind:'event-shift',request,context,zone}));}
async function assertSemantics(schedule){
 await C.assertCalendarSemantics(schedule);
 if(typeof schedule.eventTime!=='function'||typeof schedule.timeString!=='function'||await sha256(canonical({eventTime:schedule.eventTime.toString(),timeString:schedule.timeString.toString()}))!==TIME_APPROVED)stop('SHIFT_SEMANTICS','Las funciones de horario cambiaron; se requiere revisar la demostración');
}
function resolveSeries(old,historical){
 const known=[...new Set((historical.byEvent.get(old.id)||[]).map(r=>r.seriesId).filter(Boolean))];
 if(known.length>1||old.seriesId&&known.some(s=>s!==old.seriesId))stop('SERIES_AMBIGUOUS','La identidad de serie contradice sus capturas');
 const series=old.seriesId||known[0];if(!series)stop('SERIES_UNKNOWN','La programación todavía no tiene una serie inequívoca; no se inventa al mover');return series;
}
function selectScope(plan,request,context,historical,schedule){
 const start=now(),cmd=command(request,context,schedule),p=cmd.request,c=cmd.context,maps=Object.fromEntries(['events','routines','revisions'].map(t=>[t,new Map(plan.tables[t].map(r=>[r.key,r]))])),all=plan.header.eventIds.map(id=>maps.events.get(id).value),old=maps.events.get(p.eventId)?.value;
 if(!old||old.kind==='review')stop('SOURCE','La actividad no existe o es una revisión reservada','invalid');
 if(resolveSeries(old,historical)!==p.seriesId)stop('SERIES_MISMATCH','La serie no coincide con la actividad','invalid');
 if(old.allDay)stop('ALL_DAY','Las actividades de todo el día no se desplazan por minutos','invalid');
 if(old.anchor==='between')stop('BETWEEN','Este bloque se reajusta moviendo sus límites, no directamente','invalid');
 if(!schedule.occurs(old,p.date))stop('NO_OCCURRENCE','La aparición no existe o está omitida por skip','invalid');
 if(all.length>E.LIMITS.planningEvents)stop('PLANNING_BUDGET','Catálogo de planificación excedido');
 const sourceIds=new Set([old.id,...(historical.bySeries.get(p.seriesId)||[]).map(r=>r.sourceEventId).filter(Boolean)]);
 const family=all.filter(e=>e.id===old.id||e.seriesId===p.seriesId||(historical.byEvent.get(e.id)||[]).some(r=>r.seriesId===p.seriesId));
 for(const e of family){if(resolveSeries(e,historical)!==p.seriesId)stop('SERIES_AMBIGUOUS','Segmentos con series incompatibles');sourceIds.add(e.id);}
 const owners=family.filter(e=>schedule.occurs(e,p.date));
 if(owners.length!==1||owners[0].id!==old.id)stop('OCCURRENCE_OWNER','Más de un segmento reclama la misma serie y fecha');
 const events=E.component(all,old.id),active=events.filter(e=>schedule.occurs(e,p.date)),records=new Map();
 for(const e of active){
  sourceIds.add(e.id);const own=historical.byEvent.get(e.id)||[],known=[...new Set(own.map(r=>r.seriesId).filter(Boolean))];
  if(known.length>1||e.seriesId&&known.some(s=>s!==e.seriesId))stop('SERIES_AMBIGUOUS','Una dependencia tiene identidad histórica ambigua');
  const series=e.seriesId||known[0];for(const r of series?historical.bySeries.get(series)||[]:[])if(!r.day||r.day===p.date)records.set(r.key,r);
 }
 for(const id of sourceIds)for(const r of historical.byEvent.get(id)||[])if(!r.day||r.day===p.date)records.set(r.key,r);
 if(records.size){const record=records.values().next().value;stop(record.legacy?'LEGACY_RECORDED':'CAPTURED_OCCURRENCE','La aparición o una dependencia afectada ya tiene un registro; se conserva el historial','indeterminate',{date:p.date,eventId:old.id,record:copy(record)});}
 const ids=new Set([...events,...family].map(e=>e.id)),rows=all.filter(e=>ids.has(e.id)).map(e=>({store:'events',row:maps.events.get(e.id)})),rids=new Set(events.flatMap(e=>[e.routineId,e.afterRoutineId,e.beforeRoutineId]).filter(Boolean));
 for(const id of plan.header.routineIds.filter(id=>rids.has(id)))rows.push({store:'routines',row:maps.routines.get(id)});
 for(const id of rids)if(!maps.routines.has(id))stop('ROUTINE_MISSING','Falta una rutina del componente');
 for(const id of new Set(events.map(e=>e.recipeRevisionId).filter(Boolean))){const row=maps.revisions.get(id);if(!row)stop('REVISION_MISSING','Falta una revisión referenciada');rows.push({store:'revisions',row});}
 return {request:p,context:c,old,events,family,rows,baseRoot:plan.rootHash,componentMs:now()-start};
}
function exactDelta(old,next,date,time){
 const a=copy(old),b=copy(next),ao=a.overrides,bo=b.overrides;delete a.overrides;delete b.overrides;
 if(!same(a,b)||!same(Object.fromEntries(Object.entries(ao).filter(([d])=>d!==date)),Object.fromEntries(Object.entries(bo).filter(([d])=>d!==date))))stop('DELTA_SCOPE','El desplazamiento intentó modificar otra fecha o entidad');
 const ad={...(ao[date]||{})},bd={...(bo[date]||{})};delete ad.time;delete bd.time;
 if(!same(ad,bd)||bo[date]?.time!==time)stop('DELTA_SCOPE','Solo se permite cambiar time del override autorizado');
}
async function buildShift(scope,{schedule,plannerActions}){
 const started=now(),{request:p,context:c,old,events}=scope,zone=R.calendarZone();await assertSemantics(schedule);
 if(events.length!==1)stop('CHECKPOINT_A_ONLY','Dependencias pendientes del checkpoint B');
 const routines=scope.rows.filter(r=>r.store==='routines').map(r=>r.row.value),state=C.stateFrames(events,routines,p.date,{},schedule),frame=state.frame(old);
 if(!frame)stop('BASE_FRAME','El intervalo actual no es válido; no se usa una hora de respaldo para repararlo');
 if(!Number.isSafeInteger(frame.start)||schedule.minutes(schedule.eventTime(old,p.date,state.data))!==frame.start)stop('TIME_PRECISION','El horario efectivo no es representable en minutos enteros');
 const start=Math.max(0,frame.start+p.deltaMinutes);if(start>=1440)stop('DAY_OVERFLOW','El comienzo quedaría fuera de 00:00–24:00','invalid');
 const newTime=schedule.timeString(start),actor=plannerActions({version:2,goals:[],routines:copy(routines),events:copy(events),logs:{},recipeRevisions:{}},{today:c.today,at:c.at,ids:[],confirm:false,resolveFrame:E.memoFrames(schedule)}),normalizationAt=now();
 actor.controller.shiftEvent(events.find(e=>e.id===old.id),p.date,p.deltaMinutes);const {candidate,messages}=actor.result(),calculationMs=now()-normalizationAt;
 if(!candidate)stop('PLANNER_REJECTED',messages.join('\n')||'Planner rechazó el movimiento','invalid',{date:p.date,eventId:old.id,rule:'planner-shift',messages});
 const next=candidate.events.find(e=>e.id===old.id);if(!next||candidate.events.length!==events.length||candidate.events.some((e,i)=>e.id!==events[i].id||e.id!==old.id&&!same(e,events[i]))||Object.keys(candidate.logs).length||!same(candidate.routines,routines))stop('DELTA_SCOPE','Se intentó modificar datos ajenos');
 exactDelta(old,next,p.date,newTime);if(same(old,next))stop('NO_CHANGE','El override ya tiene esa hora; no se escribe otra vez','invalid');
 const proofAt=now(),descriptor={date:p.date,repeat:'none'},before=await E.proveCalendar(events,routines,descriptor,c,schedule),after=await E.proveCalendar(candidate.events,routines,descriptor,c,schedule),validationMs=now()-proofAt;
 if(R.calendarZone()!==zone)stop('ZONE_CHANGED','La zona cambió durante la demostración');
 const certificate=freeze({format:'fullhouse-occurrence-shift-proof',version:1,status:'valid',date:p.date,zone,baseRoot:scope.baseRoot,semanticsHash:C.APPROVED,timeSemanticsHash:TIME_APPROVED,eventIds:events.map(e=>e.id),oldHash:await sha256(canonical(old)),newHash:await sha256(canonical(next)),beforeProofHash:before.proofHash,afterProofHash:after.proofHash,noOtherDates:'single-time-override-pointwise-v1'});
 return {event:freeze(copy(next)),zone,proof:freeze({status:'valid',certificate,proofHash:await sha256(canonical(certificate))}),metrics:{componentMs:scope.componentMs,calculationMs,validationMs,constructionMs:now()-started,before,after}};
}
async function candidateOperationHash(id,base,plan,cmd){
 const row=plan.tables.events.find(r=>r.key===cmd.request.eventId);if(!row)stop('RECOVERY_ROW','Falta la fila del candidato');
 return sha256(canonical({id,base,rootHash:plan.rootHash,changes:[['events',row.key,row.hash]],images:[],commandHash:cmd.commandHash}));
}
async function validateCommand(cmd,id,schedule){
 if(!cmd||Object.keys(cmd).length!==5||cmd.kind!=='event-shift'||!['kind','request','context','zone','commandHash'].every(k=>Object.hasOwn(cmd,k)))stop('RECOVERY_COMMAND','Comando de desplazamiento incompleto');
 if(typeof cmd.zone!=='string'||cmd.zone!==R.calendarZone())stop('RECOVERY_ZONE','La zona cambió: el commit puede existir; inspecciona el recibo antes de reconstruir en otra zona');
 const validated=command(cmd.request,cmd.context,schedule);if(validated.context.operationId!==id||cmd.commandHash!==await commandHash(validated.request,validated.context,cmd.zone))stop('RECOVERY_COMMAND','El comando no coincide con su identidad y huella');return validated;
}
module.exports={TIME_APPROVED,command,commandHash,assertSemantics,resolveSeries,selectScope,exactDelta,buildShift,candidateOperationHash,validateCommand,stop};
