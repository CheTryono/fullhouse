'use strict';
const {copy,freeze,same}=require('./json.cjs');
const {readBackup,exportV2}=require('./backups.cjs');
// Puente experimental: el llamador aporta motor, lector, operaciones Planner y repositorio.
function createIntegration({engine,adapter,reader,repository,plannerActions,legacy}){
  let confirmed=null,base=null,pending=null,recovery=null,busy=false;const drafts=Object.create(null);
  const blocked=()=>{if(busy || pending || recovery || !base)throw Error('Resuelve la operación pendiente o la recuperación antes de editar');};
  const state=()=>freeze({confirmed,pending:pending?{id:pending.id,document:pending.document,error:pending.error}:null,recovery,busy,drafts:copy(drafts)});
  const finished=()=>freeze({...state(),busy:false});
  async function open(){if(pending || busy)throw Error('Hay cambios pendientes');busy=true;try{const result=await repository.open();recovery=result.status==='recovery'?result:null;base=result.token || null;if(result.status!=='recovery')confirmed=result.document || null;return finished();}finally{busy=false;}}
  async function persist(document,id){
    if(typeof id!=='string' || !id.trim())throw Error('Reserva una identidad estable antes de guardar');
    pending={id,document:freeze(copy(document)),operation:null,error:null};
    try{pending.operation=await repository.prepare(base,document,id);const saved=await repository.write(pending.operation);confirmed=saved.document;base=saved.token;pending=null;return finished();}
    catch(error){pending.error=error.message;return finished();}
  }
  async function initialize(document,id){blocked();if(confirmed)throw Error('Ya existe un documento confirmado');busy=true;try{return await persist(document,id);}finally{busy=false;}}
  async function dispatch(request){blocked();if(!confirmed)throw Error('Primero prepara el documento experimental');busy=true;
    try{
      const op=adapter.prepare(engine,confirmed,request);let document=op.after;
      // Misma semántica de toggleStep: último paso completa por unidades; ambos cambios son un candidato.
      if(request.action.type==='step' && request.action.checked){const l=Object.values(document.logs).find(l=>l.history?.capture.executionId===request.executionId),r=l?.history.resolution;
        if(r?.unitsKnown && r.unitStepIds.length && r.unitStepIds.every(id=>l.checkedSteps.includes(id)))document=engine.prepare(document,{executionId:request.executionId,at:request.at,action:{type:'complete',source:'steps'}}).after;
      }
      if(same(document,confirmed))return finished();return await persist(document,request.operationId);
    }finally{busy=false;}
  }
  async function plan(method,payload,context){blocked();if(!confirmed)throw Error('No hay documento');if(!['saveRoutine','saveEvent','shiftEvent','deleteRoutine','deleteEvent'].includes(method))throw Error('Acción Planner no permitida');busy=true;
    try{
      const before=confirmed,{controller,result}=plannerActions(copy(before),context);
      if(method==='saveRoutine'){if(payload.id && !before.routines.some(r=>r.id===payload.id))throw Error('Rutina a editar inexistente; las nuevas usan id vacío y un ID explícito reservado');controller.state.routineDraft=copy(payload);}
      if(method==='saveEvent'){if(payload.id && !before.events.some(e=>e.id===payload.id))throw Error('Actividad a editar inexistente; las nuevas usan id vacío y un ID explícito reservado');controller.state.eventDraft=copy(payload);}
      if(method==='shiftEvent'){const event=controller.state.data.events.find(e=>e.id===payload.eventId);if(!event)throw Error('Actividad inexistente');await controller.shiftEvent(event,payload.date,payload.delta);}
      else if(method==='deleteRoutine'){const routine=controller.state.data.routines.find(r=>r.id===payload.id);if(!routine)throw Error('Rutina inexistente');await controller.deleteRoutine(routine);}
      else if(method==='deleteEvent'){const event=controller.state.data.events.find(e=>e.id===payload.id);if(!event)throw Error('Actividad inexistente');await controller.deleteEvent(event);}
      else await controller[method]();
      const {candidate,messages}=result();if(!candidate)throw Error(messages.join('\n') || 'Acción rechazada');
      // La programación no es dueña de los hechos ni de la ubicación de logs históricos/legados.
      candidate.logs=copy(before.logs);candidate.recipeRevisions=copy(before.recipeRevisions);
      for(const e of candidate.events)if(e.recipeRevisionId && e.routineId!==candidate.recipeRevisions[e.recipeRevisionId]?.sourceRoutineId)delete e.recipeRevisionId;
      const issues=doc=>{controller.state.data=doc;return doc.events.flatMap(e=>controller.schedulePreview({...e,applyFrom:context.today}).map(row=>({...row,eventId:e.id}))).filter(row=>row.issue);};
      const oldIssues=new Set(issues(before).map(row=>JSON.stringify([row.eventId,row.date,row.issue])));
      const newIssue=issues(candidate).find(row=>!oldIssues.has(JSON.stringify([row.eventId,row.date,row.issue])));
      if(newIssue)throw Error('La programación candidata no es válida: '+newIssue.issue);
      const errors=engine.validate(candidate);if(errors.length)throw Error(errors.join('; '));
      return await persist(candidate,context.operationId);
    }finally{busy=false;}
  }
  async function retry(){if(busy || !pending || recovery)throw Error('No hay pendiente reintentable');busy=true;try{
    if(!pending.operation)pending.operation=await repository.prepare(base,pending.document,pending.id);
    const saved=await repository.write(pending.operation);confirmed=saved.document;base=saved.token;pending=null;
  }catch(error){pending.error=error.message;}finally{busy=false;}return state();}
  async function recover(){if(busy || pending)throw Error('Exporta pendientes antes de recuperar');busy=true;try{
    const operation=await repository.recoverOperation(),saved=await repository.write(operation);confirmed=saved.document;base=saved.token;recovery=null;return finished();
  }finally{busy=false;}}
  async function importBackup(raw,{id,confirmReplace=false}={}){blocked();const result=readBackup(raw,legacy);if(!result.ok)throw Error('Respaldo inválido: no se ha modificado nada');if(result.kind==='legacy')return {status:'legacy-review',document:result.document};if(!confirmReplace)throw Error('Confirma explícitamente el reemplazo y conserva un respaldo previo');busy=true;try{return await persist(result.document,id);}finally{busy=false;}}
  async function exportRecovery(){return freeze({format:'fullhouse-experimental-recovery',version:1,confirmed:confirmed?exportV2(confirmed,legacy):null,pending:pending?exportV2(pending.document,legacy):null,drafts:copy(drafts),storage:await repository.originals()});}
  return Object.freeze({open,initialize,dispatch,plan,retry,recover,importBackup,exportRecovery,state,setDraft(id,value){if(typeof id!=='string' || !id.trim())throw Error('Identidad de borrador inválida');drafts[id]=copy(value);},exportConfirmed(){if(!confirmed)throw Error('No hay documento confirmado');return exportV2(confirmed,legacy);},index(){return confirmed?reader.index(confirmed):[];},progress(date){return confirmed?reader.progress(confirmed,date):null;}});
}
module.exports={createIntegration};
