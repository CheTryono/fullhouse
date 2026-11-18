'use strict';
const {copy,freeze,same}=require('./json.cjs');
const codec=require('./codec.cjs'),journal=require('./record-journal.cjs');
function createLegacyCompat({legacy,engine,adapter}){
  const assert=doc=>{const errors=codec.validateV2(doc,legacy);if(errors.length)throw Error(errors.join('; '));};
  function edit(document,key,command){
    assert(document);const before=copy(document),doc=copy(document),old=doc.logs[key],cmd=copy(command),a=cmd.action;
    if(!old || old.history)throw Error('Se requiere un registro heredado');
    if(!a || !['step','complete','reopen','note','choice','evidence','visibility'].includes(a.type))throw Error('Acción heredada desconocida');
    const next=copy(old),known=new Set([...old.checkedSteps,...Object.keys(old.stepNotes || {}),...Object.keys(old.choices || {}),...(old.evidences || []).map(e=>e.stepId).filter(Boolean)]);
    for(const f of [old.recordEdits?.original,...(old.recordEdits?.entries || []).flatMap(e=>[e.before,e.after])].filter(Boolean))for(const id of [...f.checkedSteps,...Object.keys(f.stepNotes || {}),...Object.keys(f.choices || {})])known.add(id);
    const requireStep=id=>{if(typeof id!=='string'||!known.has(id))throw Error('ID histórico desconocido: no se infiere desde la plantilla');};
    let hidden=journal.hidden(old);
    switch(a.type){
      case 'step':requireStep(a.stepId);if(typeof a.checked!=='boolean')throw Error('Marca inválida');next.checkedSteps=a.checked?[...new Set([...old.checkedSteps,a.stepId])]:old.checkedSteps.filter(x=>x!==a.stepId);next.completed=false;break;
      case 'complete':next.completed=true;break;
      case 'reopen':if(!old.completed)throw Error('El registro ya está abierto');next.completed=false;break;
      case 'note':if(typeof a.text!=='string')throw Error('Nota inválida');if(a.stepId!==undefined){requireStep(a.stepId);next.stepNotes={...(old.stepNotes || {}),[a.stepId]:a.text.trim()};}else next.note=a.text.trim();break;
      case 'choice':requireStep(a.stepId);if(!Object.hasOwn(old.choices || {},a.stepId)||typeof a.variantId!=='string'||!a.variantId.trim())throw Error('No existe elección histórica para corregir');next.choices={...old.choices,[a.stepId]:a.variantId};break;
      case 'evidence':{
        const e=copy(a.evidence);if(e?.stepId)requireStep(e.stepId);
        if(!e || typeof e.id!=='string'||!e.id.trim())throw Error('Evidencia inválida');
        const existing=(old.evidences || []).find(x=>x.id===e.id);if(existing&&!same(existing,e))throw Error('ID de evidencia reutilizado');
        if(!existing)next.evidences=[...(old.evidences || []),e];break;
      }
      case 'visibility':{
        if(typeof a.hidden!=='boolean'||!(old.evidences || []).some(e=>e.id===a.evidenceId))throw Error('Evidencia inexistente');
        hidden=a.hidden?[...new Set([...hidden,a.evidenceId])]:hidden.filter(id=>id!==a.evidenceId);break;
      }
    }
    journal.append(old,next,{id:cmd.id,at:cmd.at,reason:cmd.reason,type:a.type,hiddenAfter:hidden});doc.logs[key]=next;assert(doc);
    if(!journal.retained(old,next))throw Error('Original alterado');return freeze({before,after:doc});
  }
  function native(document,request){
    if(typeof request.editId!=='string'||!request.editId.trim()||typeof request.reason!=='string'||!request.reason.trim())throw Error('Reserva identidad y motivo antes de editar');
    assert(document);const doc=copy(document),key=Object.keys(doc.logs).find(k=>doc.logs[k].history?.capture.executionId===request.executionId),old=key?doc.logs[key]:null;
    if(request.action.type==='visibility'){
      if(!old || typeof request.action.hidden!=='boolean'||!(old.evidences || []).some(e=>e.id===request.action.evidenceId))throw Error('Evidencia inexistente');
      const hidden=journal.hidden(old),next=copy(old),a=request.action;if(!Number.isFinite(Date.parse(request.at))||Date.parse(request.at)<Date.parse(old.history.state.lastRecordedAt))throw Error('Instante de retirada inválido');next.history.state.lastRecordedAt=request.at;
      journal.append(old,next,{id:request.editId,at:request.at,reason:request.reason,type:'visibility',hiddenAfter:a.hidden?[...new Set([...hidden,a.evidenceId])]:hidden.filter(id=>id!==a.evidenceId)});doc.logs[key]=next;assert(doc);return freeze({before:copy(document),after:doc});
    }
    const command=copy(request);if(old && old.history.state.status!=='active' && ['note','evidence'].includes(command.action.type))command.action={type:'annotate',action:command.action};
    return adapter.prepare(engine,document,command);
  }
  function adopt(document,key,request){
    assert(document);const before=copy(document),doc=copy(document),source=doc.logs[key],req=copy(request);
    if(!source || source.history || source.recordEdits?.adoption)throw Error('Origen inválido o ya adoptado');
    if(req.confirm!==true || typeof req.reason!=='string'||!req.reason.trim())throw Error('La adopción exige confirmación y explicación');
    const event=doc.events.find(e=>e.id===req.context?.eventId),routine=doc.routines.find(r=>r.id===event?.routineId);
    if(!event || !routine || routine.id!==req.routineId)throw Error('Elige una rutina actual inequívoca');
    if(req.expectedDefinition===undefined || !same(req.expectedDefinition,routine))throw Error('La definición cambió desde la confirmación');
    const temp='adoption-source:'+req.executionId;if(doc.events.some(e=>e.id===temp)||doc.logs[temp+'@'+req.context.date])throw Error('Identidad de adopción reutilizada');
    // Evento efímero: no modifica programación, excepciones ni serie de la fuente actual.
    const cloned={...copy(event),id:temp,date:req.context.date,repeat:'none',overrides:{}};delete cloned.endDate;delete cloned.applyFrom;delete cloned.specificDates;delete cloned.repeatDays;delete cloned.everyDays;delete cloned.seriesId;delete cloned.recipeRevisionId;
    doc.events.push(cloned);
    const command={...req,context:{...req.context,eventId:temp},action:{type:'note',text:'Adopción explícita de definición actual'}};
    const prepared=adapter.prepare(engine,doc,command).after,next=copy(prepared),newKey=temp+'@'+req.context.date,log=next.logs[newKey];
    if(!log)throw Error('No se pudo preparar el tramo adoptado');
    // La nota técnica no es una observación del usuario. Progreso comienza vacío.
    delete log.note;log.history.capture.provenance='adopted-current';log.history.capture.captureReason='adopt';log.history.capture.sourceEventId=event.id;log.history.capture.adoption={legacyKey:key};
    const targetKey='adopted:'+req.executionId+'@'+req.context.date;if(Object.hasOwn(next.logs,targetKey))throw Error('Destino existente');
    delete next.logs[newKey];next.logs[targetKey]=log;next.events=copy(before.events);
    const updated=copy(source);journal.append(source,updated,{id:req.id,at:req.at,reason:req.reason,type:'adopt'});
    updated.recordEdits.adoption={executionId:req.executionId,logKey:targetKey,recordedAt:req.at,sourceRoutineId:routine.id,recipeRevisionId:log.history.capture.recipeRevisionId};next.logs[key]=updated;
    assert(next);return freeze({before,after:next});
  }
  return Object.freeze({edit,native,adopt});
}
module.exports={createLegacyCompat};
