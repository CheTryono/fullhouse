'use strict';
const { copy, same, freeze } = require('./json.cjs');
const codec = require('./codec.cjs');
const { resolve } = require('./resolution.cjs');
const fail = message => { throw new Error(message); };
const nonempty = v => typeof v==='string' && !!v.trim();
const own = (o,k) => Object.hasOwn(o,k);
function createEngine(validateLegacy) {
  if(typeof validateLegacy!=='function') fail('Se requiere un validador v1');
  const prepared = new WeakSet();
  function operation(before, after) { const result=freeze({before,after});prepared.add(result);return result; }
  function assert(doc) { const errors=codec.validateV2(doc,validateLegacy); if(errors.length)fail(errors.join('; ')); }
  function revision(doc,routineId,revisionId,at) {
    const definition=doc.routines.find(r=>r.id===routineId); if(!definition)fail('Rutina inexistente');
    const existing=Object.values(doc.recipeRevisions).find(r=>r.sourceRoutineId===routineId && same(r.definition,definition));
    if(existing)return existing.id;
    if(!nonempty(revisionId) || own(doc.recipeRevisions,revisionId))fail('Identificador de versión ausente o reutilizado');
    Object.defineProperty(doc.recipeRevisions,revisionId,{value:{id:revisionId,sourceRoutineId:routineId,createdAt:at,definition:copy(definition)},enumerable:true,writable:true,configurable:true});
    return revisionId;
  }
  function createRevision(document, routineId, options) {
    assert(document); const doc=copy(document), id=revision(doc,routineId,options.revisionId,options.at); assert(doc);
    return freeze({document:doc,revisionId:id});
  }
  function find(doc,executionId) {return Object.entries(doc.logs).find(([,l])=>l.history?.capture.executionId===executionId);}
  function significant(a) {
    return a.type==='step' && a.checked===true || a.type==='complete' || a.type==='choice' || a.type==='note' && nonempty(a.text) || a.type==='evidence';
  }
  function capture(doc,c,a) {
    if(!c || !nonempty(c.executionId) || !nonempty(c.seriesId))fail('Falta identidad de ejecución/serie');
    const e=doc.events.find(e=>e.id===c.eventId); if(!e)fail('Actividad inexistente');
    if(e.seriesId && e.seriesId!==c.seriesId)fail('La serie no coincide');
    if(e.overrides[c.date]?.skip)fail('La ocurrencia está cancelada');
    const key=`${e.id}@${c.date}`;
    if(own(doc.logs,key))fail('Registro existente: no se adopta ni sustituye legado automáticamente');
    if(Object.values(doc.logs).some(l=>l.history?.capture.seriesId===c.seriesId && l.history.capture.scheduledDate===c.date))fail('Ocurrencia ya capturada');
    const r=e.routineId?doc.routines.find(r=>r.id===e.routineId):null;
    if(e.routineId && !r)fail('No se puede reconstruir una rutina eliminada');
    const revisionId=r?revision(doc,r.id,c.revisionId,c.at):null;
    e.seriesId=c.seriesId; if(revisionId)e.recipeRevisionId=revisionId;
    const durationMode=e.anchor==='between'?'between':r?(r.durationMode || 'steps'):'event';
    const budget=durationMode==='fixed'?r.durationMin:c.budgetMinutes ?? e.minutes;
    if(durationMode==='between' && !c.window)fail('Se requiere el intervalo resuelto de dependencias');
    const time=e.overrides[c.date]?.time || e.time;
    const start=time?Number(time.slice(0,2))*60+Number(time.slice(3)):0;
    const window=e.allDay?null:c.window ?? {startMin:start,endMin:start+budget};
    const goalIds=[...new Set([e.goalId,...(r?collectGoalIds(r.steps):[])].filter(Boolean))];
    const plan={title:e.title,description:e.note || r?.desc || '',kind:e.kind || (r?'routine':'activity'),allDay:!!e.allDay,durationMode,
      window:copy(window),budgetMinutes:budget,goals:goalIds.map(id=>{const g=doc.goals.find(g=>g.id===id);return {id,title:g?.title ?? null,...(g?.area?{area:g.area}:{}),...(g?.color?{color:g.color}:{})};})};
    const reason={step:'step',complete:'complete',choice:'choice',note:'note',evidence:'evidence'}[a.type];
    const log={completed:false,checkedSteps:[],history:{capture:{format:1,executionId:c.executionId,seriesId:c.seriesId,sourceEventId:e.id,sourceRoutineId:r?.id || null,
      scheduledDate:c.date,capturedAt:c.at,captureReason:reason,provenance:'recorded',recipeRevisionId:revisionId,plan},
      resolution:resolve(r,c.date,{},plan),state:{status:'active',completionSource:null,lastRecordedAt:c.at,completedRecordedAt:null},actualTiming:null,continuations:[],corrections:[]}};
    Object.defineProperty(doc.logs,key,{value:log,enumerable:true,writable:true,configurable:true});
    return log;
  }
  function collectGoalIds(steps) {return steps.flatMap(s=>[s.goalId,...collectGoalIds(s.children || []),...(s.variants || []).flatMap(v=>[v.goalId,...collectGoalIds(v.children || [])])]);}
  function catalog(r) {const map=new Map();function walk(steps){for(const s of steps){map.set(s.id,s);walk(s.children || []);for(const v of s.variants || [])walk(v.children || []);}}if(r)walk(r.steps);return map;}
  function prepare(document,command) {
    assert(document); const before=copy(document), doc=copy(document), cmd=copy(command), a=cmd.action;
    if(!a || !['view','step','complete','choice','note','evidence','close-partial','continue','reopen'].includes(a.type))fail('Acción desconocida');
    if(a.type==='view')return operation(before,doc);
    let log=find(doc,cmd.executionId)?.[1];
    if(log && cmd.context) {
      const c=log.history.capture;
      if(cmd.context.eventId!==c.sourceEventId || cmd.context.date!==c.scheduledDate || cmd.context.seriesId!==c.seriesId)fail('Identidad reutilizada para otro contexto');
    }
    if(!log) {
      if(!significant(a)) {
        if(['close-partial','continue','reopen'].includes(a.type))fail('Ejecución inexistente');
        return operation(before,doc);
      }
      log=capture(doc,{...cmd.context,at:cmd.at ?? cmd.context?.at,executionId:cmd.executionId},a);
    }
    const h=log.history,c=h.capture,at=cmd.at ?? cmd.context?.at;
    if(!nonempty(at) || !Number.isFinite(Date.parse(at)) || Date.parse(at)<Date.parse(h.state.lastRecordedAt))fail('Instante inválido o anterior al último registro');
    const r=c.recipeRevisionId===null?null:doc.recipeRevisions[c.recipeRevisionId].definition, index=catalog(r);
    let transition='progress';
    const active=()=>{if(h.state.status!=='active')fail('Reabre explícitamente la ejecución antes de modificarla');};
    const correction=(kind)=>{
      if(!nonempty(a.reason) || !nonempty(a.correctionId) || h.corrections.some(x=>x.id===a.correctionId))fail('Corrección sin motivo o identidad única');
      h.corrections.push({id:a.correctionId,recordedAt:at,reason:a.reason,kind,before:codec.checkpoint(log)});
    };
    if(a.type==='reopen') {
      if(h.state.status==='active')fail('La ejecución ya está activa'); correction('reopen');
      Object.assign(h.state,{status:'active',completionSource:null,completedRecordedAt:null});log.completed=false;transition='reopen';
    } else {
      active();
      switch(a.type) {
        case 'step': {
          if(typeof a.checked!=='boolean' || !index.has(a.stepId) || !h.resolution.unitStepIds.includes(a.stepId))fail('Solo se marcan unidades aplicables');
          if(a.checked) {if(!log.checkedSteps.includes(a.stepId))log.checkedSteps.push(a.stepId);}
          else log.checkedSteps=log.checkedSteps.filter(id=>id!==a.stepId);
          break;
        }
        case 'note':
          if(typeof a.text!=='string')fail('Nota inválida');
          if(a.stepId!==undefined){if(!index.has(a.stepId))fail('Paso inexistente');log.stepNotes={...(log.stepNotes || {}),[a.stepId]:a.text};}
          else log.note=a.text;
          break;
        case 'evidence': {
          const e=copy(a.evidence); if(!e || !nonempty(e.id))fail('Evidencia inválida');
          const existing=(log.evidences || []).find(x=>x.id===e.id);
          if(existing && !same(existing,e))fail('No se reemplaza una evidencia existente');
          if(!existing)log.evidences=[...(log.evidences || []),e]; break;
        }
        case 'choice': {
          const source=index.get(a.stepId);
          const applicable=(nodes)=>nodes.some(n=>n.stepId===a.stepId || applicable(n.children));
          if(!applicable(h.resolution.tree))fail('Alternativa fuera de la estructura activa');
          if(!source || source.chooseWhen!=='execute' || !((source.mode==='alternatives') || source.variants?.length) || !(a.variantId==='__base' || (source.variants || []).some(v=>v.id===a.variantId)))fail('Elección inválida');
          if(log.choices?.[a.stepId]===a.variantId)break;
          if(own(log.choices || {},a.stepId) && log.choices[a.stepId]!==a.variantId){correction('choice');transition='correct-choice';}
          log.choices={...(log.choices || {}),[a.stepId]:a.variantId};
          h.resolution=resolve(r,c.scheduledDate,log.choices,c.plan);break;
        }
        case 'complete':
          if(!['manual','steps'].includes(a.source))fail('Origen de completado inválido');
          if(!h.resolution.unitsKnown || a.source==='steps' && (!h.resolution.unitStepIds.length || !h.resolution.unitStepIds.every(id=>log.checkedSteps.includes(id))))fail('Faltan decisiones o unidades para completar');
          log.completed=true;Object.assign(h.state,{status:'completed',completionSource:a.source,completedRecordedAt:at});transition='complete';break;
        case 'close-partial':h.state.status='closed-partial';transition='close-partial';break;
        case 'continue':
          if(!nonempty(a.localDate) || !Number.isInteger(a.timezoneOffsetMinutes))fail('Continuación inválida');
          h.continuations.push({recordedAt:at,localDate:a.localDate,timezoneOffsetMinutes:a.timezoneOffsetMinutes});transition='continue';break;
      }
    }
    h.state.lastRecordedAt=at;
    assert(doc);
    const errors=codec.validateTransition(before,doc,transition,validateLegacy,cmd.executionId);if(errors.length)fail(errors.join('; '));
    return operation(before,doc);
  }
  // La integración futura guarda operation.after y lo confirma solo tras escritura.
  // Retener el mismo objeto de operación permite reintentar sin generar nuevos IDs.
  function accept(current,operation) {
    if(!prepared.has(operation))fail('Solo se confirman operaciones preparadas por este motor');
    assert(current);assert(operation.before);assert(operation.after);
    if(!same(current,operation.before) && !same(current,operation.after))fail('Operación obsoleta: el documento cambió');
    return freeze(copy(operation.after));
  }
  return Object.freeze({prepare,accept,createRevision,validate:doc=>codec.validateV2(doc,validateLegacy),decode:raw=>codec.decode(raw,validateLegacy),encode:doc=>codec.encode(doc,validateLegacy)});
}
module.exports={createEngine};
