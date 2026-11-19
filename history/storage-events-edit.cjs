'use strict';
// Pure experimental edit contract. No public Planner, storage, dates or photos are mutated.
const { copy, same, freeze } = require('./json.cjs');
const E = require('./storage-events.cjs'), C = require('./calendar-proof.cjs'), civil = require('./calendar-math.cjs');
const clock = () => performance.now();
const META = new Set(['title', 'note']);
const OWNED = new Set(['id', 'seriesId', 'recipeRevisionId', 'applyFrom']);
const FIELDS = new Set(['date','endDate','time','minutes','goalId','routineId','repeat','repeatDays','everyDays','specificDates','kind','allDay','anchor','endTime','afterRoutineId','beforeRoutineId','overlapMode','requestEvidence','overrides']);
function stop(code, message, status = 'indeterminate', counterexample = null) { const e = Error(message); Object.assign(e, { code, status, counterexample }); throw e; }
function projection(e) {
    const p = Object.fromEntries(Object.entries(e).filter(([k]) => !META.has(k) && !OWNED.has(k)));
    Object.assign(p, { kind:e.kind || 'activity', allDay:!!e.allDay, anchor:e.anchor || 'start', overlapMode:e.overlapMode || 'keep', requestEvidence:!!e.requestEvidence,
        endDate:e.endDate || '', endTime:e.endTime || '', afterRoutineId:e.afterRoutineId || '', beforeRoutineId:e.beforeRoutineId || '',
        specificDates:[...new Set(e.specificDates || [])].sort(), repeatDays:[...new Set(e.repeatDays || [])].sort(), overrides:e.overrides || {} });
    return p;
}
function classify(old, draft) {
    const changed = [...new Set([...Object.keys(old), ...Object.keys(draft)])].filter(k => !OWNED.has(k) && !same(old[k],draft[k]));
    if(changed.some(k => !META.has(k) && !FIELDS.has(k))) stop('UNKNOWN_FIELD','Campo modificado sin contrato: '+changed.filter(k=>!META.has(k)&&!FIELDS.has(k)).join(', '));
    for(const k of META) if(Object.hasOwn(draft,k) && typeof draft[k] !== 'string') stop('METADATA','Los metadatos deben ser texto','invalid');
    return {category:same(projection(old),projection(draft))?'metadata':'planning',changed};
}
function issue(plan, head, sourceEventId, operationId, historical) {
    const old=plan.tables.events.find(r=>r.key===sourceEventId)?.value;
    if(!old || old.kind==='review' || sourceEventId.startsWith('review-'))stop('SOURCE','Actividad inexistente o revisión reservada','invalid');
    const created=E.issue(head,operationId),eventId=created.eventId.replace(/^event-v2:/,'segment-v2:'),records=historical.byEvent.get(sourceEventId)||[],known=[...new Set(records.map(r=>r.seriesId).filter(Boolean))];
    if(known.length>1 || old.seriesId && known.some(id=>id!==old.seriesId))stop('SERIES_AMBIGUOUS','La actividad tiene identidades históricas de serie incompatibles');
    const seriesId=old.seriesId || known[0] || created.seriesId;
    if(historical.events.has(eventId)||plan.tables.events.some(r=>r.key===eventId))stop('EVENT_ID_USED','El nuevo ID de segmento ya está reservado');
    if(!old.seriesId&&!known.length&&(historical.series.has(seriesId)||plan.tables.events.some(r=>r.value.seriesId===seriesId)))stop('SERIES_ID_USED','La serie nueva ya está reservada');
    return freeze({...created,format:'event-edit-reservation-v1',sourceEventId,eventId,seriesId});
}
function selectScope(plan,reservation,payload,context,historical,schedule) {
    const started=clock(),p=C.snapshotInput(payload),c=C.snapshotInput(context),all=plan.header.eventIds.map(id=>plan.tables.events.find(r=>r.key===id).value),old=all.find(e=>e.id===reservation.sourceEventId);
    if(!old||!p||p.id!==old.id||reservation.format!=='event-edit-reservation-v1')stop('EDIT_IDENTITY','La reserva no corresponde al evento a editar','invalid');
    if(!c || Object.keys(c).some(k=>!['operationId','today','at','confirm','capturedFuture','budgets'].includes(k))||c.operationId!==reservation.operationId||typeof c.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(c.at)||!Number.isFinite(Date.parse(c.at)))stop('CONTEXT','Reserva fecha, instante e identidad exactos','invalid');
    if(c.confirm!==undefined&&typeof c.confirm!=='boolean'||c.capturedFuture!==undefined&&c.capturedFuture!=='retain-frozen')stop('CONTEXT','Confirmación o política de capturas inválidas','invalid');
    civil.ordinal(c.today);const cut=p.applyFrom || c.today;E.canonicalLocal(cut,schedule);
    if(cut<c.today)stop('RETROACTIVE','El corte no puede ser anterior a hoy','invalid');
    for(const k of ['seriesId','recipeRevisionId'])if(Object.hasOwn(p,k)&&p[k]!==old[k])stop('OWNED_IDENTITY','No se puede cambiar '+k,'invalid');
    if(p.kind==='review')stop('REVIEW_RESERVED','Las revisiones se editan desde la meta','invalid');
    const classification=classify(old,p),category=classification.category==='metadata'&&p.applyFrom&&p.applyFrom>c.today?'planning':classification.category;
    const records=historical.byEvent.get(old.id)||[];
    if(records.some(r=>r.legacy))stop('LEGACY_CONTEXT','Registro heredado: no se inventa una definición histórica al editar su programación');
    const seed={...p,id:reservation.eventId},ids=new Set([...E.component(all,old.id),...E.component([...all,seed],seed.id),...all.filter(e=>e.seriesId===reservation.seriesId)].map(e=>e.id));ids.delete(seed.id);
    const events=all.filter(e=>ids.has(e.id)),rids=new Set([p.routineId,p.afterRoutineId,p.beforeRoutineId,...events.flatMap(e=>[e.routineId,e.afterRoutineId,e.beforeRoutineId])].filter(Boolean));
    if(all.length>E.LIMITS.planningEvents)stop('PLANNING_BUDGET','Catálogo de planificación excedido');
    const rows=events.map(e=>({store:'events',row:plan.tables.events.find(r=>r.key===e.id)}));
    for(const id of plan.header.routineIds.filter(id=>rids.has(id)))rows.push({store:'routines',row:plan.tables.routines.find(r=>r.key===id)});
    for(const id of new Set([p.goalId,...events.map(e=>e.goalId)].filter(Boolean))){const row=plan.tables.goals.find(r=>r.key===id);if(!row&&id===p.goalId)stop('GOAL_MISSING','La meta seleccionada ya no existe','invalid');if(row)rows.push({store:'goals',row});}
    for(const id of new Set(events.map(e=>e.recipeRevisionId).filter(Boolean))){const row=plan.tables.revisions.find(r=>r.key===id);if(!row)stop('REVISION_MISSING','Falta definición referenciada');rows.push({store:'revisions',row});}
    if(p.routineId&&!plan.tables.routines.some(r=>r.key===p.routineId))stop('ROUTINE_MISSING','La rutina seleccionada ya no existe','invalid');
    return {old,payload:p,context:c,reservation,cut,category,classification,records,rows,all,componentMs:clock()-started};
}
async function normalize(scope,ports,draft){
    const {seriesId,eventId}=scope.reservation,p=copy(draft);delete p.seriesId;delete p.recipeRevisionId;delete p.applyFrom;p.id='';
    const rows=scope.rows.filter(r=>r.store!=='executions' && !(r.store==='events'&&(r.row.key===scope.old.id||r.row.value.seriesId===seriesId)));
    return E.normalizeChange({payload:p,context:{operationId:scope.context.operationId,today:scope.context.today,at:scope.context.at,...(scope.context.budgets?{budgets:scope.context.budgets}:{})},reservation:{eventId,seriesId},rows,componentMs:scope.componentMs},ports);
}
async function buildEdit(scope,ports){
    if(scope.category!=='metadata')stop('CHECKPOINT_A_ONLY','La planificación requiere el checkpoint B');
    const normalized=await normalize(scope,ports,scope.payload),event={...copy(scope.old)};
    for(const key of META)if(Object.hasOwn(scope.payload,key))event[key]=normalized.event[key];else delete event[key];
    if(!same(projection(event),projection(scope.old)))stop('SCOPE_CHANGED','Los metadatos no pueden alterar la planificación');
    return {events:[event],split:false,proof:{status:'valid',kind:'metadata-no-calendar-effect'},zone:normalized.zone,metrics:normalized.metrics};
}
module.exports={META,projection,classify,issue,selectScope,normalize,buildEdit,stop};
